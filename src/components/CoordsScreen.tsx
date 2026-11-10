import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, CircleAlert, CircleCheck, Copy, Download, FolderOpen, ImagePlus, MapPin } from 'lucide-react';
import { Button } from './ui';
import { copyText, filesAppLabel, openFilesApp, saveToLocal } from '../lib/device';
import type { PhotoCoord } from '../lib/coords'; // 타입만: 좌표 변환 라이브러리는 사진을 고를 때 로드

type State =
  | { phase: 'idle' }
  | { phase: 'reading'; total: number }
  | { phase: 'done'; items: PhotoCoord[]; fileName: string }
  | { phase: 'error'; message: string };

const m = (n: number) => n.toFixed(2);
const p2 = (n: number) => String(n).padStart(2, '0');
const fmtTime = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const isPhoto = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|heic|heif|png|tiff?|webp)$/i.test(f.name);
const canDrop = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/** 사진의 위도·경도를 TM 좌표로 바꿔 보여주고 엑셀로 저장하는 화면 */
export function CoordsScreen({ onBack }: { onBack: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const xlsx = useRef<{ blob: Blob; fileName: string } | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);
  const busy = state.phase === 'reading';

  async function run(files: File[]) {
    if (busy) return;
    const photos = files.filter(isPhoto);
    if (!photos.length) return void toast.error('사진 파일을 골라 주세요');
    xlsx.current = null;
    setState({ phase: 'reading', total: photos.length });
    try {
      const { readCoords, coordsXlsx, xlsxName } = await import('../lib/coords');
      const items = await readCoords(photos);
      let fileName = '';
      if (items.some((p) => p.x !== undefined)) {
        const blob = await coordsXlsx(items);
        fileName = xlsxName();
        xlsx.current = { blob, fileName };
        saveToLocal(blob, fileName); // 고르자마자 엑셀까지 저장 (버튼 한 번 줄이기)
      }
      setState({ phase: 'done', items, fileName });
    } catch (e) {
      console.error(e);
      setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function copy(p: PhotoCoord) {
    if (p.x === undefined || p.y === undefined) return;
    // 탭으로 나눠서, 엑셀·한글 표에 붙이면 X와 Y가 두 칸에 들어간다
    const ok = await copyText(`${m(p.x)}\t${m(p.y)}`);
    if (ok) toast.success(`복사했습니다  X ${m(p.x)}  Y ${m(p.y)}`);
    else toast.error('복사하지 못했습니다');
  }

  const drag = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      run(Array.from(e.dataTransfer.files));
    },
  };

  return (
    <div className="screen-in min-h-dvh" {...drag}>
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 backdrop-blur-md">
        <div className="relative flex h-14 items-center justify-center px-2">
          <button
            type="button"
            onClick={onBack}
            className="absolute left-1 flex h-11 items-center gap-0.5 rounded-xl pr-3 pl-1 text-[16px] font-medium active:bg-raised"
          >
            <ChevronLeft className="size-6" />
            뒤로
          </button>
          <h1 className="text-[17px] font-bold">사진 좌표</h1>
        </div>
      </header>

      <main className="px-4 pt-3 pb-36">
        {state.phase === 'idle' && <Intro />}
        {state.phase === 'reading' && <Reading total={state.total} />}
        {state.phase === 'error' && (
          <div className="flex gap-3 rounded-2xl bg-surface p-4" role="alert">
            <CircleAlert className="mt-0.5 size-6 shrink-0 text-danger" />
            <div>
              <p className="text-[16px] font-semibold">좌표를 읽지 못했습니다</p>
              <p className="mt-1 text-[14px] break-all text-muted">{state.message}</p>
            </div>
          </div>
        )}
        {state.phase === 'done' && (
          <Result
            items={state.items}
            fileName={state.fileName}
            onSaveAgain={() => xlsx.current && saveToLocal(xlsx.current.blob, xlsx.current.fileName)}
            onCopy={copy}
          />
        )}
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-bg/85 text-[18px] font-bold backdrop-blur-sm">
          여기에 놓으면 좌표를 읽습니다
        </div>
      )}

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
          <ImagePlus className="size-6" />
          {busy ? '읽는 중' : state.phase === 'done' ? '다른 사진 고르기' : '사진 고르기'}
        </Button>
      </div>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-2xl bg-surface p-5">
      <div className="grid size-12 place-items-center rounded-2xl bg-accent/20 text-accent-ink dark:text-accent">
        <MapPin className="size-6" />
      </div>
      <h2 className="mt-4 text-[19px] font-bold">사진만 넣으면 TM 좌표로</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        사진에 기록된 위도·경도를 읽어 TM 좌표로 바꾸고, 바로 엑셀 파일로 저장합니다.
      </p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-xl bg-raised px-3.5 py-3 text-[14px]">
        <dt className="text-muted">좌표계</dt>
        <dd>GRS80 TM (세계측지계)</dd>
        <dt className="text-muted">원점</dt>
        <dd>찍은 위치에 맞춰 자동 (수도권·충청은 중부원점)</dd>
        <dt className="text-muted">방향</dt>
        <dd>X는 북쪽, Y는 동쪽 값</dd>
      </dl>
      {canDrop && <p className="mt-3 text-[13px] text-muted">사진 파일을 이 화면에 끌어다 놓아도 됩니다.</p>}
    </div>
  );
}

function Reading({ total }: { total: number }) {
  return (
    <div className="rounded-2xl bg-surface p-4" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px] font-semibold">사진에서 위치 읽는 중</p>
        <p className="shrink-0 text-[14px] text-muted tabular-nums">{total}장</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar">
        <div className="h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
    </div>
  );
}

function Result({
  items,
  fileName,
  onSaveAgain,
  onCopy,
}: {
  items: PhotoCoord[];
  fileName: string;
  onSaveAgain: () => void;
  onCopy: (p: PhotoCoord) => void;
}) {
  const found = items.filter((p) => p.x !== undefined);
  const skipped = items.length - found.length;
  const noGps = items.some((p) => p.problem === '위치 정보 없음');
  const origins = [...new Set(found.map((p) => p.origin!.name))];

  return (
    <>
      <div className="rounded-2xl bg-surface p-4" role="status">
        <div className="flex gap-3">
          {found.length ? (
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok" />
          ) : (
            <CircleAlert className="mt-0.5 size-6 shrink-0 text-danger" />
          )}
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{found.length ? '엑셀로 저장했습니다' : '위치 정보가 있는 사진이 없습니다'}</p>
            {fileName && <p className="mt-1 text-[14px] break-all text-muted">{fileName}</p>}
            <p className="mt-1 text-[14px] text-muted">
              {items.length}장 중 {found.length}장 좌표 확인
              {skipped > 0 && <span className="text-danger"> · {skipped}장 좌표 없음</span>}
              {origins.length === 1 && ` · ${origins[0]}`}
            </p>
          </div>
        </div>

        {noGps && (
          <p className="mt-3 rounded-xl bg-raised px-3.5 py-3 text-[14px] leading-relaxed text-muted">
            휴대폰 사진첩에서 고르면 위치 정보가 지워진 채로 올 수 있습니다. 그럴 땐 <b className="text-ink">파일</b>에서 고르거나 PC에서
            사진을 넣어 주세요. 카카오톡으로 받은 사진, 위치 기록을 끄고 찍은 사진에도 위치가 없습니다.
          </p>
        )}

        {found.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={onSaveAgain}>
              <Download className="size-5" />
              다시 저장
            </Button>
            <Button
              onClick={() => {
                const msg = openFilesApp();
                if (msg) toast(msg);
              }}
            >
              <FolderOpen className="size-5" />
              {filesAppLabel}
            </Button>
          </div>
        )}
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {items.map((p, i) => (
          <li key={i} className="flex min-h-16 items-center gap-2 py-3 pr-1.5 pl-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate text-[15px] font-semibold">{p.sample || p.file}</span>
                {p.taken && <span className="shrink-0 text-[13px] text-muted tabular-nums">{fmtTime(p.taken)}</span>}
                {origins.length > 1 && p.origin && <span className="shrink-0 text-[13px] text-muted">{p.origin.name}</span>}
              </div>
              {p.x !== undefined && p.y !== undefined ? (
                <div className="mt-1 flex flex-wrap gap-x-4 text-[16px] tabular-nums">
                  <span>
                    <span className="mr-1.5 text-[13px] font-semibold text-muted">X</span>
                    {m(p.x)}
                  </span>
                  <span>
                    <span className="mr-1.5 text-[13px] font-semibold text-muted">Y</span>
                    {m(p.y)}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-[14px] text-danger">{p.problem}</div>
              )}
              {p.sample && <div className="mt-0.5 truncate text-[12px] text-muted">{p.file}</div>}
            </div>
            {p.x !== undefined && (
              <button
                type="button"
                aria-label={`${p.sample || p.file} 좌표 복사`}
                onClick={() => onCopy(p)}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
              >
                <Copy className="size-5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
