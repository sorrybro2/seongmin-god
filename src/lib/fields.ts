/**
 * 표의 각 줄에서 고를 수 있는 값들. 사람이나 항목이 바뀌면 여기만 고치면 된다.
 * 줄 번호는 0부터: 공사명(0) / 시료번호(1) / 일자(2) / 채취구분(3) / 조사자(4)
 */
export const SAMPLE_ROW = 1;
export const TYPE_ROW = 3;
export const INSPECTOR_ROW = 4;

/** 시료번호 앞자리 — 고른 뒤 숫자만 입력 (예: GW-12, S-3) */
export const SAMPLE_PREFIXES = ['GW-', 'S-'];

/** 채취구분 */
export const SAMPLE_TYPES = ['토양', '지하수'];

/** 조사자 */
export const INSPECTORS = ['유성민', '김병수', '이동형', '유미애'];

/** "GW-12" → { prefix: 'GW-', digits: '12' }. 형식이 다르면 prefix는 빈 문자열 */
export function splitSampleNumber(value: string) {
  const prefix = SAMPLE_PREFIXES.find((p) => value.startsWith(p)) ?? '';
  return { prefix, digits: prefix ? value.slice(prefix.length) : '' };
}
