import { describe, it, expect } from 'vitest';
import {
  AUTOGRAPH_DESIGNATION_ENABLED,
  hasUnverifiedAutograph,
  hasUnverifiedAutographDesignation,
  resolveAutographVerdict,
  UNVERIFIED_AUTOGRAPH_DESIGNATION,
  visibleDesignation,
} from './autographPolicy';
import { resolveListingFields } from '@/lib/ebay/listingFields';
import { recommendedAspectValues } from '@/lib/ebay/itemSpecifics';

// The "Altered - Unverified Autograph" notation is switched off (Oct 2026): more than
// half of the September designations were false. The internal verdict stays.
describe('autograph designation display switch (off)', () => {
  const handSigned = {
    autograph: { present: true, type: 'on-card', authenticated: false, cert_markers: [] },
  };

  it('is off by default', () => {
    expect(AUTOGRAPH_DESIGNATION_ENABLED).toBe(false);
  });

  it('still resolves the internal unverified verdict, without a designation', () => {
    const v = resolveAutographVerdict(handSigned);
    expect(v.present).toBe(true);
    expect(v.unverified).toBe(true);
    expect(v.autographType).toBe('unverified');
    expect(v.designation).toBeNull();
  });

  it('reports no designation for a stored unverified row, but keeps the verdict', () => {
    const row = {
      autograph_type: 'unverified',
      conversational_final_grade_summary:
        'Note: the card carries a hand-applied autograph with no manufacturer authentication and is designated Altered - Unverified Autograph. Final grade: 9 (Mint).',
    };
    expect(hasUnverifiedAutographDesignation(row)).toBe(false);
    expect(hasUnverifiedAutograph(row)).toBe(true);
  });

  it('drops the notation from stored label blobs and passes anything else through', () => {
    expect(visibleDesignation(UNVERIFIED_AUTOGRAPH_DESIGNATION)).toBeNull();
    expect(visibleDesignation(UNVERIFIED_AUTOGRAPH_DESIGNATION.toUpperCase())).toBeNull();
    expect(visibleDesignation(null)).toBeNull();
    expect(visibleDesignation('Some Other Notation')).toBe('Some Other Notation');
  });

  it('keeps eBay "Signed By" empty for an unverified autograph', () => {
    const card = {
      category: 'Sports',
      autographed: true,
      autograph_type: 'unverified',
      conversational_whole_grade: 9,
      conversational_condition_label: 'Mint',
      conversational_card_info: { player_or_character: 'Bo Jackson', card_name: 'Bo Jackson', autographed: true },
    };
    const fields = resolveListingFields(card, 'sports');
    expect(fields.designation).toBeNull();
    expect(fields.unverifiedAutograph).toBe(true);
    expect(fields.autograph).toBe(true);
    expect(recommendedAspectValues(fields)['Signed By']).toBe('');
  });
});
