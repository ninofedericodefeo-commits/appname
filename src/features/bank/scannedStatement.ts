import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { PDFTextItem, PDFTextPage } from './pdfTypes';
import { validateScannedPages } from './scannedValidation';
const module = Platform.OS === 'web' ? null : requireOptionalNativeModule<{recognizePdf?: (base64: string) => Promise<(PDFTextPage & {items:(PDFTextItem & {confidence:number})[]})[]>}>('ReceiptOcr');
export const scannedReadingAvailable = typeof module?.recognizePdf === 'function';
export async function readScannedStatement(base64: string) {
  if (!module?.recognizePdf) throw Error('Scanned statement reading requires the updated native app build. Download an original text PDF if available.');
  return validateScannedPages(await module.recognizePdf(base64));
}
