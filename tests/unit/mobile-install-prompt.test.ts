import { describe, expect, it } from 'vitest';
import { mobileInstallPromptKind } from '../../components/pwa/mobile-install-prompt';

describe('mobile install prompt detection', () => {
  it('guides iOS users and does not prompt after standalone install', () => {
    expect(mobileInstallPromptKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', false)).toBe('ios');
    expect(mobileInstallPromptKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true)).toBeNull();
  });
  it('uses the Android browser-menu fallback until the native install event arrives', () => {
    expect(mobileInstallPromptKind('Mozilla/5.0 (Linux; Android 15)', false)).toBe('menu');
    expect(mobileInstallPromptKind('Mozilla/5.0 (Macintosh; Intel Mac OS X)', false)).toBeNull();
  });
});
