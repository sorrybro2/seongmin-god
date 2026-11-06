import { createContext, useCallback, useContext, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import clsx from 'clsx';

// ========== Button ==========
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink active:bg-accent-press',
  secondary: 'bg-raised text-ink border border-line active:brightness-95',
  danger: 'bg-raised text-danger border border-line active:brightness-95',
  ghost: 'text-ink active:bg-raised',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[16px] font-semibold transition-[filter,background-color] select-none disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

// ========== Switch ==========
export function Switch(props: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent disabled:opacity-40"
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[27px] translate-x-[2px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

// ========== Slider ==========
export function Slider(props: SliderPrimitive.SliderProps) {
  return (
    <SliderPrimitive.Root className="relative flex h-10 w-full touch-none items-center select-none" {...props}>
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label="표 크기"
        className="block size-7 rounded-full border-2 border-accent bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
      />
    </SliderPrimitive.Root>
  );
}

// ========== 설정 화면용 그룹 리스트 ==========
export function Section({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-4 text-[13px] font-semibold text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</div>
      {footer && <p className="mt-2 px-4 text-[13px] leading-relaxed text-muted">{footer}</p>}
    </section>
  );
}

export function Row({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex min-h-14 items-center gap-3 px-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <div className="text-[16px]">{label}</div>
        {hint && <div className="mt-0.5 text-[13px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

// ========== 확인창 (Promise 기반) ==========
type AskOptions = {
  title: string;
  description?: ReactNode;
  confirmText: string;
  /** 두 번째 선택지 (예: 덮어쓰기) */
  altText?: string;
  cancelText?: string;
  destructive?: boolean;
};
type AskResult = 'confirm' | 'alt' | null;

const AskContext = createContext<(o: AskOptions) => Promise<AskResult>>(async () => null);
export const useAsk = () => useContext(AskContext);

export function AskProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<AskOptions | null>(null);
  const resolver = useRef<(r: AskResult) => void>(undefined);

  const ask = useCallback(
    (o: AskOptions) =>
      new Promise<AskResult>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const close = (r: AskResult) => {
    resolver.current?.(r);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <AskContext.Provider value={ask}>
      {children}
      <AlertDialog.Root open={!!opts} onOpenChange={(o) => !o && close(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-2xl">
            <AlertDialog.Title className="text-[18px] font-bold">{opts?.title}</AlertDialog.Title>
            {opts?.description ? (
              <AlertDialog.Description className="mt-2 text-[15px] leading-relaxed text-muted">
                {opts.description}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{opts?.title}</AlertDialog.Description>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <AlertDialog.Action asChild>
                <Button variant={opts?.destructive ? 'danger' : 'primary'} onClick={() => close('confirm')}>
                  {opts?.confirmText}
                </Button>
              </AlertDialog.Action>
              {opts?.altText && (
                <Button variant="danger" onClick={() => close('alt')}>
                  {opts.altText}
                </Button>
              )}
              <AlertDialog.Cancel asChild>
                <Button variant="ghost" onClick={() => close(null)}>
                  {opts?.cancelText ?? '취소'}
                </Button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </AskContext.Provider>
  );
}
