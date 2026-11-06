import type { Field } from './storage';

export function formatDateToKorean(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일`;
}

export const todayKorean = () => formatDateToKorean(new Date());

export function koreanToISO(koreanDate: string) {
  const match = koreanDate.match(/(\d{4})년 (\d{2})월 (\d{2})일/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function isoToKorean(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${year}년 ${month}월 ${day}일`;
}

/** "2026년 02월 13일" → "260213" */
export function getShortDate(str: string) {
  const match = str.match(/(\d{4})년 (\d{2})월 (\d{2})일/);
  return match ? match[1].substring(2) + match[2] + match[3] : '000000';
}

/** 표의 3번째 줄이 일자 칸 (기존 버전과 동일) */
export const DATE_ROW = 2;

export const defaultFields = (): Field[] => [
  { k: '공사명', v: '' },
  { k: '시료번호', v: '' },
  { k: '일자', v: todayKorean() },
  { k: '채취구분', v: '' },
  { k: '조사자', v: '' },
];

/** ZIP 파일 이름 규칙 (기존 버전과 동일) */
export function zipBaseName(fields: Field[], templateName: string) {
  const baseTitle = templateName || fields[0].v || '현장사진';
  const sampleNumber = fields[1].v;
  const datePart = getShortDate(fields[DATE_ROW].v);
  return sampleNumber ? `${baseTitle} ${sampleNumber} ${datePart}`.trim() : `${baseTitle} ${datePart}`.trim();
}
