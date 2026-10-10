import { parseAmazonLink } from '@/features/goals/amazonLink';
import { fetchAmazonPage, readBoundedText } from '@/features/goals/amazonLookup.server';

let pending = 0;
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  let source: unknown;
  try { source = JSON.parse(await readBoundedText(request, 4096)).url; }
  catch { return Response.json({ error: 'Paste one Amazon product link.' }, { status: 400, headers }); }
  const link = typeof source === 'string' ? parseAmazonLink(source).value : undefined;
  if (!link) return Response.json({ error: 'Use an HTTPS amazon.com product link or a.co short link.' }, { status: 400, headers });
  if (pending >= 8) return Response.json({ error: 'Lookup is busy. Please retry.' }, { status: 503, headers });
  pending++;
  try {
    const page = await fetchAmazonPage(link, fetch, request.signal);
    return Response.json(page, { headers });
  } catch {
    return Response.json({ url: link.sourceUrl, title: '', variant: '', priceCents: null, problem: 'blocked' }, { headers });
  } finally { pending--; }
}
