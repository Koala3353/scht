import { describe, expect, it } from 'vitest';

import { TaskInputSchema } from '../../lib/validation/task';

describe('TaskInputSchema', () => {
  it('requires a task title and ISO due date when provided', () => {
    expect(() => TaskInputSchema.parse({ title: '', kind: 'school' })).toThrow();
    expect(
      TaskInputSchema.parse({
        title: 'Quant set',
        kind: 'school',
        dueAt: '2026-07-18T12:00:00.000Z',
      }).title,
    ).toBe('Quant set');
    expect(() =>
      TaskInputSchema.parse({
        title: 'Quant set',
        kind: 'school',
        dueAt: 'tomorrow afternoon',
      }),
    ).toThrow();
  });

  it('constrains task references and numeric fields', () => {
    expect(() =>
      TaskInputSchema.parse({
        title: 'Draft essay',
        kind: 'school',
        termId: 'not-a-uuid',
      }),
    ).toThrow();
    expect(() =>
      TaskInputSchema.parse({
        title: 'Draft essay',
        kind: 'school',
        weightPercent: 101,
      }),
    ).toThrow();
  });
});
