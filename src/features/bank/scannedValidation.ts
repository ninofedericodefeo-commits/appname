import { MAX_PDF_TEXT } from './pdfTypes.ts';
import type { PDFTextPage } from './pdfTypes.ts';
export function validateScannedPages(pages: (PDFTextPage & {items:(PDFTextPage['items'][number] & {confidence:number})[]})[]) {
  if (!Array.isArray(pages) || !pages.length || pages.length > 12) throw Error('Read at most 12 scanned pages at a time.');
  let uncertain = 0, characters = 0;
  const pageNumbers = new Set<number>();
  for (const page of pages) {
    if (!Number.isInteger(page.page) || page.page < 1 || page.page > 12 || pageNumbers.has(page.page)) throw Error('Scanned page numbering is invalid.');
    pageNumbers.add(page.page);
    if (!Array.isArray(page.items) || page.items.length > 2000) throw Error('Scanned page has too much text.');
    for (const item of page.items) {
      if (typeof item.text !== 'string' || item.text.length > 500 || ![item.x,item.y,item.width,item.height,item.confidence].every(Number.isFinite)) throw Error('Scanned text could not be validated.');
      characters += item.text.length; if (characters > MAX_PDF_TEXT) throw Error('This scanned statement contains too much text.');
      if (item.confidence < .85) uncertain++;
    }
  }
  return { pages, uncertain };
}
