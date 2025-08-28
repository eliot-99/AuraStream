// Simple AES-256-GCM helpers using Web Crypto API
// Keys are generated and kept in-memory/local-only to align with zero-knowledge.
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

export async function encrypt(key: CryptoKey, data: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const ivAb: ArrayBuffer = (() => { const ab = new ArrayBuffer(iv.byteLength); new Uint8Array(ab).set(iv); return ab; })();
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data as any);
  const ab = toArrayBuffer(buf);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivAb }, key, ab);
  return { iv, cipher: new Uint8Array(cipher) };
}

export async function decrypt(key: CryptoKey, iv: Uint8Array, cipher: Uint8Array) {
  const ivAb: ArrayBuffer = (() => { const ab = new ArrayBuffer(iv.byteLength); new Uint8Array(ab).set(iv); return ab; })();
  const buf = cipher instanceof Uint8Array ? cipher : new Uint8Array(cipher as any);
  const ab = toArrayBuffer(buf);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivAb }, key, ab as ArrayBuffer);
  return new Uint8Array(plain);
}