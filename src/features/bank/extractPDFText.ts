import { MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_PDF_TEXT } from './pdfTypes.ts';
import type { PDFTextPage } from './pdfTypes.ts';

export async function extractPDFText(base64: string, signal = new AbortController().signal): Promise<PDFTextPage[]> {
  let destroy: (() => Promise<void>) | undefined;
  let destruction: Promise<void> | undefined;
  const abort = () => { void destroy?.().catch(() => {}); };
  try {
    // Both engines are bundled locally. The supported main-thread fallback
    // works in WKWebView without a remote worker/CDN or statement upload.
    const { pdfjs } = await import('./pdfEngine.ts');
    if (signal.aborted) throw new Error('PDF reading canceled.');
    const binary = atob(base64);
    if (binary.length > MAX_PDF_BYTES || !binary.slice(0, 1024).includes('%PDF-')) throw new Error('Choose a valid PDF under 10 MB.');
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const task = pdfjs.getDocument({ data: bytes, stopAtErrors: true, useWasm: false, useWorkerFetch: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
    destroy = () => destruction ??= task.destroy();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { await destroy(); throw new Error('PDF reading canceled.'); }
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('Choose a statement with at most 40 pages.');
    const pages: PDFTextPage[] = [];
    let characters = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal.aborted) throw new Error('PDF reading canceled.');
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const height = page.getViewport({ scale: 1 }).height;
      const items = content.items.filter((item) => 'str' in item).map((item) => {
        characters += item.str.length;
        return { text: item.str, x: item.transform[4], y: height - item.transform[5], width: item.width, height: item.height };
      });
      if (characters > MAX_PDF_TEXT) throw new Error('Choose a smaller statement PDF.');
      pages.push({ page: number, items });
      page.cleanup();
      // Yield between pages to keep Cancel responsive on mobile browsers.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return pages;
  } finally {
    signal.removeEventListener('abort', abort);
    await destroy?.();
  }
}
