'use dom';

import { useEffect, useRef } from 'react';

import { extractPDFText } from './extractPDFText';
import type { PDFTextPage } from './pdfTypes';

export default function PDFStatementReader({ base64, onRead, onError }: {
  base64: string;
  onRead: (pages: PDFTextPage[]) => Promise<void>;
  onError: (message: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const callbacks = useRef({ onRead, onError });
  useEffect(() => { callbacks.current = { onRead, onError }; }, [onRead, onError]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => { cancelled = true; controller.abort(); void callbacks.current.onError('Reading this PDF took too long. Try a smaller statement.'); }, 45_000);
    void (async () => {
      try {
        const pages = await extractPDFText(base64, controller.signal);
        if (!cancelled) await callbacks.current.onRead(pages);
      } catch (cause) {
        if (!cancelled) await callbacks.current.onError(cause instanceof Error && cause.name === 'PasswordException' ? 'This PDF is password protected. Choose an unlocked statement PDF.' : cause instanceof Error ? cause.message : 'Could not read this PDF. Download the original statement from Citizens.');
      } finally { clearTimeout(timer); controller.abort(); }
    })();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [base64]);
  return <div aria-hidden="true" />;
}
