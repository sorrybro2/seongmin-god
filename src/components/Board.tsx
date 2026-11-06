import { CalendarDays, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import type { Field } from '../lib/storage';
import { DATE_ROW, isoToKorean, koreanToISO } from '../lib/date';
import {
  INSPECTOR_ROW,
  INSPECTORS,
  SAMPLE_PREFIXES,
  SAMPLE_ROW,
  SAMPLE_TYPES,
  TYPE_ROW,
  splitSampleNumber,
} from '../lib/fields';

/** 입력 중인 칸은 노랑을 옅게 깔아서 표시 */
const cellFocus = 'focus-within:bg-accent/10';

/** 표 안 선택 버튼: 고르면 노랑, 아니면 옅은 회색 */
function Pick({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: string; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'h-10 rounded-lg text-[16px] font-semibold transition-colors',
        active ? 'bg-accent text-accent-ink' : 'bg-raised text-muted ring-1 ring-line ring-inset active:text-ink',
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

  function valueCell(f: Field, i: number) {
    // 일자: 한국어 날짜를 보여주고, 탭하면 달력
    if (i === DATE_ROW) {
      return (
        <label className={clsx('relative flex min-w-0 flex-1 items-center px-3.5', cellFocus)}>
          <span className="flex-1 truncate text-[17px]">{f.v}</span>
          <CalendarDays className="size-5 shrink-0 text-muted" aria-hidden />
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

    // 시료번호: 앞자리(GW- / S-) 고른 뒤 숫자만
    if (i === SAMPLE_ROW) {
      const { prefix, digits } = splitSampleNumber(f.v);
      const legacyDigits = prefix ? digits : f.v.replace(/\D/g, '');
      return (
        <div className={clsx('flex min-w-0 flex-1 items-center gap-1.5 py-2 pr-2.5 pl-2.5', cellFocus)}>
          {SAMPLE_PREFIXES.map((p) => (
            <Pick key={p} active={prefix === p} onClick={() => set(i, { v: p + legacyDigits })} className="w-[52px] shrink-0">
              {p}
            </Pick>
          ))}
          <input
            aria-label={`${f.k} 숫자`}
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={!prefix}
            value={prefix ? digits : f.v}
            placeholder={prefix ? '숫자' : '앞자리 선택'}
            onChange={(e) => set(i, { v: prefix + e.target.value.replace(/\D/g, '') })}
            className="h-10 w-full min-w-0 bg-transparent pl-1.5 text-[17px] outline-none placeholder:text-[15px] placeholder:text-muted/70 focus-visible:outline-none disabled:text-muted"
          />
        </div>
      );
    }

    // 채취구분: 버튼으로 선택
    if (i === TYPE_ROW) {
      return (
        <div role="group" aria-label={f.k} className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 px-2.5 py-2">
          {SAMPLE_TYPES.map((t) => (
            <Pick key={t} active={f.v === t} onClick={() => set(i, { v: t })}>
              {t}
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
              !f.v && 'text-muted/70',
            )}
          >
            <option value="">선택</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 size-5 text-muted" aria-hidden />
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
          className="h-full w-full min-w-0 bg-transparent py-3 pr-11 pl-3.5 text-[17px] outline-none placeholder:text-muted/70 focus-visible:outline-none"
        />
        {f.v && (
          <button
            type="button"
            aria-label={`${f.k} 지우기`}
            onClick={() => set(i, { v: '' })}
            className="absolute right-1.5 grid size-9 place-items-center rounded-full"
          >
            <span className="grid size-[22px] place-items-center rounded-full bg-muted/35 text-surface">
              <X className="size-3.5" strokeWidth={3} />
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {fields.map((f, i) => (
        <div key={i} className="flex min-h-14">
          <input
            aria-label={`${i + 1}번째 항목 이름`}
            value={f.k}
            onChange={(e) => set(i, { k: e.target.value })}
            className="w-[92px] shrink-0 bg-raised px-3.5 text-[15px] font-medium text-muted outline-none focus:bg-accent/10 focus:text-ink focus-visible:outline-none"
          />
          {valueCell(f, i)}
        </div>
      ))}
    </div>
  );
}
