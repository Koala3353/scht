import { beforeEach, describe, expect, it } from 'vitest';
import { decryptCredentials, encryptCredentials } from '../../lib/integrations/credentials';

describe('integration credential encryption', () => {
  beforeEach(() => { process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64'); });
  it('round-trips credentials without storing readable plaintext', () => {
    const encrypted = encryptCredentials({ token: 'canvas-secret' });
    expect(encrypted).not.toContain('canvas-secret');
    expect(decryptCredentials(encrypted)).toEqual({ token: 'canvas-secret' });
  });
});
