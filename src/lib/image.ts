import exifr from 'exifr';
import piexif, { type ExifObj } from 'piexifjs';
import JSZip from 'jszip';
import type { Field } from './storage';
import { zipBaseName } from './date';

// ========== EXIF 유틸리티 ==========
function formatDateForExif(date: Date | string | number) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0'), min = String(d.getMinutes()).padStart(2, '0'), s = String(d.getSeconds()).padStart(2, '0');
  return `${y}:${m}:${day} ${h}:${min}:${s}`;
}

function toRational(n: number): [number, number] {
  const t = 1.0e-6;
  let den = 1;
  while (Math.abs(n - Math.round(n)) > t && den < 100000) {
    n *= 10;
    den *= 10;
  }
  return [Math.round(n), den];
}

function degToDmsRational(d: number) {
  const abs = Math.abs(d);
  const deg = Math.floor(abs);
  const minF = (abs - deg) * 60;
  const min = Math.floor(minF);
  const sec = Math.round((minF - min) * 60 * 10000);
  return [[deg, 1], [min, 1], [sec, 10000]];
}

async function getExifDateTime(file: File) {
  try {
    const metadata = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
    return metadata && (metadata.DateTimeOriginal || metadata.CreateDate)
      ? new Date(metadata.DateTimeOriginal || metadata.CreateDate)
      : new Date(0);
  } catch {
    return new Date(0);
  }
}

function readAsDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string, name: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이 사진을 열 수 없습니다: ${name}`));
    img.src = src;
  });
}

/** 사진 왼쪽 아래에 표를 그리고, 원본 EXIF(촬영일·카메라·GPS)를 보존한 JPEG를 만든다. */
async function processImage(file: File, fields: Field[], tableSize: number): Promise<Blob> {
  let extractedExif: any = null;
  let correctDate: Date | null = null;

  try {
    // [1단계] 날짜만 정확히 추출
    const dateData = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
    correctDate = dateData?.DateTimeOriginal || dateData?.CreateDate || null;

    // [2단계] 전체 EXIF 추출
    extractedExif = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      icc: true,
      jfif: true,
      ihdr: true,
      reviveValues: true,
      translateKeys: false,
      translateValues: false,
      mergeOutput: false,
    });
  } catch (e) {
    console.warn('EXIF 추출 실패', e);
  }

  const originalDataUrl = await readAsDataURL(file);
  const img = await loadImage(originalDataUrl, file.name);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // --- 표 그리기 ---
  const scale = tableSize / 100;
  const rowH = canvas.height * 0.045 * scale;
  const fontSize = rowH * 0.75;
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';

  let maxVWidth = 0;
  fields.forEach((d) => {
    if (ctx.measureText(d.v).width > maxVWidth) maxVWidth = ctx.measureText(d.v).width;
  });

  const keyWidth = ctx.measureText('공사명일자').width;
  const padding = 40 * scale;
  const tableW = keyWidth + maxVWidth + padding * 4;
  const tableH = rowH * 5;
  const x = 0;
  const y = canvas.height - tableH;

  ctx.fillStyle = 'white';
  ctx.fillRect(x, y, tableW, tableH);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = canvas.width * 0.0015;
  ctx.fillStyle = 'black';

  fields.forEach((item, i) => {
    const cy = y + i * rowH;
    ctx.strokeRect(x, cy, tableW, rowH);
    const splitX = x + keyWidth + padding * 2;
    ctx.beginPath();
    ctx.moveTo(splitX, cy);
    ctx.lineTo(splitX, cy + rowH);
    ctx.stroke();
    ctx.fillText(item.k, x + padding, cy + rowH * 0.5);
    ctx.fillText(item.v, splitX + padding, cy + rowH * 0.5);
  });
  // --- 표 그리기 끝 ---

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', 0.95),
  );
  const newDataUrl = await readAsDataURL(blob);

  try {
    // 원본 EXIF 로드
    let originalExifObj: ExifObj;
    try {
      originalExifObj = piexif.load(originalDataUrl);
    } catch {
      console.warn('원본 EXIF 로드 실패 (HEIC일 수 있음)');
      originalExifObj = { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {} };
    }

    // exifr에서 추출한 데이터로 보강
    if (extractedExif) {
      if (extractedExif.Make) originalExifObj['0th'][piexif.ImageIFD.Make] = String(extractedExif.Make);
      if (extractedExif.Model) originalExifObj['0th'][piexif.ImageIFD.Model] = String(extractedExif.Model);

      // 날짜 임시 주입 (아래에서 덮어씀)
      const targetDate = extractedExif.DateTimeOriginal || extractedExif.CreateDate || new Date();
      const dateStr = formatDateForExif(targetDate);
      if (!originalExifObj.Exif) originalExifObj.Exif = {};
      originalExifObj.Exif[piexif.ExifIFD.DateTimeOriginal] = dateStr;
      originalExifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = dateStr;
      originalExifObj['0th'][piexif.ImageIFD.DateTime] = dateStr;

      if (extractedExif.FNumber !== undefined) originalExifObj.Exif[piexif.ExifIFD.FNumber] = toRational(extractedExif.FNumber);
      if (extractedExif.ExposureTime !== undefined) originalExifObj.Exif[piexif.ExifIFD.ExposureTime] = toRational(extractedExif.ExposureTime);
      if (extractedExif.ISO !== undefined) originalExifObj.Exif[piexif.ExifIFD.ISOSpeedRatings] = extractedExif.ISO;
      if (extractedExif.FocalLength !== undefined) originalExifObj.Exif[piexif.ExifIFD.FocalLength] = toRational(extractedExif.FocalLength);
      if (extractedExif.LensModel) originalExifObj.Exif[piexif.ExifIFD.LensModel] = String(extractedExif.LensModel);
      if (extractedExif.WhiteBalance !== undefined) originalExifObj.Exif[piexif.ExifIFD.WhiteBalance] = extractedExif.WhiteBalance;
      if (extractedExif.Flash !== undefined) originalExifObj.Exif[piexif.ExifIFD.Flash] = extractedExif.Flash;
      if (extractedExif.ExposureMode !== undefined) originalExifObj.Exif[piexif.ExifIFD.ExposureMode] = extractedExif.ExposureMode;
      if (extractedExif.ExposureCompensation !== undefined) originalExifObj.Exif[piexif.ExifIFD.ExposureBiasValue] = toRational(extractedExif.ExposureCompensation);
      if (extractedExif.MeteringMode !== undefined) originalExifObj.Exif[piexif.ExifIFD.MeteringMode] = extractedExif.MeteringMode;

      // GPS: JPEG는 원본 EXIF에 이미 들어 있으니 그대로 둔다.
      // HEIC처럼 원본 EXIF를 못 읽었을 때만 exifr 값으로 채운다 (사진 좌표 화면이 이 위치를 읽음).
      // mergeOutput:false라서 위도·경도는 gps 묶음 안에, 나머지 태그는 번호(6 = GPSAltitude, 5 = GPSAltitudeRef)로 들어 있다.
      const gps = extractedExif.gps;
      if (gps?.latitude && gps?.longitude && !originalExifObj.GPS?.[piexif.GPSIFD.GPSLatitude]) {
        if (!originalExifObj.GPS) originalExifObj.GPS = {};
        originalExifObj.GPS[piexif.GPSIFD.GPSVersionID] = [2, 2, 0, 0];
        originalExifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = gps.latitude < 0 ? 'S' : 'N';
        originalExifObj.GPS[piexif.GPSIFD.GPSLatitude] = degToDmsRational(gps.latitude);
        originalExifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = gps.longitude < 0 ? 'W' : 'E';
        originalExifObj.GPS[piexif.GPSIFD.GPSLongitude] = degToDmsRational(gps.longitude);
        const alt = gps[piexif.GPSIFD.GPSAltitude];
        if (typeof alt === 'number' && Number.isFinite(alt)) {
          const ref = gps[piexif.GPSIFD.GPSAltitudeRef];
          originalExifObj.GPS[piexif.GPSIFD.GPSAltitude] = toRational(Math.abs(alt));
          originalExifObj.GPS[piexif.GPSIFD.GPSAltitudeRef] = Number(ref?.[0] ?? ref ?? 0) === 1 ? 1 : 0;
        }
      }
    }

    // [3단계] 올바른 날짜로 최종 덮어쓰기
    if (correctDate) {
      const correctDateStr = formatDateForExif(correctDate);
      if (!originalExifObj.Exif) originalExifObj.Exif = {};
      originalExifObj.Exif[piexif.ExifIFD.DateTimeOriginal] = correctDateStr;
      originalExifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = correctDateStr;
      originalExifObj['0th'][piexif.ImageIFD.DateTime] = correctDateStr;
    }

    const exifStr = piexif.dump(originalExifObj);
    const finalDataUrl = piexif.insert(exifStr, newDataUrl);
    return await (await fetch(finalDataUrl)).blob();
  } catch (err) {
    console.error('메타데이터 주입 실패', err);
    return blob; // 실패해도 이미지는 보존
  }
}

export type BuildProgress =
  | { phase: 'sorting' }
  | { phase: 'processing'; current: number; total: number }
  | { phase: 'zipping' };

/** 사진을 촬영 시간순으로 정렬 → 표 삽입 → ZIP 생성 */
export async function buildZip(
  files: File[],
  fields: Field[],
  templateName: string,
  tableSize: number,
  onProgress: (p: BuildProgress) => void,
) {
  onProgress({ phase: 'sorting' });
  const filesWithTime = await Promise.all(files.map(async (file) => ({ file, time: await getExifDateTime(file) })));
  filesWithTime.sort((a, b) => a.time.getTime() - b.time.getTime());

  const zip = new JSZip();
  const zipFileName = zipBaseName(fields, templateName);
  const photoBaseName = fields[1].v || '사진';

  for (let i = 0; i < filesWithTime.length; i++) {
    onProgress({ phase: 'processing', current: i + 1, total: filesWithTime.length });
    const target = filesWithTime[i];
    const blob = await processImage(target.file, fields, tableSize);

    // 타임존 시차 보정
    let fileDate = new Date();
    if (target.time && target.time.getTime() > 0) {
      fileDate = new Date(target.time.getTime() - target.time.getTimezoneOffset() * 60000);
    }
    // ZIP 내부 수정 날짜를 촬영 시각으로
    zip.file(`${photoBaseName} (${i + 1}).jpg`, blob, { date: fileDate });
  }

  onProgress({ phase: 'zipping' });
  const content = await zip.generateAsync({ type: 'blob' });
  return { blob: content, fileName: `${zipFileName}.zip` };
}
