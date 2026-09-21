/**
 * The anchor map is a contract with two files that do not export their lists:
 * `OnboardingTour`'s TOUR_STEPS and `ReportSectionNav`'s `sections`. Rather
 * than widen either module's public API for a test, the test reads their
 * source and pulls the ids out of it. That has the useful property of failing
 * when someone adds a tour step or a nav link and forgets the map — which is
 * exactly the regression this guards against.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  CARD_DETAIL_SECTIONS,
  LEGACY_ANCHOR_IDS,
  LEGACY_ANCHOR_SECTIONS,
  resolveHashTarget,
  sectionForAnchor,
  V2_ANCHOR_IDS,
} from './anchorMap';

const SRC = path.resolve(__dirname, '../..');

function read(relative: string): string {
  return readFileSync(path.join(SRC, relative), 'utf8');
}

/** Every `targetId: 'tour-…'` in the tour's step list. */
function tourTargetIds(): string[] {
  const source = read('components/onboarding/OnboardingTour.tsx');
  const ids = [...source.matchAll(/targetId:\s*'([^']+)'/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

/** Every `['tour-…','Label']` pair in the legacy report nav. */
function reportNavIds(): string[] {
  const source = read('components/design/ReportSectionNav.tsx');
  const navLine = source.split('\n').find((line) => line.includes('const sections =')) ?? '';
  const ids = [...navLine.matchAll(/\['(tour-[^']+)'/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

describe('legacy anchor map', () => {
  it('reads a non-empty step list out of OnboardingTour', () => {
    // Guards the regex itself: a silently empty list would make the next test
    // pass for the wrong reason.
    expect(tourTargetIds().length).toBeGreaterThanOrEqual(12);
  });

  it('reads a non-empty link list out of ReportSectionNav', () => {
    expect(reportNavIds().length).toBeGreaterThanOrEqual(7);
  });

  it('owns every anchor the onboarding tour targets', () => {
    const missing = tourTargetIds().filter((id) => !(id in LEGACY_ANCHOR_SECTIONS));
    expect(missing).toEqual([]);
  });

  it('owns every anchor the legacy report nav links to', () => {
    const missing = reportNavIds().filter((id) => !(id in LEGACY_ANCHOR_SECTIONS));
    expect(missing).toEqual([]);
  });

  it('keeps the fifteen anchor ids the Phase 0 inventory pinned', () => {
    // The inventory counts sixteen anchors because `tour-card-info` appears
    // both as an `id=` and as a `tourId=`; there are fifteen distinct ids.
    expect(LEGACY_ANCHOR_IDS.sort()).toEqual(
      [
        'tour-card-images',
        'tour-card-info',
        'tour-centering',
        'tour-condition-summary',
        'tour-download-buttons',
        'tour-edit-details',
        'tour-grade-score',
        'tour-insta-list',
        'tour-live-market-pricing',
        'tour-market-pricing',
        'tour-market-value',
        'tour-optic-score',
        'tour-pro-estimates',
        'tour-subgrades',
        'tour-visibility-toggle',
      ].sort()
    );
  });

  it('assigns every anchor to the hero or to a real section', () => {
    const allowed = new Set<string>(['hero', ...CARD_DETAIL_SECTIONS]);
    for (const [anchor, owner] of Object.entries(LEGACY_ANCHOR_SECTIONS)) {
      expect(allowed.has(owner), `${anchor} -> ${owner}`).toBe(true);
    }
  });

  it('resolves the V2-native evidence anchors to the grade section', () => {
    for (const id of V2_ANCHOR_IDS) {
      expect(sectionForAnchor(id)).toBe('grade');
      expect(LEGACY_ANCHOR_IDS).not.toContain(id);
    }
    expect(resolveHashTarget('#cd-evidence-corners')).toEqual({
      section: 'grade',
      anchorId: 'cd-evidence-corners',
    });
  });

  it('does not claim ids that are not legacy anchors', () => {
    expect(sectionForAnchor('tour-does-not-exist')).toBeNull();
    expect(sectionForAnchor('')).toBeNull();
  });
});

describe('resolveHashTarget', () => {
  it('ignores an empty or foreign hash', () => {
    expect(resolveHashTarget(undefined)).toBeNull();
    expect(resolveHashTarget('')).toBeNull();
    expect(resolveHashTarget('#')).toBeNull();
    expect(resolveHashTarget('#some-other-page-anchor')).toBeNull();
  });

  it('activates a section named directly', () => {
    expect(resolveHashTarget('#grade')).toEqual({ section: 'grade', anchorId: null });
    expect(resolveHashTarget('market')).toEqual({ section: 'market', anchorId: null });
  });

  it('activates the owning section of a legacy anchor and keeps the scroll target', () => {
    expect(resolveHashTarget('#tour-centering')).toEqual({
      section: 'grade',
      anchorId: 'tour-centering',
    });
    expect(resolveHashTarget('#tour-download-buttons')).toEqual({
      section: 'reports',
      anchorId: 'tour-download-buttons',
    });
  });

  it('scrolls to a hero anchor without touching the active section', () => {
    expect(resolveHashTarget('#tour-subgrades')).toEqual({
      section: null,
      anchorId: 'tour-subgrades',
    });
  });
});
