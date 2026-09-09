/**
 * Sep 2026: sportsChecklist.ts can resolve a vintage sports year from the
 * SportsCardsPro checklist instead of the card face. That year has no
 * year_text_seen — there is no card text to quote — so the guard has to accept
 * source="checklist" on its own terms or the one independently-sourced year in
 * the whole pipeline gets dropped on arrival.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkYearEvidence, applyYearGuard } from './yearGuard';

describe('yearGuard: checklist-sourced years', () => {
  let warn: any; let log: any;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { warn.mockRestore(); log.mockRestore(); });

  it('keeps a checklist year with no transcription', () => {
    const r = checkYearEvidence({ year: '1960', year_source: 'checklist', year_text_seen: null });
    expect(r.outcome).toBe('kept');
    expect(r.year).toBe('1960');
  });

  it('survives applyYearGuard in place', () => {
    const ci: any = { year: '1960', year_source: 'checklist', year_text_seen: null };
    applyYearGuard(ci, 'sports/test');
    expect(ci.year).toBe('1960');
    expect(ci._year_guard.outcome).toBe('kept');
  });

  it('is not second-guessed by the stat table, which is another model reading', () => {
    // A misread stat table would otherwise "correct" the checklist year away.
    const r = checkYearEvidence({
      year: '1960', year_source: 'checklist', year_text_seen: null, last_stat_year: '1965',
    });
    expect(r.outcome).toBe('kept');
    expect(r.year).toBe('1960');
  });

  it('still enforces plausibility on a checklist year', () => {
    expect(checkYearEvidence({ year: '19', year_source: 'checklist' }).outcome)
      .toBe('dropped_implausible');
  });

  it('leaves every other source under the transcription rule', () => {
    expect(checkYearEvidence({ year: '1960', year_source: 'back_copyright', year_text_seen: null }).outcome)
      .toBe('dropped_no_evidence');
    expect(checkYearEvidence({ year: '1960', year_source: 'back_copyright', year_text_seen: '© 1957' }).outcome)
      .toBe('dropped_mismatch');
  });
});
