import { parseHTML } from 'linkedom';

import { parseAmazonLink } from './amazonLink.ts';
import type { AmazonLink } from './amazonLink.ts';
import type { AmazonPageData } from './amazonPage.ts';
import { AMAZON_READER_SCRIPT } from './amazonReaderScript.ts';

// Only our static reader is evaluated. Remote scripts are parsed as inert text.
const reader = new Function('doc', 'url', `${AMAZON_READER_SCRIPT}; return readAmazonDocument(doc, url);`) as (doc: Document, url: string) => AmazonPageData;
export function readAmazonHtml(html: string, url: string) {
  return reader(parseHTML(html).document, url);
}

export async function readBoundedText(response: Pick<Response, 'headers' | 'body'>, maxBytes: number) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Page too large');
  if (!response.body) throw new Error('Missing response body');
  const stream = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await stream.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Page too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await stream.cancel(); }
}

export async function fetchAmazonPage(link: AmazonLink, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<AmazonPageData> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  let url = link.sourceUrl;
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      // Validate every destination before fetching it, including short links.
      const destination = parseAmazonLink(url).value;
      if (!destination || (link.asin && destination.asin !== link.asin)) throw new Error('Unsupported redirect');
      const response = await fetcher(url, {
        redirect: 'manual', signal: controller.signal,
        headers: { Accept: 'text/html', 'User-Agent': 'GasFinder/1.0 (product savings goal preview)' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Missing redirect');
        url = new URL(location, url).href as AmazonLink['sourceUrl'];
        continue;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        await response.body?.cancel();
        throw new Error('Amazon page unavailable');
      }
      return readAmazonHtml(await readBoundedText(response, 3_000_000), url);
    }
    throw new Error('Too many redirects');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
