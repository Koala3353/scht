import { describe, expect, it } from 'vitest';
import { inspectIps, parseIps } from '../../lib/curriculum/ips-parser';

describe('parseIps', () => {
  it('parses semester rows and ignores total/unit summary lines', () => {
    const rows = parseIps('First Year\nFirst Semester\nStatus Category No Units Category Required? Override Prerequisite?\nP ENLIT 12 3 C Y N\nUnits Taken: 23.00');

    expect(rows).toEqual([
      expect.objectContaining({
        programYear: 1,
        term: 'First Semester',
        courseCode: 'ENLIT 12',
        units: 3,
        status: 'P',
      }),
    ]);
  });

  it('keeps multi-token course codes and parses all supported terms', () => {
    const rows = parseIps([
      'Second Year',
      'Intersession',
      'P NSTP 11(CWTS) 3 GE Y N',
      'Second Semester',
      'C ANALYTICS ELECTIVE 1.5 EL N Y',
    ].join('\n'));

    expect(rows).toEqual([
      {
        programYear: 2,
        term: 'Intersession',
        status: 'P',
        courseCode: 'NSTP 11(CWTS)',
        units: 3,
        category: 'GE',
        required: true,
        prerequisiteOverride: false,
      },
      {
        programYear: 2,
        term: 'Second Semester',
        status: 'C',
        courseCode: 'ANALYTICS ELECTIVE',
        units: 1.5,
        category: 'EL',
        required: false,
        prerequisiteOverride: true,
      },
    ]);
  });

  it('reports malformed non-empty rows without creating records', () => {
    const result = inspectIps([
      'Third Year',
      'First Semester',
      'P VALID 101 3 C Y N',
      'this is not a curriculum row',
      'P BAD 101 two C Y N',
      '',
      'Units Taken: 19.00',
    ].join('\n'));

    expect(result.rows).toHaveLength(1);
    expect(result.invalidLineCount).toBe(2);
  });
});
