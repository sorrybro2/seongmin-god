import { useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { Camera, ChevronDown, FileArchive, Settings, X } from 'lucide-react';
import { Board } from './components/Board';
import { TemplateSheet } from './components/TemplateSheet';
import { SettingsScreen } from './components/SettingsScreen';
import { JobPanel, isBusy, type Job } from './components/JobPanel';
import { Button, useAsk } from './components/ui';
import { KEYS, loadTemplates, saveTemplates, type Field, type Templates } from './lib/storage';
import { DATE_ROW, defaultFields, todayKorean, zipBaseName } from './lib/date';
import { forStamp, syncSamplePrefix } from './lib/fields';
import {
  disconnectDropbox,
  ensureDropboxToken,
  getDropboxFolder,
  handleDropboxCallback,
  hasOAuthCallback,
  loadFolderPrefs,
  openDropboxHome,
  saveFolderPrefs,
  startDropboxLogin,
  updateDropboxPrefs,
  uploadToDropbox,
  type DropboxData,
} from './lib/dropbox';
import { downloadText, openFilesApp, saveToLocal } from './lib/device';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function App() {
  const ask = useAsk();
  const [screen, setScreen] = useState<'main' | 'settings'>('main');

  const [fields, setFields] = useState<Field[]>(defaultFields);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<Templates>(loadTemplates);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [tableSize, setTableSize] = useState(() => parseInt(localStorage.getItem(KEYS.tableSize) || '') || 100);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(KEYS.theme) === 'light' ? 'light' : 'dark'));
  const [dropbox, setDropbox] = useState<DropboxData | null>(null);
  const [folder, setFolder] = useState(loadFolderPrefs);

  const [job, setJob] = useState<Job>({ phase: 'idle' });
  const zipRef = useRef<{ blob: Blob; fileName: string; dateField: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const booted = useRef(false);

  // ========== 테마 ==========
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'light' ? '#E9ECEF' : '#101214');
    localStorage.setItem(KEYS.theme, theme);
  }, [theme]);

  // ========== Dropbox 로그인 복귀 처리 + 토큰 로드 ==========
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      if (hasOAuthCallback()) {
        const id = toast.loading('Dropbox 연결 중');
        try {
          const data = await handleDropboxCallback();
          if (data) toast.success(`Dropbox에 연결했습니다 (${data.email})`, { id });
          else toast.dismiss(id);
        } catch (e) {
          toast.error(`Dropbox 연결 실패: ${errMsg(e)}`, { id });
        }
      }
      setDropbox(await ensureDropboxToken());
    })();
  }, []);

  // ========== 사진 처리 ==========
  async function upload(z: NonNullable<typeof zipRef.current>) {
    const ac = new AbortController();
    abortRef.current = ac;
    setJob({ phase: 'uploading', percent: 0, loadedMB: '0.0', totalMB: (z.blob.size / 1048576).toFixed(1) });
    try {
      await uploadToDropbox(z.blob, z.fileName, z.dateField, {
        signal: ac.signal,
        onProgress: (p) => setJob({ phase: 'uploading', ...p }),
      });
    } finally {
      abortRef.current = null;
    }
  }

  async function run(files: File[]) {
    const snapshot = forStamp(fields).map((f) => ({ ...f })); // 앞자리만 있는 시료번호("S-")는 빈 값으로
    zipRef.current = null;
    try {
      setJob({ phase: 'sorting' });
      const { buildZip } = await import('./lib/image'); // 사진 처리 라이브러리는 필요할 때만 로드
      const { blob, fileName } = await buildZip(files, snapshot, templateName, tableSize, (p) => setJob(p));
      const z = { blob, fileName, dateField: snapshot[DATE_ROW].v };
      zipRef.current = z;

      const useDropbox = !!dropbox?.autoUpload;
      let uploaded = false;
      let uploadError: string | undefined;
      if (useDropbox && !dropbox?.manualUpload) {
        try {
          await upload(z);
          uploaded = true;
        } catch (e) {
          uploadError = errMsg(e);
        }
      }

      saveToLocal(blob, fileName); // 업로드가 끝난 뒤 휴대폰에 저장
      setJob({ phase: 'done', fileName, uploaded, canUpload: useDropbox, uploadError });
    } catch (e) {
      console.error(e);
      setJob({ phase: 'error', message: errMsg(e) });
    }
  }

  async function manualUpload() {
    const z = zipRef.current;
    if (!z || job.phase !== 'done') return;
    const prev = job;
    try {
      await upload(z);
      setJob({ ...prev, uploaded: true, uploadError: undefined });
      toast.success('Dropbox에 올렸습니다');
    } catch (e) {
      setJob({ ...prev, uploadError: errMsg(e) });
    }
  }

  // ========== 템플릿 ==========
  function commitTemplates(next: Templates) {
    saveTemplates(next);
    setTemplates(next);
  }

  function loadTemplate(name: string) {
    const t = templates[name];
    if (!t) return;
    const next = t.map((f) => ({ ...f }));
    if (next[DATE_ROW]) next[DATE_ROW].v = todayKorean();
    setFields(syncSamplePrefix(next)); // 채취구분과 시료번호 앞자리가 어긋나 있으면 맞춤
    setTemplateName(name);
    setSheetOpen(false);
  }

  async function saveTemplate(name: string) {
    if (!name) return toast.error('템플릿 이름을 입력하세요');
    if (name in templates && name !== templateName) {
      const ok = await ask({ title: `'${name}' 템플릿을 덮어쓸까요?`, description: '지금 표 내용으로 바뀝니다.', confirmText: '덮어쓰기' });
      if (!ok) return;
    }
    commitTemplates({ ...templates, [name]: fields.map((f) => ({ ...f })) });
    setTemplateName(name);
    toast.success(`'${name}' 템플릿을 저장했습니다`);
  }

  async function deleteTemplate(name: string) {
    const ok = await ask({ title: `'${name}' 템플릿을 삭제할까요?`, confirmText: '삭제', destructive: true });
    if (!ok) return;
    const next = { ...templates };
    delete next[name];
    commitTemplates(next);
    if (templateName === name) setTemplateName('');
  }

  function exportTemplates() {
    if (Object.keys(templates).length === 0) return toast.error('저장한 템플릿이 없습니다');
    downloadText(localStorage.getItem(KEYS.templates) || '{}', 'photo_pro_templates.json');
    toast.success('템플릿을 내보냈습니다');
  }

  async function importTemplates(file: File) {
    let imported: Templates;
    try {
      imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error();
    } catch {
      return toast.error('템플릿 파일이 아닙니다. 내보내기로 만든 JSON 파일을 골라 주세요.');
    }
    const count = Object.keys(templates).length;
    let merge = true;
    if (count > 0) {
      const r = await ask({
        title: '템플릿 가져오기',
        description: `이미 템플릿 ${count}개가 있습니다.`,
        confirmText: '기존 템플릿과 합치기',
        altText: '기존 템플릿 지우고 가져오기',
      });
      if (!r) return;
      merge = r === 'confirm';
    }
    commitTemplates(merge ? { ...templates, ...imported } : imported);
    toast.success(`템플릿 ${Object.keys(imported).length}개를 가져왔습니다`);
  }

  // ========== 설정 ==========
  function changeTableSize(v: number) {
    setTableSize(v);
    localStorage.setItem(KEYS.tableSize, String(v));
  }

  function changeDropboxPrefs(p: { autoUpload?: boolean; manualUpload?: boolean }) {
    updateDropboxPrefs(p);
    setDropbox((d) => (d ? { ...d, ...p } : d));
  }

  async function disconnect() {
    const ok = await ask({ title: 'Dropbox 연결을 해제할까요?', confirmText: '연결 해제', destructive: true });
    if (!ok) return;
    disconnectDropbox();
    setDropbox(null);
    toast.success('연결을 해제했습니다');
  }

  function changeFolder(folderPath: string, dateFolder: boolean) {
    saveFolderPrefs(folderPath, dateFolder);
    setFolder(loadFolderPrefs());
  }

  async function updateApp() {
    const ok = await ask({ title: '최신 버전으로 새로고침할까요?', description: '저장한 템플릿과 설정은 그대로 남습니다.', confirmText: '새로고침' });
    if (!ok) return;
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    window.location.reload();
  }

  const busy = isBusy(job);

  return (
    <>
      {screen === 'settings' ? renderSettings() : renderMain()}
      <Toaster
        position="top-center"
        theme={theme}
        offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        toastOptions={{ style: { fontSize: 15, fontFamily: 'inherit' } }}
      />
    </>
  );

  function renderSettings() {
    return (
      <SettingsScreen
        onBack={() => setScreen('main')}
        tableSize={tableSize}
        onTableSize={changeTableSize}
        theme={theme}
        onTheme={setTheme}
        dropbox={dropbox}
        onConnect={() => startDropboxLogin().catch((e) => toast.error(`Dropbox 연결을 시작할 수 없습니다: ${errMsg(e)}`))}
        onDisconnect={disconnect}
        onDropboxPrefs={changeDropboxPrefs}
        folderPath={folder.folderPath}
        dateFolder={folder.dateFolder}
        folderExample={`${getDropboxFolder(fields[DATE_ROW].v, { ...folder, dateFolder: true })} 처럼 연·월로 나눕니다`}
        onFolder={changeFolder}
        onExport={exportTemplates}
        onImport={importTemplates}
        onUpdateApp={updateApp}
      />
    );
  }

  function renderMain() {
    return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between pr-2 pl-4">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">현장 사진 Pro</h1>
          <button
            type="button"
            aria-label="설정"
            onClick={() => setScreen('settings')}
            className="grid size-11 place-items-center rounded-full text-ink active:bg-raised"
          >
            <Settings className="size-6" />
          </button>
        </div>
      </header>

      <main className="px-4 pt-2 pb-36">
        {/* 템플릿 */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface pr-3 pl-3.5 text-left active:bg-raised"
          >
            <span className="shrink-0 text-[14px] text-muted">템플릿</span>
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{templateName || '선택 안 함'}</span>
            <ChevronDown className="size-5 shrink-0 text-muted" />
          </button>
          {templateName && (
            <button
              type="button"
              aria-label="템플릿 선택 해제"
              onClick={() => setTemplateName('')}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-muted active:bg-raised"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <Board fields={fields} onChange={setFields} />

        <div className="mt-3 flex items-start gap-2 px-1 text-[13px] leading-snug text-muted">
          <FileArchive className="mt-px size-4 shrink-0" aria-hidden />
          <p className="min-w-0 break-keep">
            <span className="font-semibold break-all text-ink">{zipBaseName(forStamp(fields), templateName)}.zip</span> 으로 저장되고, 표는 사진 왼쪽 아래에{' '}
            {tableSize}% 크기로 들어갑니다.
          </p>
        </div>

        <JobPanel
          job={job}
          onOpenFiles={() => {
            const msg = openFilesApp();
            if (msg) toast(msg);
          }}
          onUpload={manualUpload}
          onCancelUpload={() => abortRef.current?.abort()}
          onOpenDropbox={openDropboxHome}
        />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg from-60% to-transparent px-4 pt-6 pb-safe">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) run(files);
          }}
        />
        <Button
          variant="primary"
          className="h-15 w-full rounded-2xl text-[18px] font-bold shadow-[0_8px_24px_-8px_rgba(255,196,0,0.6)]"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Camera className="size-6" />
          {busy ? '만드는 중' : '사진 선택하고 만들기'}
        </Button>
      </div>

      <TemplateSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        templates={templates}
        current={templateName}
        onLoad={loadTemplate}
        onSave={saveTemplate}
        onDelete={deleteTemplate}
      />
    </div>
    );
  }
}
