// Simulated pre-load security checks (no networking yet)
// - TLS handshake stub
// - Local E2EE key generation
import { generateKey } from '../hooks/useAesGcm';

export type SecurityInit = {
  key: CryptoKey;
  startedAt: number;
};

export async function preLoadSecurity(): Promise<SecurityInit> {
  // Stub TLS handshake marker (in real app, ensure WSS is used)
  const startedAt = Date.now();
  const key = await generateKey();
  return { key, startedAt };
}