import type { Field } from './storage';

/**
 * 표의 각 줄에서 고를 수 있는 값들. 사람이나 항목이 바뀌면 여기만 고치면 된다.
 * 줄 번호는 0부터: 공사명(0) / 시료번호(1) / 일자(2) / 채취구분(3) / 조사자(4)
 * (사진에 찍히는 표의 순서. 입력 화면에서는 채취구분을 시료번호 위에 보여준다)
 */
export const SAMPLE_ROW = 1;
export const TYPE_ROW = 3;
export const INSPECTOR_ROW = 4;

/**
 * 채취구분 → 시료번호 앞자리. 첫 번째가 기본값.
 * 앞자리가 2개 이상이면 시료번호 칸에 버튼으로 나온다.
 */
export const SAMPLE_TYPES = [
  { label: '토양', prefixes: ['S-', 'SA-'] },
  { label: '지하수', prefixes: ['GW-'] },
];

/** 조사자 */
export const INSPECTORS = ['유성민', '김병수', '이동형', '유미애'];

// 긴 것부터 비교해야 SA- 가 S- 로 잘못 읽히지 않는다
const ALL_PREFIXES = SAMPLE_TYPES.flatMap((t) => t.prefixes).sort((a, b) => b.length - a.length);

export const prefixesForType = (type: string) => SAMPLE_TYPES.find((t) => t.label === type)?.prefixes ?? [];

/** "SA-12" → { prefix: 'SA-', digits: '12' }. 형식이 다르면 prefix 없이 숫자만 ("BH-3" → '3') */
export function splitSample(value: string) {
  const prefix = ALL_PREFIXES.find((p) => value.startsWith(p)) ?? '';
  return { prefix, digits: value.slice(prefix.length).replace(/\D/g, '') };
}

/** 지금 채취구분에서 쓰는 앞자리: 값에 맞는 앞자리가 있으면 그것, 없으면 기본값 */
export function activePrefix(type: string, value: string) {
  const options = prefixesForType(type);
  const { prefix } = splitSample(value);
  return options.includes(prefix) ? prefix : (options[0] ?? '');
}

/** 채취구분을 바꿀 때: 숫자는 두고 앞자리만 새 구분에 맞춘다 */
export function sampleForType(type: string, value: string) {
  const options = prefixesForType(type);
  if (!options.length) return value;
  const { prefix, digits } = splitSample(value);
  return (options.includes(prefix) ? prefix : options[0]) + digits;
}

/** 템플릿 불러올 때 채취구분과 시료번호 앞자리가 어긋나 있으면 맞춘다 */
export function syncSamplePrefix(fields: Field[]): Field[] {
  const type = fields[TYPE_ROW]?.v ?? '';
  const sample = fields[SAMPLE_ROW];
  if (!sample?.v || !prefixesForType(type).length) return fields;
  return fields.map((f, i) => (i === SAMPLE_ROW ? { ...f, v: sampleForType(type, f.v) } : f));
}

/**
 * 사진·파일 이름에 쓰는 값: 숫자 없이 앞자리만 있으면("S-") 빈 값으로.
 * (입력 중에는 고른 앞자리를 기억하려고 "SA-"처럼 앞자리만 담아 둘 수 있다)
 */
export function forStamp(fields: Field[]): Field[] {
  const sample = fields[SAMPLE_ROW];
  if (!sample || !ALL_PREFIXES.includes(sample.v)) return fields;
  return fields.map((f, i) => (i === SAMPLE_ROW ? { ...f, v: '' } : f));
}
