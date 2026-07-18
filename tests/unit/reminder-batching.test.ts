import { describe, expect, it } from 'vitest';
import { idempotencyKey, nextRetryAt, selectReminderBatch } from '../../lib/reminders/batching';

describe('reminder batching', () => {
  it('limits a run to its configured capacity and defers overflow', () => {
    const result = selectReminderBatch([{ id: 'a', sendAt: '2026-07-18T07:00:00.000Z', attempts: 0 }, { id: 'b', sendAt: '2026-07-18T08:00:00.000Z', attempts: 0 }], new Date('2026-07-18T09:00:00.000Z'), 1);
    expect(result.ready.map(({ id }) => id)).toEqual(['a']);
    expect(result.deferred.map(({ id }) => id)).toEqual(['b']);
  });
  it('uses a stable delivery key and bounded exponential retry', () => {
    expect(idempotencyKey('reminder-1', '2026-07-18T09:00:00.000Z')).toBe('reminder-1:2026-07-18T09:00:00.000Z');
    expect(nextRetryAt(new Date(0), 2).toISOString()).toBe('1970-01-01T00:04:00.000Z');
  });
});
