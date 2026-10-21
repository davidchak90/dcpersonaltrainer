// Same Web Crypto implementation is used by the local packager and the browser.
export const ITERATIONS = 600000;
const aad = new TextEncoder().encode('PC2-AIO-SNAPSHOT-v1');
const encode = bytes => {
  let text = ''; for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
};
const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
function strictKeys(obj, fields) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).length !== fields.length || fields.some(k => !(k in obj))) throw new Error('Unexpected snapshot fields');
}
function base64(value, bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4) throw new Error('Invalid base64 snapshot field');
  const result = decode(value);
  if (encode(result) !== value || (bytes !== undefined && result.length !== bytes)) throw new Error('Invalid snapshot field length');
  return result;
}
export function validateEnvelope(value) {
  if (value?.status === 'not-prepared') {
    strictKeys(value, ['schemaVersion', 'status']);
    if (value.schemaVersion !== 1) throw new Error('Unsupported snapshot');
    return { ready: false };
  }
  strictKeys(value, ['schemaVersion', 'kind', 'kdf', 'cipher', 'ciphertext', 'encryptedAt']);
  strictKeys(value.kdf, ['name', 'hash', 'iterations', 'salt']);
  strictKeys(value.cipher, ['name', 'length', 'iv', 'tagLength']);
  if (value.schemaVersion !== 1 || value.kind !== 'pc2-encrypted-html' || value.kdf.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256' || value.kdf.iterations !== ITERATIONS || value.cipher.name !== 'AES-GCM' || value.cipher.length !== 256 || value.cipher.tagLength !== 128) throw new Error('Unsupported encryption parameters');
  base64(value.kdf.salt, 16); base64(value.cipher.iv, 12);
  if (typeof value.ciphertext !== 'string' || value.ciphertext.length > 28000000) throw new Error('Snapshot too large');
  if (base64(value.ciphertext).length < 17) throw new Error('Missing encrypted content');
  if (typeof value.encryptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.encryptedAt) || Number.isNaN(Date.parse(value.encryptedAt))) throw new Error('Missing encryption time');
  return { ready: true };
}
async function keyFor(passphrase, salt, usage) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, [usage]);
}
export async function encryptSnapshot(html, passphrase) {
  if (typeof html !== 'string' || !html.trim() || new TextEncoder().encode(html).length > 20000000) throw new Error('Invalid HTML snapshot');
  if (typeof passphrase !== 'string' || [...passphrase].length < 16) throw new Error('Use a unique passphrase of at least 16 characters');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(passphrase, salt, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, new TextEncoder().encode(html));
  const result = { schemaVersion: 1, kind: 'pc2-encrypted-html', kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: encode(salt) }, cipher: { name: 'AES-GCM', length: 256, iv: encode(iv), tagLength: 128 }, ciphertext: encode(new Uint8Array(ciphertext)), encryptedAt: new Date().toISOString() };
  validateEnvelope(result); return result;
}
export async function decryptSnapshot(envelope, passphrase) {
  if (!validateEnvelope(envelope).ready) throw new Error('No snapshot has been prepared yet');
  const key = await keyFor(passphrase, decode(envelope.kdf.salt), 'decrypt');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.cipher.iv), additionalData: aad, tagLength: 128 }, key, decode(envelope.ciphertext));
  return new TextDecoder('utf-8', { fatal: true }).decode(plain);
}
