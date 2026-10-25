import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/data/reports';
import { parseReportFilters } from '@/lib/validation/report';

describe('CSV export', () => {
  const cols = [{ key: 'a', label: 'Team' }, { key: 'b', label: 'Note' }];
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(cols, [{ a: 'Alpha, Inc', b: 'said "hi"\nbye' }]);
    expect(csv.split('\r\n')[1]).toBe('"Alpha, Inc","said ""hi""\nbye"');
  });
  it('neutralises spreadsheet formulas (CSV injection)', () => {
    const csv = toCsv(cols, [{ a: '=HYPERLINK("http://evil")', b: '+1+1' }, { a: '@SUM(A1)', b: '-2' }]);
    const lines = csv.trim().split('\r\n');
    expect(lines[1].startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(lines[1].endsWith(`,'+1+1`)).toBe(true);
    expect(lines[2]).toBe(`'@SUM(A1),'-2`);
  });
  it('writes dates as YYYY-MM-DD and empty cells as blanks', () => {
    expect(toCsv(cols, [{ a: new Date('2026-10-23T10:00:00Z'), b: null }]).split('\r\n')[1]).toBe('2026-10-23,');
  });
});

describe('report filter parsing', () => {
  it('applies defaults and ignores empty values', () => {
    expect(parseReportFilters({ courseId: '', status: '' })).toMatchObject({ min: 0, threshold: 60, level: 'high', overdueOnly: false, dir: 'desc', courseId: undefined });
  });
  it('rejects nonsense with an error instead of passing it on', () => {
    expect(() => parseReportFilters({ courseId: 'abc' })).toThrow();
    expect(() => parseReportFilters({ level: 'catastrophic' })).toThrow();
    expect(() => parseReportFilters({ threshold: '250' })).toThrow();
    expect(() => parseReportFilters({ dir: 'sideways' })).toThrow();
  });
});
