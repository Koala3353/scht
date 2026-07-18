const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedVault { ciphertext: Uint8Array; salt: Uint8Array; iv: Uint8Array; }

function bufferSource(bytes: Uint8Array) { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }

async function encryptionKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bufferSource(salt), iterations: 310_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptVault(passphrase: string, values: Record<string, string>): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(passphrase, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferSource(iv) }, key, encoder.encode(JSON.stringify(values))));
  return { ciphertext, salt, iv };
}

export async function decryptVault(passphrase: string, vault: EncryptedVault): Promise<Record<string, string>> {
  const key = await encryptionKey(passphrase, vault.salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferSource(vault.iv) }, key, bufferSource(vault.ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as Record<string, string>;
}
