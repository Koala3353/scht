import { describe, expect, it } from 'vitest';
import manifest from '../../app/manifest';

describe('PWA manifest', () => {
  it('declares a standalone installable application', () => {
    expect(manifest().display).toBe('standalone');
    expect(manifest().name).toBe('Scht');
    expect(manifest().icons).toEqual(
      expect.arrayContaining([expect.objectContaining({ sizes: '192x192' })]),
    );
  });
});
