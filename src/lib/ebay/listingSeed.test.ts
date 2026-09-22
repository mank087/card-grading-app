/**
 * The shared seed helpers, which exist so the card-detail InstaList tab and
 * `EbayListingModal` cannot produce different defaults for the same card.
 *
 * PARITY is the point of the first block: `resolveSeedDefaults` +
 * `buildSeededDefaults` are asserted to reproduce, step for step, what the
 * modal's open effect used to do inline — build the title with
 * `buildEbayTitle({ ...titleInput, gradeLabel })`, rebuild the keyword sentence
 * with `buildKeywordSentence(fields, gradeLabel, fields.grade)`, and render the
 * description through the saved template when there is one.
 */

import { describe, it, expect } from 'vitest';
import { buildListingDraft, type ListingDefaultsPayload } from './listingDraft';
import { buildEbayTitle } from './titleBuilder';
import { buildKeywordSentence } from './listingFields';
import {
  buildListingHeadline,
  generateHtmlDescription,
  renderDescriptionTemplate,
} from './listingDescription';
import {
  applyInitialDraft,
  buildSeededDefaults,
  renderDescriptionForTitle,
  resolveSeedDefaults,
  retitleDescriptionHtml,
  seedListingPrice,
  EBAY_TITLE_MAX_LENGTH,
} from './listingSeed';

function card(extra: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    grade: 9,
    card_name: 'Charizard',
    card_set: 'Base Set',
    card_number: '4',
    category: 'pokemon',
    conversational_card_info: { set_name: 'Base Set', card_number: '4' },
    conversational_sub_scores: {
      centering: { weighted: 9 },
      corners: { weighted: 9 },
      edges: { weighted: 9 },
      surface: { weighted: 9 },
    },
    serial: 'DCM-0001',
    ...extra,
  };
}

function defaultsPayload(row: Record<string, unknown>, orgId: string | null = null): ListingDefaultsPayload {
  return {
    personal: {
      descriptionTemplate: null,
      shippingDefaults: null,
      titleGradeLabel: null,
      ...row,
    } as never,
    org: null,
    orgRole: null,
    orgId,
  };
}

describe('resolveSeedDefaults', () => {
  it('reports no re-render when the account has no grade label', () => {
    const draft = buildListingDraft(card(), { cardType: 'pokemon' });
    const r = resolveSeedDefaults(card(), defaultsPayload({}), draft);
    expect(r.gradeLabel).toBeNull();
    expect(r.relabelledTitle).toBeNull();
    expect(r.descriptionFieldsPatch).toBeNull();
    expect(r.template).toBeNull();
  });

  it('reproduces the modal’s own title re-render for a store grade label', () => {
    const c = card();
    const draft = buildListingDraft(c, { cardType: 'pokemon' });
    const r = resolveSeedDefaults(c, defaultsPayload({ titleGradeLabel: 'KINGS' }), draft);

    // Exactly the two calls the modal made inline before this helper existed.
    expect(r.relabelledTitle).toBe(buildEbayTitle({ ...draft.titleInput, gradeLabel: 'KINGS' }));
    expect(r.descriptionFieldsPatch).toEqual({
      gradeLabel: 'KINGS',
      keywords: buildKeywordSentence(draft.fields, 'KINGS', draft.fields.grade),
    });
  });

  it('carries the saved description template through', () => {
    const c = card();
    const draft = buildListingDraft(c, { cardType: 'pokemon' });
    const r = resolveSeedDefaults(c, defaultsPayload({ descriptionTemplate: '<p>{{title}}</p>' }), draft);
    expect(r.template).toBe('<p>{{title}}</p>');
  });

  it('does NOT apply an org row to a card that org did not grade', () => {
    const c = card({ org_id: 'org-B' });
    const draft = buildListingDraft(c, { cardType: 'pokemon' });
    const payload: ListingDefaultsPayload = {
      personal: { descriptionTemplate: null, shippingDefaults: null, titleGradeLabel: null },
      org: { descriptionTemplate: '<p>org</p>', shippingDefaults: null, titleGradeLabel: 'ORGA' },
      orgRole: 'owner',
      orgId: 'org-A',
    };
    const r = resolveSeedDefaults(c, payload, draft);
    expect(r.gradeLabel).toBeNull();
    expect(r.template).toBeNull();
  });
});

describe('buildSeededDefaults', () => {
  it('is the plain draft when nothing is saved', () => {
    const c = card();
    const draft = buildListingDraft(c, { cardType: 'pokemon' });
    const seeded = buildSeededDefaults(c ? draft : draft, resolveSeedDefaults(c, null, draft), null);
    expect(seeded.title).toBe(draft.title);
    expect(seeded.descriptionHtml).toBe(
      generateHtmlDescription(draft.descriptionFields, null),
    );
  });

  it('renders through the saved template, with the relabelled title in the fields', () => {
    const c = card();
    const draft = buildListingDraft(c, { cardType: 'pokemon' });
    const resolution = resolveSeedDefaults(
      c,
      defaultsPayload({ titleGradeLabel: 'KINGS', descriptionTemplate: '<p>{{title}}</p>' }),
      draft,
    );
    const seeded = buildSeededDefaults(draft, resolution, null);

    expect(seeded.title).toBe(resolution.relabelledTitle);
    expect(seeded.descriptionFields.gradeLabel).toBe('KINGS');
    expect(seeded.descriptionFields.title).toBe(resolution.relabelledTitle);
    expect(seeded.descriptionHtml).toBe(
      renderDescriptionTemplate('<p>{{title}}</p>', seeded.descriptionFields, null),
    );
  });
});

describe('the description heading follows the title', () => {
  const c = card();
  const draft = buildListingDraft(c, { cardType: 'pokemon' });

  it('renders the new title into the standard layout’s headline', () => {
    const next = renderDescriptionForTitle(draft.descriptionFields, 'A brand new title', null, null);
    expect(next).toContain(buildListingHeadline('A brand new title'));
    expect(next).not.toContain(buildListingHeadline(draft.title));
    // It is the real builder, not a patched string.
    expect(next).toBe(
      generateHtmlDescription({ ...draft.descriptionFields, title: 'A brand new title' }, null),
    );
  });

  it('swaps only the headline inside a hand-edited description', () => {
    const handEdited = draft.descriptionHtml.replace(
      '</div>',
      '<p>MY OWN SENTENCE</p></div>',
    );
    expect(handEdited).toContain('MY OWN SENTENCE');

    const next = retitleDescriptionHtml(handEdited, draft.title, 'A brand new title');
    expect(next).toContain(buildListingHeadline('A brand new title'));
    expect(next).not.toContain(buildListingHeadline(draft.title));
    expect(next).toContain('MY OWN SENTENCE');
  });

  it('escapes a title with HTML in it rather than injecting it', () => {
    const nasty = '<img src=x onerror=alert(1)>';
    const next = retitleDescriptionHtml(draft.descriptionHtml, draft.title, nasty);
    expect(next).not.toContain('onerror=alert(1)>');
    expect(next).toContain('&lt;img');
  });

  it('is a no-op when the title did not change or the headline is gone', () => {
    expect(retitleDescriptionHtml(draft.descriptionHtml, draft.title, draft.title)).toBe(
      draft.descriptionHtml,
    );
    expect(retitleDescriptionHtml('<div>none</div>', draft.title, 'New')).toBe('<div>none</div>');
    expect(retitleDescriptionHtml(draft.descriptionHtml, '', 'New')).toBe(draft.descriptionHtml);
  });

  it('renders through the saved template when there is one', () => {
    const next = renderDescriptionForTitle(
      draft.descriptionFields,
      'A brand new title',
      '<p>{cardName}</p>',
      null,
    );
    expect(next).toBe(
      renderDescriptionTemplate(
        '<p>{cardName}</p>',
        { ...draft.descriptionFields, title: 'A brand new title' },
        null,
      ),
    );
  });
});

describe('seedListingPrice', () => {
  it('leaves an unpriced card blank rather than pre-filling zero', () => {
    expect(seedListingPrice(card())).toEqual({ price: '', label: null });
  });

  it('names the portfolio estimate as the source', () => {
    expect(seedListingPrice(card({ dcm_price_estimate: 123.4 }))).toEqual({
      price: '123.40',
      label: 'Suggested from your portfolio value',
    });
  });

  it('names recent eBay sales when that is what the chain resolved', () => {
    const priced = card({
      ebay_price_median: 55,
      card_set: 'Base Set',
      release_date: '1999-01-09',
      identity_confirmed_revision: 1,
    });
    const seeded = seedListingPrice(priced);
    if (seeded.price) {
      expect(seeded.label).toBe('Suggested from recent eBay sales');
      expect(seeded.price).toBe('55.00');
    }
  });
});

describe('applyInitialDraft — the override precedence', () => {
  const base = {
    defaultTitle: 'Default title',
    defaultDescriptionHtml: '<p>default</p>',
    defaultItemSpecifics: [{ name: 'Brand', value: 'Topps', required: true, editable: true }],
    defaultPrice: '10.00',
    defaultPriceLabel: 'Suggested from your portfolio value',
  };

  it('returns the defaults untouched when there is no initialDraft', () => {
    for (const draft of [undefined, null, {}]) {
      const r = applyInitialDraft({ ...base, initialDraft: draft });
      expect(r.title).toBe(base.defaultTitle);
      expect(r.descriptionHtml).toBe(base.defaultDescriptionHtml);
      expect(r.itemSpecifics).toBe(base.defaultItemSpecifics);
      expect(r.price).toBe(base.defaultPrice);
      expect(r.priceLabel).toBe(base.defaultPriceLabel);
      expect(r.descriptionIsUserEdited).toBe(false);
    }
  });

  it('overrides only the fields that are present', () => {
    const r = applyInitialDraft({ ...base, initialDraft: { title: 'Mine' } });
    expect(r.title).toBe('Mine');
    expect(r.descriptionHtml).toBe(base.defaultDescriptionHtml);
    expect(r.price).toBe(base.defaultPrice);
    expect(r.descriptionIsUserEdited).toBe(false);
  });

  it('flags a supplied description as user-edited so it is never regenerated', () => {
    const r = applyInitialDraft({ ...base, initialDraft: { descriptionHtml: '<p>mine</p>' } });
    expect(r.descriptionHtml).toBe('<p>mine</p>');
    expect(r.descriptionIsUserEdited).toBe(true);
  });

  it('drops the "suggested from…" line once the owner set their own price', () => {
    const r = applyInitialDraft({ ...base, initialDraft: { price: '42.00' } });
    expect(r.price).toBe('42.00');
    expect(r.priceLabel).toBeNull();
  });

  it('keeps a supplied title inside eBay’s 80-character limit', () => {
    const long = 'x'.repeat(200);
    const r = applyInitialDraft({ ...base, initialDraft: { title: long } });
    expect(r.title).toHaveLength(EBAY_TITLE_MAX_LENGTH);
  });

  it('ignores empty values — they mean "not edited", not "blank it"', () => {
    const r = applyInitialDraft({
      ...base,
      initialDraft: { title: '', descriptionHtml: '', price: '', itemSpecifics: [] },
    });
    expect(r.title).toBe(base.defaultTitle);
    expect(r.descriptionHtml).toBe(base.defaultDescriptionHtml);
    expect(r.price).toBe(base.defaultPrice);
    expect(r.itemSpecifics).toBe(base.defaultItemSpecifics);
  });
});
