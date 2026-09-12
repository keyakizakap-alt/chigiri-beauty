/** @param {Uint8Array} bytes @param {string} type */
export function validImageSignature(bytes, type) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  return false;
}
/** @param {unknown} value */
export function validChatBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = /** @type {Record<string, any>} */ (value);
  if (b.input !== undefined && typeof b.input !== 'string') return false;
  for (const key of ['images','ownedProductIds','history','conditions']) {
    if (b[key] !== undefined && !Array.isArray(b[key])) return false;
  }
  if ((b.images?.length ?? 0) > 2 || (b.history?.length ?? 0) > 60 || (b.conditions?.length ?? 0) > 5) return false;
  if (b.history?.some(/** @param {any} m */ m => !m || typeof m !== 'object' || typeof m.text !== 'string')) return false;
  if (b.memory !== undefined) {
    if (!b.memory || typeof b.memory !== 'object' || Array.isArray(b.memory)) return false;
    for (const key of ['facts','knownKeys','askedKeys']) if (b.memory[key] !== undefined && !Array.isArray(b.memory[key])) return false;
  }
  return true;
}
/** @param {Request} request */
export function sameOriginMutation(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  // Native same-origin fetch always supplies Origin for POST; DELETE may only carry Fetch Metadata.
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  return origin === new URL(request.url).origin;
}
/** Read actual bytes, including chunked bodies, before JSON/multipart parsing.
 * @param {Request} request @param {number} maxBytes */
export async function boundedRequest(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError('body');
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError('body'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return new Request(request.url, {method: request.method, headers: request.headers, body, signal: request.signal});
}
