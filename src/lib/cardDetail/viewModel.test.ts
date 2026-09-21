/**
 * The view model is the contract every shared V2 component reads, so these
 * tests pin the states the legacy page distinguishes — especially the ones
 * that must never be flattened into "grade 0" or "$0".
 */
import { describe, it, expect } from 'vitest';
import { buildCardDetailViewModel, type CardDetailSource } from './viewModel';

const OWNER = 'user-owner-1';

function card(overrides: Partial<CardDetailSource> = {}): CardDetailSource {
  return {
    id: 'card-1',
    user_id: OWNER,
    serial: 'DCM-000123',
    category: 'Pokemon',
    front_url: 'https://cdn.example/front.jpg',
    back_url: 'https://cdn.example/back.jpg',
    visibility: 'public',
    card_name: 'Charizard',
    pokemon_featured: 'Charizard',
    card_set: 'Base Set',
    card_number: '4/102',
    release_date: '1999-01-09',
    rarity_tier: 'Holo Rare',
    conversational_decimal_grade: 9,
    conversational_whole_grade: 9,
    conversational_condition_label: 'Mint',
    conversational_sub_scores: {
      centering: { weighted: 9 },
      corners: { weighted: 10 },
      edges: { weighted: 9 },
      surface: { weighted: 9.4 },
    },
    conversational_limiting_factor: 'Centering',
    conversational_final_grade_summary: 'A strong copy with slight centering drift.',
    dcm_price_estimate: 420.5,
    dcm_price_updated_at: '2026-09-18T04:00:00.000Z',
    ownership_status: 'owned',
    ...overrides,
  };
}

const build = (overrides: Partial<CardDetailSource> = {}, rest: Record<string, unknown> = {}) =>
  buildCardDetailViewModel({
    card: card(overrides),
    category: 'pokemon',
    sessionUserId: OWNER,
    ...rest,
  });

describe('a normal graded card', () => {
  const vm = build();

  it('carries the identity the label prints', () => {
    expect(vm.identity.displayName).toBe('Charizard');
    expect(vm.identity.setName).toBe('Base Set');
    expect(vm.identity.year).toBe('1999');
    expect(vm.identity.cardNumber).toBe('4/102');
    expect(vm.identity.serial).toBe('DCM-000123');
    expect(vm.identity.rarityOrVariant).toBe('Holo Rare');
    expect(vm.identity.contextLine).toContain('Base Set');
  });

  it('reports a graded status with a whole-number grade and condition', () => {
    expect(vm.grade.status).toBe('graded');
    expect(vm.grade.grade).toBe(9);
    expect(vm.grade.gradeFormatted).toBe('9');
    expect(vm.grade.condition).toBe('Mint');
    expect(vm.grade.notGradableReason).toBeNull();
    expect(vm.grade.incompleteInspectionMessage).toBeNull();
  });

  it('rounds the four subgrades', () => {
    expect(vm.grade.subgrades).toEqual({ centering: 9, corners: 10, edges: 9, surface: 9 });
    expect(vm.grade.limitingFactor).toBe('Centering');
    expect(vm.grade.summary).toBe('A strong copy with slight centering drift.');
  });

  it('exposes both images as present', () => {
    expect(vm.images.front).toEqual({ url: 'https://cdn.example/front.jpg', present: true });
    expect(vm.images.back.present).toBe(true);
  });

  it('prices the card and keeps the freshness stamp', () => {
    expect(vm.value.status).toBe('priced');
    expect(vm.value.amount).toBe(420.5);
    expect(vm.value.source).toBe('dcm-estimate');
    expect(vm.value.withheldAmount).toBeNull();
    expect(vm.value.updatedAt).toBe('2026-09-18T04:00:00.000Z');
  });

  it('marks the viewer as the owner of a public, unsold, unbranded card', () => {
    expect(vm.permissions).toEqual({
      isOwner: true,
      isPublic: true,
      isSold: false,
      soldAt: null,
      isOrgBranded: false,
    });
  });

  it('has no detected third-party slab grade and an empty extras bag', () => {
    expect(vm.detectedSlabGrade).toBeNull();
    expect(vm.extras).toEqual({});
  });
});

describe('null grade', () => {
  const ungraded = {
    conversational_decimal_grade: null,
    conversational_whole_grade: null,
    conversational_condition_label: null,
    conversational_sub_scores: null,
    conversational_limiting_factor: null,
    conversational_final_grade_summary: null,
  };

  it('is "ungraded" when nothing explains the absence', () => {
    const vm = build(ungraded);
    expect(vm.grade.status).toBe('ungraded');
    expect(vm.grade.grade).toBeNull();
    expect(vm.grade.gradeFormatted).toBe('N/A');
    expect(vm.grade.condition).toBeNull();
    expect(vm.grade.subgrades).toEqual({ centering: null, corners: null, edges: null, surface: null });
  });

  it('is "not-gradable" when the report gives a grade-cap reason', () => {
    const vm = build({
      ...ungraded,
      conversational_weighted_summary: { grade_cap_reason: 'Creasing through the portrait' },
    });
    expect(vm.grade.status).toBe('not-gradable');
    expect(vm.grade.notGradableReason).toBe('Creasing through the portrait');
  });

  it('is "not-gradable" on a dvg grading_status', () => {
    const vm = build({ ...ungraded, dvg_grading: { grading_status: 'Trimmed - no numeric grade' } });
    expect(vm.grade.status).toBe('not-gradable');
    expect(vm.grade.notGradableReason).toBe('Trimmed - no numeric grade');
  });

  // Legacy suppresses these two statuses; they are engine bookkeeping, not a
  // verdict to show the owner.
  it.each(['DVG disabled for this category', 'Grade N/A'])(
    'ignores the grading_status %p', status => {
      const vm = build({ ...ungraded, dvg_grading: { grading_status: status } });
      expect(vm.grade.status).toBe('ungraded');
      expect(vm.grade.notGradableReason).toBeNull();
    });

  it('is "in-progress" while the fetch is still polling', () => {
    const vm = buildCardDetailViewModel({
      card: card(ungraded),
      category: 'pokemon',
      sessionUserId: OWNER,
      isProcessing: true,
    });
    expect(vm.grade.status).toBe('in-progress');
    expect(vm.grade.grade).toBeNull();
  });

  it('is "incomplete-inspection" when the fetch produced that message, whatever else is set', () => {
    const vm = buildCardDetailViewModel({
      card: card(),
      category: 'pokemon',
      sessionUserId: OWNER,
      incompleteInspectionMessage: 'Inspection incomplete. Your grading credit was refunded.',
    });
    expect(vm.grade.status).toBe('incomplete-inspection');
    expect(vm.grade.grade).toBeNull();
    expect(vm.grade.incompleteInspectionMessage).toContain('Inspection incomplete');
  });
});

describe('altered-authentic', () => {
  it('shows A / Authentic instead of a number', () => {
    const vm = build({
      conversational_decimal_grade: null,
      conversational_whole_grade: null,
      conversational_condition_label: 'Authentic Altered',
    });
    expect(vm.grade.status).toBe('altered-authentic');
    expect(vm.grade.grade).toBeNull();
    expect(vm.grade.gradeFormatted).toBe('A');
    expect(vm.grade.condition).toBe('Authentic');
  });

  // v9.23: the unverified-autograph designation rides ALONGSIDE a full grade.
  it('keeps the numeric grade for an unverified autograph and carries the designation', () => {
    const vm = build({
      conversational_condition_label: 'Altered - Unverified Autograph',
      autographed: true,
      autograph_type: 'unverified',
    });
    expect(vm.grade.status).toBe('graded');
    expect(vm.grade.grade).toBe(9);
    expect(vm.grade.designation).toBe('Altered - Unverified Autograph');
  });
});

describe('value', () => {
  it('withholds a price the guard does not trust, without zeroing it', () => {
    // Over VALUE_GUARD_THRESHOLD ($500) with no set to vouch for it.
    const vm = build({
      dcm_price_estimate: 1200,
      card_set: null,
      release_date: null,
      conversational_card_info: null,
    });
    expect(vm.value.status).toBe('withheld');
    expect(vm.value.amount).toBeNull();
    expect(vm.value.source).toBe('withheld');
    expect(vm.value.withheldAmount).toBe(1200);
    expect(vm.value.withheldReason).toBeTruthy();
  });

  it('reports "unavailable" when the card has never been priced', () => {
    const vm = build({
      dcm_price_estimate: null,
      dcm_cached_prices: null,
      ebay_price_median: null,
      dcm_price_updated_at: null,
    });
    expect(vm.value.status).toBe('unavailable');
    expect(vm.value.amount).toBeNull();
    expect(vm.value.source).toBe('none');
    expect(vm.value.updatedAt).toBeNull();
  });

  it('falls through to the eBay median and names the source', () => {
    const vm = build({ dcm_price_estimate: null, dcm_cached_prices: null, ebay_price_median: 88 });
    expect(vm.value.status).toBe('priced');
    expect(vm.value.amount).toBe(88);
    expect(vm.value.source).toBe('ebay-median');
  });
});

describe('images', () => {
  it('marks a missing back image explicitly rather than emitting an empty string', () => {
    const vm = build({ back_url: null });
    expect(vm.images.back).toEqual({ url: null, present: false });
    expect(vm.images.front.present).toBe(true);
  });

  it('treats a blank URL as missing', () => {
    const vm = build({ front_url: '   ', back_url: '' });
    expect(vm.images.front.present).toBe(false);
    expect(vm.images.back.present).toBe(false);
  });
});

describe('permissions', () => {
  it('reports a sold card and keeps the sold date', () => {
    const vm = build({ ownership_status: 'sold', sold_at: '2026-09-01T00:00:00.000Z' });
    expect(vm.permissions.isSold).toBe(true);
    expect(vm.permissions.soldAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is not the owner for a different session, or for none', () => {
    const someoneElse = buildCardDetailViewModel({
      card: card(), category: 'pokemon', sessionUserId: 'user-other',
    });
    expect(someoneElse.permissions.isOwner).toBe(false);

    const signedOut = buildCardDetailViewModel({ card: card(), category: 'pokemon' });
    expect(signedOut.permissions.isOwner).toBe(false);
  });

  it('treats private and absent visibility as not public', () => {
    expect(build({ visibility: 'private' }).permissions.isPublic).toBe(false);
    expect(build({ visibility: null }).permissions.isPublic).toBe(false);
  });

  it('flags an org-branded card', () => {
    expect(build({ org_id: 'org-7' }).permissions.isOrgBranded).toBe(true);
  });
});

describe('detected third-party slab grade', () => {
  it('is kept separate from the DCM grade', () => {
    const vm = build({
      slab_detected: true,
      slab_company: 'PSA',
      slab_grade: '9',
      slab_grade_description: 'Mint',
      slab_cert_number: '12345678',
    });
    expect(vm.detectedSlabGrade).toEqual({
      company: 'PSA', grade: '9', description: 'Mint', certNumber: '12345678',
    });
    // The DCM grade is untouched by the holder's grade.
    expect(vm.grade.grade).toBe(9);
    expect(vm.grade.status).toBe('graded');
  });

  it('needs a company, not just a detection', () => {
    expect(build({ slab_detected: true, slab_company: null }).detectedSlabGrade).toBeNull();
  });

  it('accepts the conversational detection flag', () => {
    const vm = build({ conversational_slab_detection: { detected: true }, slab_company: 'BGS' });
    expect(vm.detectedSlabGrade?.company).toBe('BGS');
  });
});

describe('extras', () => {
  it('carries category-specific fields without touching the core model', () => {
    const vm = buildCardDetailViewModel({
      card: card(),
      category: 'pokemon',
      sessionUserId: OWNER,
      extras: { pokemonType: 'Fire', hp: '170' },
    });
    expect(vm.extras).toEqual({ pokemonType: 'Fire', hp: '170' });
    expect(vm.category).toBe('pokemon');
  });
});
