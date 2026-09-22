import { describe, it, expect } from 'vitest';
import { CARD_REPORT_EXPORTS } from './reportExports';

describe('CARD_REPORT_EXPORTS', () => {
  it('lists the four report exports, and no label', () => {
    expect(CARD_REPORT_EXPORTS.map((r) => r.kind)).toEqual([
      'report',
      'mini-pdf',
      'mini-jpg',
      'card-images',
    ]);
  });

  it('never offers a printable holder label here', () => {
    const words = CARD_REPORT_EXPORTS.map((r) => `${r.name} ${r.summary}`.toLowerCase()).join(' ');
    expect(words).not.toContain('avery');
    expect(words).not.toContain('toploader');
    expect(words).not.toContain('one-touch');
    expect(words).not.toContain('slab');
  });

  it('gives every export a name, a format, a summary and an action', () => {
    for (const entry of CARD_REPORT_EXPORTS) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.format.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(20);
      expect(entry.action.length).toBeGreaterThan(0);
    }
  });

  it('has a unique kind per entry', () => {
    const kinds = CARD_REPORT_EXPORTS.map((r) => r.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
