export interface ReminderCandidate { id: string; sendAt: string; attempts: number; }
export interface ReminderBatch { ready: ReminderCandidate[]; deferred: ReminderCandidate[]; }

export function selectReminderBatch(candidates: ReminderCandidate[], now: Date, cap: number): ReminderBatch {
  const due = candidates.filter((candidate) => new Date(candidate.sendAt) <= now).sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  return { ready: due.slice(0, cap), deferred: due.slice(cap) };
}

export function idempotencyKey(reminderId: string, scheduledFor: string) { return `${reminderId}:${scheduledFor}`; }

export function nextRetryAt(now: Date, attempts: number) { return new Date(now.getTime() + Math.min(3_600_000, 60_000 * 2 ** attempts)); }
