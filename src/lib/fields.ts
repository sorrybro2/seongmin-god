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
 * 채취구분 → 시료번호 앞자리 (head + '-').
 * letters가 true면 head와 '-' 사이에 영문 기호를 칠 수 있다. 토양: S-, SA-, SB-, SC- ...
 */
export const SAMPLE_TYPES = [
  { label: '토양', head: 'S', letters: true },
  { label: '지하수', head: 'GW', letters: false },
];
export type SampleType = (typeof SAMPLE_TYPES)[number];

/** 조사자 */
export const INSPECTORS = ['유성민', '김병수', '이동형', '유미애'];

export const sampleTypeOf = (label: string) => SAMPLE_TYPES.find((t) => t.label === label);

/** head와 '-' 사이 기호: 영문만, 대문자로 */
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

/** 숫자 부분: 마지막 '-' 뒤의 숫자 ("SA-12" → "12", 예전 형식 "BH-3" → "3") */
export function digitsOf(value: string) {
  const dash = value.lastIndexOf('-');
  return (dash >= 0 ? value.slice(dash + 1) : value).replace(/\D/g, '');
}

/** head와 '-' 사이 기호 ("SA-12" → "A"). 그 채취구분 형식이 아니면 빈 값 */
export function codeOf(t: SampleType, value: string) {
  if (!t.letters) return '';
  return value.match(new RegExp(`^${t.head}([A-Z]*)-`))?.[1] ?? '';
}

export const buildSample = (t: SampleType, code: string, digits: string) => `${t.head}${t.letters ? code : ''}-${digits}`;

/** 채취구분을 바꾸거나 템플릿을 불러올 때: 숫자(와 맞으면 기호)는 두고 앞자리만 그 구분에 맞춘다 */
export function sampleForType(label: string, value: string) {
  const t = sampleTypeOf(label);
  return t ? buildSample(t, codeOf(t, value), digitsOf(value)) : value;
}

/** 템플릿 불러올 때 채취구분과 시료번호 앞자리가 어긋나 있으면 맞춘다 */
export function syncSamplePrefix(fields: Field[]): Field[] {
  const type = fields[TYPE_ROW]?.v ?? '';
  if (!fields[SAMPLE_ROW]?.v || !sampleTypeOf(type)) return fields;
  return fields.map((f, i) => (i === SAMPLE_ROW ? { ...f, v: sampleForType(type, f.v) } : f));
}

/**
 * 사진·파일 이름에 쓰는 값: 숫자 없이 앞자리만 있으면("S-", "SA-") 빈 값으로.
 * (입력 중에는 앞자리를 기억하려고 앞자리만 담아 둘 수 있다)
 */
export function forStamp(fields: Field[]): Field[] {
  const sample = fields[SAMPLE_ROW];
  if (!sample || !/^[A-Z]+-$/.test(sample.v)) return fields;
  return fields.map((f, i) => (i === SAMPLE_ROW ? { ...f, v: '' } : f));
}
