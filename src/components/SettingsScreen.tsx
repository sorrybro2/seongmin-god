import { useRef } from 'react';
import { ChevronLeft, Download, RefreshCw, Upload } from 'lucide-react';
import clsx from 'clsx';
import type { DropboxData } from '../lib/dropbox';
import { Button, Row, Section, Slider, Switch } from './ui';

type Props = {
  onBack: () => void;
  tableSize: number;
  onTableSize: (v: number) => void;
  theme: 'dark' | 'light';
  onTheme: (t: 'dark' | 'light') => void;
  dropbox: DropboxData | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onDropboxPrefs: (p: { autoUpload?: boolean; manualUpload?: boolean }) => void;
  folderPath: string;
  dateFolder: boolean;
  folderExample: string;
  onFolder: (folderPath: string, dateFolder: boolean) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUpdateApp: () => void;
};

export function SettingsScreen(p: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const connected = !!p.dropbox;

  return (
    <div className="screen-in min-h-dvh">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 backdrop-blur-md">
        <div className="relative flex h-14 items-center justify-center px-2">
          <button
            type="button"
            onClick={p.onBack}
            className="absolute left-1 flex h-11 items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-medium active:bg-raised"
          >
            <ChevronLeft className="size-6" />
            뒤로
          </button>
          <h1 className="text-[17px] font-bold">설정</h1>
        </div>
      </header>

      <main className="px-4 pt-3 pb-safe">
        <Section title="사진에 넣는 표" footer="사진 크기에 맞춰 표가 그려집니다. 글자가 작게 보이면 키워 주세요.">
          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[16px]">표 크기</span>
              <span className="text-[17px] font-bold tabular-nums">{p.tableSize}%</span>
            </div>
            <Slider min={50} max={150} step={1} value={[p.tableSize]} onValueChange={([v]) => p.onTableSize(v)} />
            <div className="flex justify-between text-[12px] text-muted tabular-nums">
              <span>50%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>
        </Section>

        <Section
          title="Dropbox 백업"
          footer="연결하지 않아도 사진은 항상 휴대폰에 저장됩니다. 연결하면 Dropbox에도 함께 올릴 수 있습니다."
        >
          <Row
            label={
              <span className="flex items-center gap-2">
                <span className={clsx('size-2.5 rounded-full', connected ? 'bg-ok' : 'bg-line')} aria-hidden />
                {connected ? '연결됨' : '연결 안 됨'}
              </span>
            }
            hint={connected ? p.dropbox?.email : undefined}
          >
            {connected ? (
              <Button variant="danger" className="min-h-10 px-3 text-[15px]" onClick={p.onDisconnect}>
                연결 해제
              </Button>
            ) : (
              <Button variant="primary" className="min-h-10 px-3 text-[15px]" onClick={p.onConnect}>
                계정 연결
              </Button>
            )}
          </Row>
          <Row label="자동 업로드" hint="사진을 만들면 Dropbox에도 올립니다">
            <Switch
              checked={connected && !!p.dropbox?.autoUpload}
              disabled={!connected}
              onCheckedChange={(v) => p.onDropboxPrefs({ autoUpload: v })}
              aria-label="자동 업로드"
            />
          </Row>
          <Row label="올리기 전에 확인" hint="버튼을 눌러야 업로드합니다">
            <Switch
              checked={connected && !!p.dropbox?.manualUpload}
              disabled={!connected || !p.dropbox?.autoUpload}
              onCheckedChange={(v) => p.onDropboxPrefs({ manualUpload: v })}
              aria-label="올리기 전에 확인"
            />
          </Row>
          <div className="px-4 py-3">
            <label htmlFor="folderPath" className="text-[16px]">
              저장 폴더
            </label>
            <input
              id="folderPath"
              key={p.folderPath}
              defaultValue={p.folderPath}
              placeholder="/현장사진"
              onBlur={(e) => p.onFolder(e.target.value, p.dateFolder)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              enterKeyHint="done"
              className="mt-2 h-12 w-full rounded-xl border border-line bg-raised px-3.5 outline-none focus:border-accent"
            />
          </div>
          <Row label="날짜별 폴더로 나누기" hint={p.folderExample}>
            <Switch
              checked={p.dateFolder}
              onCheckedChange={(v) => p.onFolder(p.folderPath, v)}
              aria-label="날짜별 폴더로 나누기"
            />
          </Row>
        </Section>

        <Section title="화면">
          <Row label="다크 모드">
            <Switch
              checked={p.theme === 'dark'}
              onCheckedChange={(v) => p.onTheme(v ? 'dark' : 'light')}
              aria-label="다크 모드"
            />
          </Row>
        </Section>

        <Section title="템플릿 백업" footer="휴대폰을 바꾸거나 다른 사람과 템플릿을 나눌 때 JSON 파일로 옮깁니다.">
          <button type="button" onClick={p.onExport} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[16px] active:bg-raised">
            <Download className="size-5 text-muted" />
            파일로 내보내기
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[16px] active:bg-raised"
          >
            <Upload className="size-5 text-muted" />
            파일에서 가져오기
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) p.onImport(f);
            }}
          />
        </Section>

        <Section title="앱" footer="화면이 이상하거나 최신 버전이 안 보일 때 눌러 주세요.">
          <button type="button" onClick={p.onUpdateApp} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[16px] active:bg-raised">
            <RefreshCw className="size-5 text-muted" />
            최신 버전으로 새로고침
          </button>
        </Section>
      </main>
    </div>
  );
}
