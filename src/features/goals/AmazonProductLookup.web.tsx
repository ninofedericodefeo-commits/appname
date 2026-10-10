import { useEffect, useRef } from 'react';

import { amazonLookupFallback, draftFromAmazonPage } from './amazonPage';
import type { AmazonLookupProps } from './amazonPage';

export default function AmazonProductLookup({ link, onResult }: AmazonLookupProps) {
  const callback = useRef(onResult);
  useEffect(() => { callback.current = onResult; }, [onResult]);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    void (async () => {
      try {
        const response = await fetch('/api/amazon-product', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link.sourceUrl }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Lookup failed');
        const data: unknown = await response.json();
        if (!cancelled) callback.current(draftFromAmazonPage(link, data));
      } catch {
        if (!cancelled) callback.current(amazonLookupFallback(link));
      } finally { clearTimeout(timeout); }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [link]);
  return null;
}
