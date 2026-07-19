import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CorePageQueryError, requireQuery } from '../../lib/queries/core-page-query-error';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const providerPages = [
  ['calendar', 'calendar connections'],
  ['today', 'today connections'],
  ['planner', 'task connections'],
  ['subjects', 'subject connections'],
] as const;

describe('provider-backed page connection reads', () => {
  it.each(providerPages)('%s forwards a failed connection read to the core query boundary', (page, queryName) => {
    const source = readFileSync(
      path.resolve(testDirectory, `../../app/(app)/${page}/page.tsx`),
      'utf8',
    );

    expect(source).toContain(`requireQuery(connectionsResult, "${queryName}")`);
  });

  it('throws instead of converting a connection read error into a quiet not-connected state', () => {
    expect(() => requireQuery({ data: [], error: new Error('database unavailable') }, 'calendar connections'))
      .toThrow(CorePageQueryError);
  });
});
