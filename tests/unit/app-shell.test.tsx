import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../../app/manifest';
import { AppShell } from '../../components/layout/app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/image', () => ({ default: () => <span aria-hidden="true" /> }));

describe('PWA manifest', () => {
  it('declares a standalone installable application', () => {
    expect(manifest().display).toBe('standalone');
    expect(manifest().name).toBe('Scht');
    expect(manifest().icons).toEqual(
      expect.arrayContaining([expect.objectContaining({ sizes: '192x192' })]),
    );
  });

  it('keeps every primary destination accessible without a Work destination', () => {
    render(<AppShell header={<p>Header</p>}><p>Content</p></AppShell>);

    expect(screen.queryByRole('link', { name: 'Work' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Tasks' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Subjects' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Grades' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'AI' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Help' }).length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('navigation', { name: 'Mobile navigation' }))
        .getByRole('link', { name: 'More' })
        .getAttribute('href'),
    ).toBe('/settings');
  });

  it('uses prefetched client links for app navigation instead of document reloads', () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const shell = readFileSync(
      path.resolve(testDirectory, '../../components/layout/app-shell.tsx'),
      'utf8',
    );

    expect(shell).toContain('import Link from "next/link"');
    expect(shell).toContain('prefetch');
    expect(shell).not.toMatch(/<a\s[\s\S]*?href=\{href\}/);
  });
});
