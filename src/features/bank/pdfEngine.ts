// Loaded only when a statement is selected, inside the DOM engine on native.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

(globalThis as typeof globalThis & { pdfjsWorker: typeof worker }).pdfjsWorker = worker;
export { pdfjs };
