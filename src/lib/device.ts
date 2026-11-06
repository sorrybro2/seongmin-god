export const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isAndroid = /Android/i.test(navigator.userAgent);

/** a[download] 클릭으로 저장 (iOS 안정성을 위해 body에 붙였다 뗀다) */
export function saveToLocal(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadText(text: string, fileName: string) {
  saveToLocal(new Blob([text], { type: 'application/json' }), fileName);
}

export const filesAppLabel = isAndroid ? '다운로드 폴더 확인' : '파일 앱 열기';

/** iOS는 파일 앱을 열고, 그 외에는 저장 위치를 알려준다. 열 수 없으면 안내 문구를 돌려준다. */
export function openFilesApp(): string | null {
  if (isIOS) {
    window.location.href = 'shareddocuments://';
    return null;
  }
  return '다운로드 폴더에 저장했습니다.';
}
