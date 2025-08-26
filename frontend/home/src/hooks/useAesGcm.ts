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

export async function encrypt(key: CryptoKey, data: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv, cipher: new Uint8Array(cipher) };
}

export async function decrypt(key: CryptoKey, iv: Uint8Array, cipher: Uint8Array) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new Uint8Array(plain);
}