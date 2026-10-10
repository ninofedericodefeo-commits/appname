export const MAX_PDF_BYTES = 10_000_000;
export const MAX_PDF_PAGES = 40;
export const MAX_PDF_TEXT = 2_000_000;
export type PDFTextItem = { text: string; x: number; y: number; width: number; height: number };
export type PDFTextPage = { page: number; items: PDFTextItem[] };
