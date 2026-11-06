import { KEYS, readJSON, writeJSON } from './storage';

const DROPBOX_CLIENT_ID = 'eafpljx4claj83h';
const DROPBOX_REDIRECT_URI = window.location.href.split('#')[0].split('?')[0];
export const DEFAULT_FOLDER = '/현장사진';

export type DropboxData = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email?: string;
  name?: string;
  autoUpload: boolean;
  manualUpload: boolean;
};

const read = () => readJSON<DropboxData | null>(KEYS.dropbox, null);

// ========== PKCE ==========
function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64Url(array);
}

async function generateCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** Dropbox 로그인 페이지로 이동 */
export async function startDropboxLogin() {
  const verifier = generateCodeVerifier();
  localStorage.setItem(KEYS.dropboxVerifier, verifier); // iOS Safari 대비 localStorage 사용
  const challenge = await generateCodeChallenge(verifier);
  const params = new URLSearchParams({
    client_id: DROPBOX_CLIENT_ID,
    redirect_uri: DROPBOX_REDIRECT_URI,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline', // Refresh Token 받기
  });
  window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

export function hasOAuthCallback() {
  return new URLSearchParams(window.location.search).has('code');
}

/** 로그인 후 돌아왔을 때 code → 토큰 교환. 성공 시 저장된 데이터를 돌려준다. */
export async function handleDropboxCallback(): Promise<DropboxData | null> {
  const code = new URLSearchParams(window.location.search).get('code');
  const verifier = localStorage.getItem(KEYS.dropboxVerifier);
  if (!code || !verifier) return null;

  window.history.replaceState({}, document.title, window.location.pathname);

  try {
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_CLIENT_ID,
        code_verifier: verifier,
        redirect_uri: DROPBOX_REDIRECT_URI,
      }),
    });
    if (!tokenResponse.ok) throw new Error('토큰 교환 실패: ' + (await tokenResponse.text()));

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error('Access Token을 받지 못했습니다.');

    const accountResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!accountResponse.ok) throw new Error('계정 정보를 가져오지 못했습니다.');
    const accountData = await accountResponse.json();

    const data: DropboxData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      email: accountData.email,
      name: accountData.name?.display_name,
      autoUpload: false,
      manualUpload: false,
    };
    writeJSON(KEYS.dropbox, data);
    return data;
  } finally {
    localStorage.removeItem(KEYS.dropboxVerifier);
  }
}

/** 만료 10분 전이면 refresh token으로 갱신. 유효한 데이터 또는 null */
export async function ensureDropboxToken(): Promise<DropboxData | null> {
  const data = read();
  if (!data) return null;
  if (Date.now() <= data.expires_at - 600000) return data;
  if (!data.refresh_token) return null;

  try {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        client_id: DROPBOX_CLIENT_ID,
      }),
    });
    if (!response.ok) throw new Error('토큰 갱신 실패');
    const fresh = await response.json();
    const updated = { ...data, access_token: fresh.access_token, expires_at: Date.now() + fresh.expires_in * 1000 };
    writeJSON(KEYS.dropbox, updated);
    return updated;
  } catch (error) {
    console.error('Dropbox 토큰 갱신 실패:', error);
    return null;
  }
}

export function updateDropboxPrefs(prefs: Partial<Pick<DropboxData, 'autoUpload' | 'manualUpload'>>) {
  const data = read();
  if (data) writeJSON(KEYS.dropbox, { ...data, ...prefs });
}

export function disconnectDropbox() {
  localStorage.removeItem(KEYS.dropbox);
}

// ========== 저장 폴더 ==========
export function loadFolderPrefs() {
  return {
    folderPath: localStorage.getItem(KEYS.dropboxFolder) || DEFAULT_FOLDER,
    dateFolder: localStorage.getItem(KEYS.dropboxDateFolder) !== 'false', // 기본 true
  };
}

export function saveFolderPrefs(folderPath: string, dateFolder: boolean) {
  localStorage.setItem(KEYS.dropboxFolder, folderPath.trim() || DEFAULT_FOLDER);
  localStorage.setItem(KEYS.dropboxDateFolder, String(dateFolder));
}

/** 저장 경로: 설정 폴더 + (표의 일자 기준) 연/월 하위 폴더 */
export function getDropboxFolder(dateField: string, prefs = loadFolderPrefs()) {
  let folderPath = prefs.folderPath;
  if (!folderPath.startsWith('/')) folderPath = '/' + folderPath;

  if (prefs.dateFolder) {
    const match = dateField.match(/(\d{4})년 (\d{2})월/);
    if (match) {
      folderPath = `${folderPath}/${match[1]}/${match[2]}`;
    } else {
      const today = new Date();
      folderPath = `${folderPath}/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return folderPath.replace(/\/+$/, '');
}

export type UploadProgress = { percent: number; loadedMB: string; totalMB: string };

/** 진행률 표시 + 30초간 진행 없으면 중단 + 취소 가능 */
export async function uploadToDropbox(
  blob: Blob,
  fileName: string,
  dateField: string,
  opts: { onProgress: (p: UploadProgress) => void; signal: AbortSignal },
) {
  const data = await ensureDropboxToken();
  if (!data) throw new Error('Dropbox 연결이 만료되었습니다. 설정에서 다시 연결해 주세요.');

  const safeFileName = fileName.replace(/[:*?"<>|]/g, '');
  const fullPath = `${getDropboxFolder(dateField)}/${safeFileName}`;

  // 헤더에 한글을 넣기 위해 유니코드 이스케이프
  const dropboxArg = JSON.stringify({ path: fullPath, mode: 'add', autorename: true, mute: false }).replace(
    /[\u007f-￿]/g,
    (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4),
  );

  const arrayBuffer = await blob.arrayBuffer().catch(() => {
    throw new Error('파일 읽기 실패 (I/O Error). 다시 시도해 주세요.');
  });

  return new Promise<{ path_display: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastProgressTime = Date.now();
    const stallCheck = setInterval(() => {
      if (Date.now() - lastProgressTime > 30000) {
        clearInterval(stallCheck);
        xhr.abort();
        reject(new Error('업로드가 30초 동안 진행되지 않아 중단했습니다.'));
      }
    }, 1000);
    const cleanup = () => {
      clearInterval(stallCheck);
      opts.signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => xhr.abort();
    opts.signal.addEventListener('abort', onAbort);

    xhr.open('POST', 'https://content.dropboxapi.com/2/files/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + data.access_token);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Dropbox-API-Arg', dropboxArg);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      lastProgressTime = Date.now();
      opts.onProgress({
        percent: Math.round((event.loaded / event.total) * 100),
        loadedMB: (event.loaded / 1048576).toFixed(1),
        totalMB: (event.total / 1048576).toFixed(1),
      });
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`서버 응답 오류 (${xhr.status}): ${xhr.responseText}`));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('네트워크 연결이 끊겼습니다.'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('업로드를 취소했습니다.'));
    };
    xhr.send(arrayBuffer);
  });
}

export function openDropboxHome() {
  window.open('https://www.dropbox.com/home', '_blank');
}
