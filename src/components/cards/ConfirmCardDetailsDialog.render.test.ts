/**
 * Render smoke test. There is no browser harness in this repo, so this draws the
 * confirmation dialog to static HTML for a real-shaped card (the owner-confirmed
 * 1977 Wonder Bread Luke Skywalker that production stored as set "Unknown", no
 * year, maker "Twentieth Century-Fox") and checks what an owner would read.
 */
import { describe, expect, it, vi } from 'vitest';

// The dialog imports the browser auth helper, which builds a Supabase client at import time.
vi.mock('@/lib/directAuth', () => ({ getStoredSession: () => null }));

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfirmCardDetailsDialog, { type IdentityReviewState } from './ConfirmCardDetailsDialog';
import { buildReviewPrefill } from '@/lib/identity/reviewPrefill';

const f = (value: string | null, source: string) => ({ value, source });
const firstLook = {
  version: 'first-look-v1', pass: 'contract_with_search', search_ran: true, searches: 2,
  result: {
    photos: { item_type: 'trading_card', item_type_evidence: 'standard card', same_item_both_photos: 'yes', front_shows: 'card_front', back_shows: 'card_back', card_orientation: 'portrait', in_holder: 'none', text_legibility: 'all_readable' },
    printed_text: { front_title_or_name: 'LUKE SKYWALKER', front_other: 'MARK HAMILL | STAR WARS', back_header: null, card_number_as_printed: 'One',
      copyright_line: '© 1977 Twentieth Century-Fox Film Corp., Inc.', serial_stamp: null, back_parallel_or_product_text: null },
    layout: { border: 'plain black', logo_placement: 'vertical STAR WARS logo on the right', name_panel: 'yellow panel, actor name beneath', back_layout: 'plain cream stock, story text', numbering_style: 'spelled out as the word One' },
    identity: { category: 'entertainment_non_sport', subject: f('Luke Skywalker', 'printed'), card_title: f(null, 'unknown'), year: f('1977', 'inferred'),
      manufacturer: f('Continental Baking Company', 'recognized'), set_name: f('Star Wars Wonder Bread', 'recognized'), insert_or_subset: f(null, 'unknown'),
      card_number: f('1', 'inferred'), language: 'english', licensed_product: 'licensed' },
    parallel: { finish_observed: 'plain_paper_or_gloss', dominant_color_vs_base: null, pattern_observed: null, autograph: 'none', relic_or_patch: false,
      serial_denominator: null, is_base: true, parallel_name: 'Base', decided_by: 'recognized_design' },
    design_features: [], alternatives: [{ differs_in: 'set_name', value: '1977 Topps Star Wars Series 1', what_would_settle_it: 'border colour and back design' }],
  },
};
const card = { id: '20609a0f-6787-43cb-83c5-6803f9c979da', category: 'Other', card_name: 'Luke Skywalker', featured: null, card_set: 'Unknown', release_date: null,
  card_number: null, manufacturer_name: 'Twentieth Century-Fox Film Corp.', conversational_card_info: {} };

function reviewState(): IdentityReviewState {
  const prefill: any = buildReviewPrefill(card as any, firstLook.result as any);
  const fields = Array.isArray(prefill) ? prefill : prefill.fields;
  return { card_id: card.id, mode: 'popup', reason: 'eligible', locked: false, identity_revision: 0, identity_confirmed: false, dismissed: false, category: 'Other',
    is_sports: false, fields, alternatives: (Array.isArray(prefill) ? firstLook.result.alternatives : prefill.alternatives ?? firstLook.result.alternatives) as any,
    first_look_present: true, candidates: [], candidates_available: false, candidates_error: false, suggested_candidate_id: '' };
}

// Next compiles JSX with the automatic runtime; vitest's esbuild uses the classic one, which expects a global React.
(globalThis as any).React = React;

describe('confirmation dialog renders for a real-shaped card', () => {
  const html = renderToStaticMarkup(createElement(ConfirmCardDetailsDialog as any, {
    cardId: card.id, review: reviewState(), frontUrl: 'https://example.test/front.jpg', backUrl: 'https://example.test/back.jpg',
    onClose: () => {}, onDismissed: () => {}, onSaved: () => {}, onOpenMoreDetails: () => {}, onReload: async () => null, fetchFirstLook: false,
  }));
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('draws the dialog, both photos and an accessible frame', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(text).toContain('Confirm your card details');
    expect(html).toContain('front.jpg');
    expect(html).toContain('back.jpg');
  });
  it('fills the blanks production left, and marks recognised values for checking', () => {
    expect(html).toContain('value="1977"');
    expect(html).toContain('value="Star Wars Wonder Bread"');
    expect(text).toContain('Please check');
  });
  it('never silently drops what was on file, and offers the look-alike product', () => {
    // The stored maker (a film studio) is non-blank, so it stays and first look's maker is a suggestion.
    expect(html).toContain('value="Twentieth Century-Fox Film Corp."');
    expect(text).toContain('Possible manufacturer alternative: Continental Baking Company');
    expect(text).toContain('Could also be');
    expect(text).toContain('Market pricing match');
    expect(text).toContain('No market pricing match yet');
    expect(text).toContain('1977 Topps Star Wars Series 1');
  });
  it('has the three ways out and no em dashes or "AI" in what the owner reads', () => {
    expect(text).toMatch(/Looks correct|Update details/);
    expect(text).toContain('Reset to original findings');
    expect(text).toContain('Review later');
    expect(text).toContain('More details');
    expect(text).not.toContain('—');
    expect(text).not.toMatch(/\bAI\b/);
  });
  it('prints the visible text for a human to read in the test log', () => { console.log('\nDIALOG TEXT:\n' + text + '\n'); });
});
