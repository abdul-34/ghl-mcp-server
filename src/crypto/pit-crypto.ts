/**
 * Application-side encryption for CRM Private Integration Tokens (PIT).
 *
 * PITs are encrypted with AES-256-GCM before they are written to Supabase, so
 * a database dump never exposes a usable CRM credential. The dashboard
 * encrypts on save; the MCP server decrypts at connect time. Both must share
 * the same `ENCRYPTION_KEY`.
 *
 * Ciphertext layout (base64):  iv(12) || authTag(16) || ciphertext
 *
 * ENCRYPTION_KEY accepts a 32-byte key as either:
 *   - 64 hex chars, or
 *   - base64 (44 chars), or
 *   - a raw 32-character string.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Provide a 32-byte key (64 hex chars, base64, or a 32-char string). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else if (raw.length === 32) {
    key = Buffer.from(raw, 'utf8');
  } else {
    key = Buffer.from(raw, 'base64');
  }

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
      'Generate one with: openssl rand -hex 32'
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypt a plaintext PIT into base64(iv || authTag || ciphertext). */
export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Decrypt a base64(iv || authTag || ciphertext) blob back to the plaintext PIT. */
export function decryptToken(payload: string): string {
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('decryptToken: ciphertext is too short or malformed.');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Reset the in-memory key cache. Used by tests. */
export function _resetKeyCache(): void {
  cachedKey = null;
}
