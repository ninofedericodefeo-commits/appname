const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function encodeBase64(bytes: Uint8Array) {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 12288) {
    let text = '';
    for (let i = start; i < Math.min(bytes.length, start + 12288); i += 3) {
      const n = bytes[i] << 16 | (bytes[i + 1] ?? 0) << 8 | (bytes[i + 2] ?? 0);
      text += alphabet[n >>> 18] + alphabet[n >>> 12 & 63] + (i + 1 < bytes.length ? alphabet[n >>> 6 & 63] : '=') + (i + 2 < bytes.length ? alphabet[n & 63] : '=');
    }
    chunks.push(text);
  }
  return chunks.join('');
}
export function decodeBase64(text: string, maxBytes = 64 * 1024 * 1024) {
  const padding = text.indexOf('=');
  if (text.length > Math.ceil(maxBytes / 3) * 4 || text.length % 4 || /[^A-Za-z0-9+/=]/.test(text) || padding >= 0 && (padding < text.length - 2 || !/^={1,2}$/.test(text.slice(padding)))) throw new Error('Invalid or oversized attachment.');
  const length = text.length / 4 * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0);
  if (length > maxBytes) throw new Error('Oversized attachment.');
  const bytes = new Uint8Array(length);
  for (let i = 0, offset = 0; i < text.length; i += 4) {
    const n = alphabet.indexOf(text[i]) << 18 | alphabet.indexOf(text[i + 1]) << 12 | Math.max(0, alphabet.indexOf(text[i + 2])) << 6 | Math.max(0, alphabet.indexOf(text[i + 3]));
    if (offset < bytes.length) bytes[offset++] = n >>> 16;
    if (offset < bytes.length) bytes[offset++] = n >>> 8 & 255;
    if (offset < bytes.length) bytes[offset++] = n & 255;
  }
  if (encodeBase64(bytes) !== text) throw new Error('Invalid attachment encoding.');
  return bytes;
}
