import type { Field } from './storage';

/**
 * 표의 각 줄에서 고를 수 있는 값들. 사람이나 항목이 바뀌면 여기만 고치면 된다.
 * 줄 번호는 0부터: 공사명(0) / 시료번호(1) / 일자(2) / 채취구분(3) / 조사자(4)
 * (사진에 찍히는 표의 순서. 입력 화면에서는 채취구분을 시료번호 위에 보여준다)
 */
export const SAMPLE_ROW = 1;
export const TYPE_ROW = 3;
export const INSPECTOR_ROW = 4;

/** 채취구분 → 시료번호 앞자리 */
export const SAMPLE_TYPES = [
  { label: '토양', prefix: 'S-' },
  { label: '지하수', prefix: 'GW-' },
];

/** 조사자 */
export const INSPECTORS = ['유성민', '김병수', '이동형', '유미애'];

const PREFIXES = SAMPLE_TYPES.map((t) => t.prefix);

export const prefixForType = (type: string) => SAMPLE_TYPES.find((t) => t.label === type)?.prefix ?? '';

/** "GW-12" → "12", 형식이 달라도 숫자만 뽑는다 ("BH-3" → "3") */
export function sampleDigits(value: string) {
  const p = PREFIXES.find((x) => value.startsWith(x));
  return (p ? value.slice(p.length) : value).replace(/\D/g, '');
}

/** 앞자리 + 숫자. 숫자가 없으면 빈 값 (사진에 "S-"만 찍히지 않게) */
export const composeSample = (prefix: string, digits: string) => (digits ? prefix + digits : '');

/** 채취구분에 맞게 시료번호 앞자리를 맞춘다 (템플릿 불러올 때 등) */
export function syncSamplePrefix(fields: Field[]): Field[] {
  const prefix = prefixForType(fields[TYPE_ROW]?.v ?? '');
  if (!prefix || !fields[SAMPLE_ROW]) return fields;
  return fields.map((f, i) => (i === SAMPLE_ROW ? { ...f, v: composeSample(prefix, sampleDigits(f.v)) } : f));
}
