import { describe, expect, it } from 'vitest';
import { normalizeFirstLook, type FirstLook } from './firstLook';
import { needsSearchPass } from './firstLookRunner';

const f = (value: string | null, source: any) => ({ value, source });
const make = (over: (v: FirstLook) => void = () => {}): FirstLook => {
  const v: FirstLook = {
    photos: { item_type: 'trading_card', item_type_evidence: 'standard card', same_item_both_photos: 'yes', front_shows: 'card_front', back_shows: 'card_back', card_orientation: 'landscape', in_holder: 'none', text_legibility: 'all_readable' },
    printed_text: { front_title_or_name: 'The villainous Darth Vader', front_other: 'STAR WARS', back_header: null, card_number_as_printed: '7',
      copyright_line: '© 1977 20TH CENTURY-FOX FILM CORP.', serial_stamp: null, back_parallel_or_product_text: null },
    layout: { border: 'blue with white stars', logo_placement: 'starburst bottom left', name_panel: 'caption in the blue border', back_layout: 'puzzle piece, no text', numbering_style: 'numeral in the starburst' },
    identity: { category: 'entertainment_non_sport', subject: f('Darth Vader', 'printed'), card_title: f('The villainous Darth Vader', 'printed'), year: f('1977', 'inferred'),
      manufacturer: f('Topps', 'recognized'), set_name: f('Star Wars Series 1', 'recognized'), insert_or_subset: f(null, 'unknown'), card_number: f('7', 'printed'),
      language: 'english', licensed_product: 'licensed' },
    parallel: { finish_observed: 'plain_paper_or_gloss', dominant_color_vs_base: null, pattern_observed: null, autograph: 'none', relic_or_patch: false,
      serial_denominator: null, is_base: true, parallel_name: 'Base', decided_by: 'recognized_design' },
    design_features: [], alternatives: [],
  };
  over(v);
  return v;
};

describe('first-look consistency pass', () => {
  it('leaves a consistent answer untouched', () => {
    expect(normalizeFirstLook(make()).repairs).toEqual([]);
  });
  it('downgrades a "printed" claim the transcription does not back', () => {
    const { value, repairs } = normalizeFirstLook(make(v => { v.identity.manufacturer = f('Topps', 'printed'); }));
    expect(value.identity.manufacturer).toEqual({ value: 'Topps', source: 'recognized' });
    expect(repairs.join(' ')).toContain('claimed printed');
  });
  it('keeps value and source in step', () => {
    const { value } = normalizeFirstLook(make(v => { v.identity.insert_or_subset = f(null, 'recognized'); v.identity.set_name = f('Flair', 'unknown'); }));
    expect(value.identity.insert_or_subset.source).toBe('unknown');
    expect(value.identity.set_name.source).toBe('recognized');
  });
  it('takes the serial run from the stamp that was read, and never from thin air', () => {
    expect(normalizeFirstLook(make(v => { v.parallel.serial_denominator = 99; })).value.parallel.serial_denominator).toBeNull();
    const stamped = normalizeFirstLook(make(v => { v.printed_text.serial_stamp = '05/10'; v.parallel.serial_denominator = 99; v.parallel.is_base = true; }));
    expect(stamped.value.parallel.serial_denominator).toBe(10);
    // A serial-numbered card is not base, and "Base" cannot survive as its name.
    expect(stamped.value.parallel.is_base).toBe(false);
    expect(stamped.value.parallel.parallel_name).toBeNull();
  });
  it('holds set_name to one form and year to YYYY or YYYY-YY', () => {
    const { value } = normalizeFirstLook(make(v => { v.identity.set_name = f('1995-96 Flair Basketball', 'recognized'); v.identity.year = f('circa 1995', 'inferred'); }));
    expect(value.identity.set_name.value).toBe('Flair');
    expect(value.identity.year).toEqual({ value: null, source: 'unknown' });
    expect(normalizeFirstLook(make(v => { v.identity.year = f('1995-96', 'recognized'); })).value.identity.year.value).toBe('1995-96');
  });
});

describe('when the search pass is worth its cost', () => {
  it('skips a card that prints its own set and number', () => {
    expect(needsSearchPass(make(v => { v.printed_text.front_other = 'PRIZM'; v.identity.set_name = f('Prizm', 'printed'); }))).toBe(false);
  });
  it('runs when the set was only recognized (the Wonder Bread vs Topps case) or no number was read', () => {
    expect(needsSearchPass(make())).toBe(true);
    expect(needsSearchPass(make(v => { v.identity.set_name = f('Prizm', 'printed'); v.identity.card_number = f(null, 'unknown'); }))).toBe(true);
  });
});
