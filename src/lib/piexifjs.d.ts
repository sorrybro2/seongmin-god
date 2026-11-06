declare module 'piexifjs' {
  type IFD = Record<number, unknown>;
  export interface ExifObj {
    '0th': IFD;
    Exif: IFD;
    GPS: IFD;
    Interop: IFD;
    '1st': IFD;
    thumbnail?: string | null;
  }
  const piexif: {
    load(dataUrl: string): ExifObj;
    dump(exif: ExifObj): string;
    insert(exifStr: string, dataUrl: string): string;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
  };
  export default piexif;
}
