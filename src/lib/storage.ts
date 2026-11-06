// 기존 버전과 같은 localStorage 키를 그대로 사용 (템플릿/설정 호환)
export const KEYS = {
  templates: 'photo_pro_v8_final',
  theme: 'photo_pro_theme',
  dropbox: 'photo_pro_dropbox',
  tableSize: 'photo_pro_table_size',
  dropboxFolder: 'dropbox_folder_path',
  dropboxDateFolder: 'dropbox_date_folder',
  dropboxVerifier: 'dropbox_code_verifier',
} as const;

export type Field = { k: string; v: string };
export type Templates = Record<string, Field[]>;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadTemplates(): Templates {
  return readJSON<Templates>(KEYS.templates, {});
}

export function saveTemplates(t: Templates) {
  writeJSON(KEYS.templates, t);
}
