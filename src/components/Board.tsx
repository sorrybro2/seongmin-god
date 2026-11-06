import { useRef } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import type { Field } from '../lib/storage';
import { DATE_ROW, isoToKorean, koreanToISO } from '../lib/date';
import {
  INSPECTOR_ROW,
  INSPECTORS,
  SAMPLE_ROW,
  SAMPLE_TYPES,
  TYPE_ROW,
  composeSample,
  prefixForType,
  sampleDigits,
} from '../lib/fields';

/** 입력 중인 칸은 노랑을 옅게 깔아서 표시 */
const cellFocus = 'focus-within:bg-accent/15';

/** 표 안 선택 버튼: 고르면 노랑, 아니면 옅은 회색 */
function Pick({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: string; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'h-10 rounded-lg text-[16px] font-semibold transition-colors',
        active ? 'bg-accent text-accent-ink shadow-[0_1px_3px_rgba(0,0,0,0.18)]' : 'bg-pick text-board-ink ring-1 ring-board-line ring-inset shadow-[0_1px_2px_rgba(0,0,0,0.08)] active:bg-board-key',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * 사진 왼쪽 아래에 찍힐 표의 내용을 입력하는 카드.
 * 줄 구성은 사진 속 표와 같고, 색은 앱 테마를 따른다.
 */
export function Board({ fields, onChange }: { fields: Field[]; onChange: (next: Field[]) => void }) {
  const set = (i: number, patch: Partial<Field>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const sampleInput = useRef<HTMLInputElement>(null);
  const samplePrefix = prefixForType(fields[TYPE_ROW]?.v ?? '');

  /** 채취구분을 고르면 시료번호 앞자리를 맞추고, 숫자가 비어 있으면 바로 숫자 입력으로 넘어간다 */
  function pickType(type: string) {
    const digits = sampleDigits(fields[SAMPLE_ROW].v);
    onChange(
      fields.map((f, j) =>
        j === TYPE_ROW ? { ...f, v: type } : j === SAMPLE_ROW ? { ...f, v: composeSample(prefixForType(type), digits) } : f,
      ),
    );
    const input = sampleInput.current;
    if (input && !digits) {
      input.readOnly = false; // 탭한 그 순간에 포커스해야 휴대폰 키패드가 바로 뜬다
      input.focus();
    }
  }

  // 입력 화면에서는 채취구분을 시료번호 바로 위에 (사진 속 표 순서는 그대로)
  const order = fields.map((_, i) => i).filter((i) => i !== TYPE_ROW);
  order.splice(order.indexOf(SAMPLE_ROW), 0, TYPE_ROW);

  function valueCell(f: Field, i: number) {
    // 일자: 한국어 날짜를 보여주고, 탭하면 달력
    if (i === DATE_ROW) {
      return (
        <label className={clsx('relative flex min-w-0 flex-1 items-center px-3.5', cellFocus)}>
          <span className="flex-1 truncate text-[17px]">{f.v}</span>
          <CalendarDays className="size-5 shrink-0 text-board-muted" aria-hidden />
          <input
            type="date"
            aria-label={f.k || '일자'}
            value={koreanToISO(f.v)}
            onChange={(e) => e.target.value && set(i, { v: isoToKorean(e.target.value) })}
            className="absolute inset-0 h-full w-full appearance-none opacity-0"
          />
        </label>
      );
    }

    // 시료번호: 채취구분이 정한 앞자리(S- / GW-) + 숫자만
    if (i === SAMPLE_ROW) {
      const prefix = samplePrefix;
      return (
        <div className={clsx('flex min-w-0 flex-1 items-center gap-2 px-3.5', prefix && cellFocus)}>
          {prefix && <span className="shrink-0 text-[17px] font-semibold">{prefix}</span>}
          <input
            ref={sampleInput}
            aria-label={`${f.k} 숫자`}
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            readOnly={!prefix}
            tabIndex={prefix ? 0 : -1}
            value={prefix ? sampleDigits(f.v) : f.v}
            placeholder={prefix ? '숫자 입력' : '채취구분을 먼저 고르세요'}
            onChange={(e) => prefix && set(i, { v: composeSample(prefix, e.target.value.replace(/\D/g, '')) })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={clsx(
              'h-12 w-full min-w-0 bg-transparent text-[17px] outline-none placeholder:text-board-muted/80 focus-visible:outline-none',
              !prefix && 'pointer-events-none text-board-muted placeholder:text-[15px]',
            )}
          />
        </div>
      );
    }

    // 채취구분: 버튼으로 선택 → 시료번호 앞자리 자동
    if (i === TYPE_ROW) {
      return (
        <div role="group" aria-label={f.k} className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 px-2.5 py-2">
          {SAMPLE_TYPES.map((t) => (
            <Pick key={t.label} active={f.v === t.label} onClick={() => pickType(t.label)}>
              {t.label}
            </Pick>
          ))}
        </div>
      );
    }

    // 조사자: 목록에서 선택 (목록에 없는 기존 값은 지워지지 않게 그대로 보여줌)
    if (i === INSPECTOR_ROW) {
      const options = f.v && !INSPECTORS.includes(f.v) ? [f.v, ...INSPECTORS] : INSPECTORS;
      return (
        <div className={clsx('relative flex min-w-0 flex-1 items-center', cellFocus)}>
          <select
            aria-label={f.k}
            value={f.v}
            onChange={(e) => set(i, { v: e.target.value })}
            className={clsx(
              'h-full w-full min-w-0 appearance-none bg-transparent py-3 pr-10 pl-3.5 text-[17px] outline-none focus-visible:outline-none',
              !f.v && 'text-board-muted/70',
            )}
          >
            <option value="">선택</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 size-5 text-board-muted" aria-hidden />
        </div>
      );
    }

    // 그 외(공사명): 자유 입력
    return (
      <div className={clsx('relative flex min-w-0 flex-1 items-center', cellFocus)}>
        <input
          aria-label={f.k}
          value={f.v}
          placeholder={`${f.k || '내용'} 입력`}
          onChange={(e) => set(i, { v: e.target.value })}
          className="h-full w-full min-w-0 bg-transparent py-3 pr-11 pl-3.5 text-[17px] outline-none placeholder:text-board-muted/80 focus-visible:outline-none"
        />
        {f.v && (
          <button
            type="button"
            aria-label={`${f.k} 지우기`}
            onClick={() => set(i, { v: '' })}
            className="absolute right-1.5 grid size-9 place-items-center rounded-full"
          >
            <span className="grid size-5.5 place-items-center rounded-full bg-board-muted/40 text-white">
              <X className="size-3.5" strokeWidth={3} />
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-board-line overflow-hidden rounded-2xl bg-board text-board-ink scheme-light ring-1 ring-board-line shadow-[0_10px_28px_-14px_rgba(0,0,0,0.5)]">
      {order.map((i) => {
        const f = fields[i];
        return (
        <div key={i} className="flex min-h-14">
          <input
            aria-label={`${i + 1}번째 항목 이름`}
            value={f.k}
            onChange={(e) => set(i, { k: e.target.value })}
            className="w-23 shrink-0 bg-board-key px-3.5 text-[15px] font-medium text-board-muted outline-none focus:bg-accent/15 focus:text-board-ink focus-visible:outline-none"
          />
          {valueCell(f, i)}
        </div>
        );
      })}
    </div>
  );
}
