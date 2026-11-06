import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Templates } from '../lib/storage';
import { Button } from './ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Templates;
  current: string;
  onLoad: (name: string) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
};

export function TemplateSheet({ open, onOpenChange, templates, current, onLoad, onSave, onDelete }: Props) {
  const [name, setName] = useState(current);
  useEffect(() => {
    if (open) setName(current);
  }, [open, current]);

  const names = Object.keys(templates);
  const trimmed = name.trim();
  const overwriting = trimmed !== '' && trimmed in templates;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-[22px] bg-surface outline-none">
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          <div className="px-5 pt-4 pb-3">
            <Drawer.Title className="text-[20px] font-bold">템플릿</Drawer.Title>
            <Drawer.Description className="mt-1 text-[14px] text-muted">
              현장마다 자주 쓰는 표 내용을 저장해 두고 불러옵니다.
            </Drawer.Description>
          </div>

          <form
            className="flex gap-2 px-5 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(trimmed);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="템플릿 이름 (예: 강남 A현장)"
              enterKeyHint="done"
              className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-raised px-3.5 outline-none focus:border-accent"
            />
            <Button type="submit" variant="primary" className="shrink-0 px-5" disabled={!trimmed}>
              {overwriting ? '덮어쓰기' : '저장'}
            </Button>
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-line pb-safe">
            {names.length === 0 ? (
              <p className="px-5 py-10 text-center text-[15px] leading-relaxed text-muted">
                저장한 템플릿이 없습니다.
                <br />
                이름을 적고 저장하면 지금 표 내용이 템플릿이 됩니다.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {names.map((n) => {
                  const active = n === current;
                  const summary = templates[n]
                    ?.filter((f, i) => i !== 2 && f.v)
                    .map((f) => f.v)
                    .join(', ');
                  return (
                    <li key={n} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onLoad(n)}
                        className={clsx('flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left active:bg-raised')}
                      >
                        <span
                          className={clsx(
                            'grid size-6 shrink-0 place-items-center rounded-full',
                            active ? 'bg-accent text-accent-ink' : 'border border-line',
                          )}
                        >
                          {active && <Check className="size-4" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[16px] font-semibold">{n}</span>
                          {summary && <span className="block truncate text-[13px] text-muted">{summary}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`${n} 삭제`}
                        onClick={() => onDelete(n)}
                        className="grid size-14 shrink-0 place-items-center text-muted active:text-danger"
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
