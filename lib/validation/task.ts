import { z } from 'zod';

export const TaskInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  kind: z.enum(['school', 'work', 'personal']),
  // Canvas and Postgres commonly return `+00:00`, while browser dates use Z.
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  termId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  weightPercent: z.number().min(0).max(100).nullable().optional(),
  description: z.string().trim().max(5_000).default(''),
  links: z.array(z.url()).max(12).default([]),
  effortMinutes: z.number().int().positive().max(1_440).nullable().optional(),
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;
