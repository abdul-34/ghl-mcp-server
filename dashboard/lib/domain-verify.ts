import { randomBytes } from 'crypto';

/**
 * Custom-domain input helpers. TLS + DNS validation are handled by Cloudflare for
 * SaaS (see lib/cloudflare.ts); these just sanitize the domain the agency enters
 * and mint a local ownership token kept for reference.
 */

/** Normalize a user-entered domain to a bare lowercased hostname. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

export function isValidDomain(domain: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}

export function newVerificationToken(): string {
  return `ghlmcp-${randomBytes(16).toString('hex')}`;
}
