import { CircleAlert, CircleCheck, CloudUpload, ExternalLink, FolderOpen } from 'lucide-react';
import { Button } from './ui';
import { filesAppLabel } from '../lib/device';

export type Job =
  | { phase: 'idle' }
  | { phase: 'sorting' }
  | { phase: 'processing'; current: number; total: number }
  | { phase: 'zipping' }
  | { phase: 'uploading'; percent: number; loadedMB: string; totalMB: string }
  | { phase: 'done'; fileName: string; uploaded: boolean; canUpload: boolean; uploadError?: string }
  | { phase: 'error'; message: string };

export const isBusy = (job: Job) =>
  job.phase === 'sorting' || job.phase === 'processing' || job.phase === 'zipping' || job.phase === 'uploading';

function Progress({ value }: { value?: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      {value === undefined ? (
        <div className="h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      ) : (
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${value}%` }} />
      )}
    </div>
  );
}

type Props = {
  job: Job;
  onOpenFiles: () => void;
  onUpload: () => void;
  onCancelUpload: () => void;
  onOpenDropbox: () => void;
};

export function JobPanel({ job, onOpenFiles, onUpload, onCancelUpload, onOpenDropbox }: Props) {
  if (job.phase === 'idle') return null;

  if (job.phase === 'error') {
    return (
      <div className="mt-5 flex gap-3 rounded-2xl bg-surface p-4" role="alert">
        <CircleAlert className="mt-0.5 size-6 shrink-0 text-danger" />
        <div>
          <p className="text-[16px] font-semibold">사진을 만들지 못했습니다</p>
          <p className="mt-1 text-[14px] break-all text-muted">{job.message}</p>
        </div>
      </div>
    );
  }

  if (job.phase === 'done') {
    return (
      <div className="mt-5 rounded-2xl bg-surface p-4" role="status">
        <div className="flex gap-3">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{job.uploaded ? '저장하고 Dropbox에도 올렸습니다' : '휴대폰에 저장했습니다'}</p>
            <p className="mt-1 text-[14px] break-all text-muted">{job.fileName}</p>
            {job.uploadError && <p className="mt-2 text-[14px] break-all text-danger">Dropbox 업로드 실패: {job.uploadError}</p>}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {job.canUpload && !job.uploaded && (
            <Button variant="primary" onClick={onUpload}>
              <CloudUpload className="size-5" />
              Dropbox에 업로드
            </Button>
          )}
          <Button onClick={onOpenFiles}>
            <FolderOpen className="size-5" />
            {filesAppLabel}
          </Button>
          {job.uploaded && (
            <Button onClick={onOpenDropbox}>
              <ExternalLink className="size-5" />
              Dropbox에서 보기
            </Button>
          )}
        </div>
      </div>
    );
  }

  let title = '';
  let detail = '';
  let value: number | undefined;
  if (job.phase === 'sorting') {
    title = '촬영 시간순으로 정렬하는 중';
  } else if (job.phase === 'processing') {
    title = '사진에 표 넣는 중';
    detail = `${job.current} / ${job.total}장`;
    value = ((job.current - 1) / job.total) * 100;
  } else if (job.phase === 'zipping') {
    title = '압축 파일 만드는 중';
  } else {
    title = 'Dropbox에 올리는 중';
    detail = `${job.percent}%  ${job.loadedMB}MB / ${job.totalMB}MB`;
    value = job.percent;
  }

  return (
    <div className="mt-5 rounded-2xl bg-surface p-4" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px] font-semibold">{title}</p>
        {detail && <p className="shrink-0 text-[14px] text-muted tabular-nums">{detail}</p>}
      </div>
      <Progress value={value} />
      <p className="mt-2.5 text-[13px] text-muted">끝날 때까지 이 화면을 닫지 마세요.</p>
      {job.phase === 'uploading' && (
        <Button variant="danger" className="mt-3 w-full" onClick={onCancelUpload}>
          업로드 취소
        </Button>
      )}
    </div>
  );
}
