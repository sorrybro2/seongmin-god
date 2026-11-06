import { CalendarDays, X } from 'lucide-react';
import type { Field } from '../lib/storage';
import { DATE_ROW, isoToKorean, koreanToISO } from '../lib/date';

/**
 * 사진 왼쪽 아래에 찍히는 표를 그대로 본뜬 입력판.
 * 흰 바탕 + 검은 괘선 + 같은 글꼴이라 보이는 그대로 사진에 들어간다.
 */
export function Board({ fields, onChange }: { fields: Field[]; onChange: (next: Field[]) => void }) {
  const set = (i: number, patch: Partial<Field>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="overflow-hidden rounded-[3px] border-2 border-black bg-white font-board text-black shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]">
      {fields.map((f, i) => (
        <div key={i} className="flex min-h-[54px] border-b border-black last:border-b-0">
          <input
            aria-label={`${i + 1}번째 항목 이름`}
            value={f.k}
            onChange={(e) => set(i, { k: e.target.value })}
            className="w-[96px] shrink-0 border-r border-black bg-white px-3 text-[16px] outline-none focus:bg-[#fff3c4] focus-visible:outline-none"
          />
          {i === DATE_ROW ? (
            <label className="relative flex min-w-0 flex-1 items-center px-3 focus-within:bg-[#fff3c4]">
              <span className="flex-1 truncate text-[17px]">{f.v}</span>
              <CalendarDays className="size-5 shrink-0 text-neutral-500" aria-hidden />
              <input
                type="date"
                aria-label={f.k || '일자'}
                value={koreanToISO(f.v)}
                onChange={(e) => e.target.value && set(i, { v: isoToKorean(e.target.value) })}
                className="absolute inset-0 h-full w-full appearance-none opacity-0"
              />
            </label>
          ) : (
            <div className="relative flex min-w-0 flex-1 items-center focus-within:bg-[#fff3c4]">
              <input
                aria-label={f.k}
                value={f.v}
                placeholder={`${f.k || '내용'} 입력`}
                onChange={(e) => set(i, { v: e.target.value })}
                className="h-full w-full min-w-0 bg-transparent py-3 pr-11 pl-3 text-[17px] outline-none placeholder:text-neutral-400 focus-visible:outline-none"
              />
              {f.v && (
                <button
                  type="button"
                  aria-label={`${f.k} 지우기`}
                  onClick={() => set(i, { v: '' })}
                  className="absolute right-1.5 grid size-9 place-items-center rounded-full text-neutral-400 active:text-neutral-700"
                >
                  <span className="grid size-[22px] place-items-center rounded-full bg-neutral-300 text-white">
                    <X className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
