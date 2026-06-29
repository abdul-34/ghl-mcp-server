import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * AES-256-GCM token encryption — MUST stay byte-compatible with the MCP
 * server's `src/crypto/pit-crypto.ts`. Both share the same ENCRYPTION_KEY so a
 * PIT encrypted here can be decrypted by the server.
 *
 * Layout (base64):  iv(12) || authTag(16) || ciphertext
 *
 * Server-only: import this from Server Actions / Route Handlers, never from a
 * Client Component (the key must never reach the browser).
 */

const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32');
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else if (raw.length === 32) key = Buffer.from(raw, 'utf8');
  else key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`);
  }
  cachedKey = key;
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptToken(payload: string): string {
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Generate a high-entropy URL secret (used as /mcp/<secret>). */
export function generateLinkSecret(): string {
  // 32 bytes → URL-safe base64 (~43 chars), no padding.
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest — MUST match the server's hashUrlToken. */
export function hashUrlToken(rawSecret: string): string {
  return createHash('sha256').update(rawSecret, 'utf8').digest('hex');
}
