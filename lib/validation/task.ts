import { z } from 'zod';

export const TaskInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  kind: z.enum(['school', 'work', 'personal']),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  termId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  weightPercent: z.number().min(0).max(100).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;
