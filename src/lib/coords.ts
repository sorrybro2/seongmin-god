import exifr from 'exifr';
import proj4 from 'proj4';
import { buildXlsx, type Column } from './xlsx';

/**
 * 사진 EXIF의 위도·경도 → TM 좌표 (GRS80 타원체, 세계측지계 = "요즘 표준").
 * 측량 기준대로 경도에 따라 원점을 고른다. 수도권·충청·전라 대부분은 중부원점.
 * 한국 TM은 X가 북쪽, Y가 동쪽이다 (수학의 x/y와 반대).
 */
const ORIGINS = [
  { name: '서부원점', epsg: 5185, lon0: 125, below: 126 },
  { name: '중부원점', epsg: 5186, lon0: 127, below: 128 },
  { name: '동부원점', epsg: 5187, lon0: 129, below: 130 },
  { name: '동해원점', epsg: 5188, lon0: 131, below: Infinity },
];
export type Origin = (typeof ORIGINS)[number];

const tmDef = (lon0: number) => `+proj=tmerc +lat_0=38 +lon_0=${lon0} +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs`;

export function toTM(lat: number, lon: number) {
  const origin = ORIGINS.find((o) => lon < o.below)!;
  const [east, north] = proj4('WGS84', tmDef(origin.lon0), [lon, lat]);
  return { x: north, y: east, origin };
}

const inKorea = (lat: number, lon: number) => lat >= 32 && lat <= 39.5 && lon >= 124 && lon <= 132;

export type PhotoCoord = {
  file: string;
  /** 이 앱이 만든 사진("SA-3 (2).jpg")이면 이름에서 알아낸 시료번호 */
  sample: string;
  taken: Date | null;
  lat?: number;
  lon?: number;
  /** TM X (북쪽, m) */
  x?: number;
  /** TM Y (동쪽, m) */
  y?: number;
  origin?: Origin;
  problem?: string;
};

/** 이 앱이 저장한 사진 이름 "시료번호 (n).jpg"에서 시료번호를 꺼낸다 */
export function sampleFromName(name: string) {
  return name.match(/^([A-Z]+-\d+) \(\d+\)\.jpe?g$/i)?.[1].toUpperCase() ?? '';
}

async function readOne(file: File): Promise<PhotoCoord> {
  const base: PhotoCoord = { file: file.name, sample: sampleFromName(file.name), taken: null };
  let meta: Record<string, any> | undefined;
  try {
    meta = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'],
    });
  } catch {
    return { ...base, problem: '사진을 읽을 수 없음' };
  }

  const t = meta?.DateTimeOriginal ?? meta?.CreateDate;
  const taken = t instanceof Date && !isNaN(t.getTime()) ? t : null;
  const lat = meta?.latitude;
  const lon = meta?.longitude;

  // 위치를 못 잡은 폰은 0,0을 적기도 한다
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return { ...base, taken, problem: '위치 정보 없음' };
  }
  if (!inKorea(lat, lon)) return { ...base, taken, lat, lon, problem: '국내 위치가 아님' };

  const { x, y, origin } = toTM(lat, lon);
  return { ...base, taken, lat, lon, x, y, origin };
}

/** 여러 장을 읽어 촬영 시간순으로 (시간 없는 사진은 뒤로) */
export async function readCoords(files: File[]) {
  const items = await Promise.all(files.map(readOne));
  const time = (p: PhotoCoord) => p.taken?.getTime() ?? Infinity;
  return items.sort((a, b) => time(a) - time(b) || a.file.localeCompare(b.file, 'ko', { numeric: true }));
}

const round = (n: number | undefined, digits: number) => (n === undefined ? undefined : Number(n.toFixed(digits)));

const COLUMNS: Column[] = [
  { header: '번호', width: 6 },
  { header: '시료번호', width: 11 },
  { header: '사진 파일', width: 26 },
  { header: '촬영일시', width: 17, format: 'datetime' },
  { header: 'TM X (북, m)', width: 14, format: 'meter' },
  { header: 'TM Y (동, m)', width: 14, format: 'meter' },
  { header: '좌표계', width: 26 },
  { header: '위도', width: 12, format: 'degree' },
  { header: '경도', width: 12, format: 'degree' },
  { header: '비고', width: 16 },
];

export function coordsXlsx(items: PhotoCoord[]) {
  const rows = items.map((p, i) => [
    i + 1,
    p.sample,
    p.file,
    p.taken,
    round(p.x, 2), // 화면·복사 값(소수 둘째 자리)과 똑같이. 폰 GPS 오차가 수 m라 그 아래 자리는 의미 없음
    round(p.y, 2),
    p.origin ? `GRS80 TM ${p.origin.name} (EPSG:${p.origin.epsg})` : '',
    round(p.lat, 8),
    round(p.lon, 8),
    p.problem ?? '',
  ]);
  return buildXlsx('TM 좌표', COLUMNS, rows);
}

/** "사진 좌표 261110.xlsx" */
export function xlsxName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `사진 좌표 ${String(now.getFullYear()).slice(2)}${p(now.getMonth() + 1)}${p(now.getDate())}.xlsx`;
}
