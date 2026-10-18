import crypto from 'crypto';

/**
 * Generates a cryptographically secure API key
 * Format: qf_live_<64 hex characters>
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const rawKey = `qf_live_${randomBytes}`;
  const keyPrefix = rawKey.substring(0, 14) + '...';
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyPrefix, keyHash };
}

/**
 * Computes SHA-256 hash of an API key
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Computes HMAC-SHA256 signature for webhook payload
 */
export function computeHmacSignature(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Sanitizes input string to prevent CSV formula injection (CSV Injection / CWE-1236)
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If string starts with =, +, -, @, \t, \r, prefix with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str.replace(/"/g, '""')}`;
  }
  // If string contains comma, quote, or newline, wrap in quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
