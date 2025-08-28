// Simple AES-256-GCM helpers using Web Crypto API
// Keys are generated and kept in-memory/local-only to align with zero-knowledge.
export async function generateKey() {
    return crypto.subtle.generateKey({
        name: 'AES-GCM',
        length: 256
    }, true, ['encrypt', 'decrypt']);
}
function toArrayBuffer(u8) {
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    return ab;
}
export async function encrypt(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const ivAb = (() => { const ab = new ArrayBuffer(iv.byteLength); new Uint8Array(ab).set(iv); return ab; })();
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    const ab = toArrayBuffer(buf);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivAb }, key, ab);
    return { iv, cipher: new Uint8Array(cipher) };
}
export async function decrypt(key, iv, cipher) {
    const ivAb = (() => { const ab = new ArrayBuffer(iv.byteLength); new Uint8Array(ab).set(iv); return ab; })();
    const buf = cipher instanceof Uint8Array ? cipher : new Uint8Array(cipher);
    const ab = toArrayBuffer(buf);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivAb }, key, ab);
    return new Uint8Array(plain);
}
