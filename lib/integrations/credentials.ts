import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const encoded = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encoded) throw new Error('INTEGRATION_ENCRYPTION_KEY is required for provider connections.');
  const value = Buffer.from(encoded, 'base64');
  if (value.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return value;
}

export function encryptCredentials(values: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  return `\\x${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('hex')}`;
}

export function decryptCredentials(payload: Uint8Array | string) {
  const bytes = typeof payload === 'string'
    ? (payload.startsWith('\\x') ? Buffer.from(payload.slice(2), 'hex') : Buffer.from(payload, 'base64'))
    : Buffer.from(payload);
  const iv = bytes.subarray(0, 12);
  const tag = bytes.subarray(12, 28);
  const ciphertext = bytes.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as Record<string, string>;
}
