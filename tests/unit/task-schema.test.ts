import { describe, expect, it } from 'vitest';

import { TaskInputSchema } from '../../lib/validation/task';

describe('TaskInputSchema', () => {
  it('round-trips the complete task context', () => {
    expect(
      TaskInputSchema.parse({
        title: 'Submit reflection',
        kind: 'school',
        dueAt: '2026-07-20T09:00:00.000Z',
        description: 'Use the lecture notes.',
        links: ['https://canvas.example.edu/courses/1/assignments/2'],
        effortMinutes: 45,
        projectId: null,
      }).description,
    ).toBe('Use the lecture notes.');
  });

  it('requires a task title and ISO due date when provided', () => {
    expect(() => TaskInputSchema.parse({ title: '', kind: 'school' })).toThrow();
    expect(
      TaskInputSchema.parse({
        title: 'Quant set',
        kind: 'school',
        dueAt: '2026-07-18T12:00:00.000Z',
      }).title,
    ).toBe('Quant set');
    expect(
      TaskInputSchema.parse({
        title: 'Canvas assignment',
        kind: 'school',
        dueAt: '2026-07-18T12:00:00+00:00',
        completedAt: '2026-07-18T12:05:00+00:00',
      }).completedAt,
    ).toBe('2026-07-18T12:05:00+00:00');
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
    expect(() =>
      TaskInputSchema.parse({
        title: 'Read',
        kind: 'school',
        links: ['not a url'],
      }),
    ).toThrow();
  });
});
