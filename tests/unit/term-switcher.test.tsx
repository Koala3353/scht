// -environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TermSwitcher } from '../../components/layout/term-switcher';

describe('TermSwitcher', () => {
  it('calls onChange with the selected term id', async () => {
    const onChange = vi.fn();
    render(<TermSwitcher terms={[{ id: 't1', label: '2026–2027 · First Semester' }]} value="t1" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Current academic term'), 't1');
    expect(onChange).toHaveBeenCalledWith('t1');
  });
});
