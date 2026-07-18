import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Agenda, selectAgendaTasks } from '../../components/today/agenda';

const currentHighWeightTask = {
  id: 'current-task',
  title: 'Quant 121 — problem set',
  kind: 'school' as const,
  termId: 'current-term',
  dueAt: '2026-07-18T12:00:00.000Z',
  priority: 'high' as const,
  weightPercent: 25,
  completedAt: null,
  updatedAt: '2026-07-18T08:00:00.000Z',
};

describe('Agenda', () => {
  it('shows only current-term tasks and marks high-weight work', () => {
    const visibleTasks = selectAgendaTasks([
      currentHighWeightTask,
      {
        ...currentHighWeightTask,
        id: 'past-task',
        title: 'Previous term reading',
        termId: 'previous-term',
      },
    ], 'current-term');

    render(<Agenda tasks={visibleTasks} onComplete={vi.fn()} />);

    expect(screen.getByText('Quant 121 — problem set')).not.toBeNull();
    expect(screen.getByText('HIGH IMPACT · 25%')).not.toBeNull();
    expect(screen.queryByText('Previous term reading')).toBeNull();
  });

  it('orders incomplete tasks by due date, priority, then course weight', () => {
    const tasks = selectAgendaTasks([
      { ...currentHighWeightTask, id: 'later', dueAt: '2026-07-19T09:00:00.000Z' },
      { ...currentHighWeightTask, id: 'early', dueAt: '2026-07-18T09:00:00.000Z' },
      { ...currentHighWeightTask, id: 'done', title: 'Already complete', completedAt: '2026-07-18T08:00:00.000Z' },
    ], 'current-term');

    expect(tasks.map((task) => task.id)).toEqual(['early', 'later']);
  });
});
