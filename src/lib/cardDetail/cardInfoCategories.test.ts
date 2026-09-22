/**
 * The six remaining categories' precedence chains.
 *
 * A sibling of ./cardInfo.test.ts, which covers the shape plus the Pokemon and
 * sports chains. Every expectation here is read off the frozen legacy client
 * named in the test, not invented: the point is that V2 prints what the
 * current page prints.
 */

import { describe, it, expect } from 'vitest';
import { buildCardInfo } from './cardInfo';
import { isFrameTreatment } from './cardInfoCategories';

/* ── The four JSON-first TCGs ─────────────────────────────────────────── */

describe('buildCardInfo — mtg / onepiece / yugioh / starwars', () => {
  const tcgCard = {
    card_set: 'COLUMN SET',
    card_number: 'COLUMN NUMBER',
    release_date: '1999-01-09',
    manufacturer_name: 'COLUMN MAKER',
    conversational_card_info: {
      set_name: '**Zendikar Rising**',
      card_number: '250',
      collector_number: '250a',
      year: '2020',
    },
    dvg_grading: { card_info: { set_name: 'DVG SET' } },
  };

  it('reads the model JSON BEFORE the database columns', () => {
    const info = buildCardInfo(tcgCard, 'mtg');
    expect(info.set_name).toBe('Zendikar Rising');
    expect(info.card_number).toBe('250');
  });

  it('does NOT slice release_date to four characters', () => {
    // Pokemon prints '1999'; these four print the column as the row holds it.
    expect(buildCardInfo({ release_date: '1999-01-09' }, 'mtg').year).toBe('1999-01-09');
  });

  it('falls back to each category own manufacturer', () => {
    expect(buildCardInfo({}, 'mtg').manufacturer).toBe('Wizards of the Coast');
    expect(buildCardInfo({}, 'onepiece').manufacturer).toBe('Bandai');
    expect(buildCardInfo({}, 'yugioh').manufacturer).toBe('Konami');
    expect(buildCardInfo({}, 'starwars').manufacturer).toBe('Topps');
  });

  it('refuses to append a frame treatment to the set name', () => {
    const borderless = buildCardInfo(
      { card_set: 'Zendikar Rising', subset: 'Borderless' },
      'mtg',
    );
    expect(borderless.set_name).toBe('Zendikar Rising');
    // …but the subset is still kept on its own, for the badge.
    expect(borderless.subset).toBe('Borderless');

    const realSubset = buildCardInfo({ card_set: 'Zendikar Rising', subset: 'Expeditions' }, 'mtg');
    expect(realSubset.set_name).toBe('Zendikar Rising - Expeditions');
  });

  it('recognises every frame treatment legacy lists', () => {
    for (const t of ['Showcase', 'borderless', 'Extended Art', 'full art', 'Etched', 'retro', 'Anime']) {
      expect(isFrameTreatment(t)).toBe(true);
    }
    expect(isFrameTreatment('Expeditions')).toBe(false);
    expect(isFrameTreatment(null)).toBe(false);
  });

  it('prefers collector_number for the display number but keeps both', () => {
    const info = buildCardInfo(tcgCard, 'mtg');
    expect(info.collector_number).toBe('250a');
  });

  it('carries the MTG-only fields', () => {
    const info = buildCardInfo(
      {
        conversational_card_info: {
          flavor_name: 'The One Ring',
          mana_cost: '{2}{U}',
          mtg_card_type: 'Artifact',
          is_foil: true,
          is_showcase: true,
        },
      },
      'mtg',
    );
    expect(info.flavor_name).toBe('The One Ring');
    expect(info.mana_cost).toBe('{2}{U}');
    expect(info.mtg_card_type).toBe('Artifact');
    expect(info.is_foil).toBe(true);
    expect(info.is_showcase).toBe(true);
    expect(info.is_borderless).toBe(false);
  });

  it('maps One Piece stats off the GENERIC json keys, as legacy does', () => {
    const info = buildCardInfo(
      {
        conversational_card_info: {
          card_color: 'Red/Green',
          card_power: 5000,
          card_cost: 4,
          life: 5,
          counter_amount: 1000,
          attribute: 'Strike',
          sub_types: 'Straw Hat Crew',
          variant_type: 'parallel_manga',
        },
      },
      'onepiece',
    );
    expect(info.op_card_color).toBe('Red/Green');
    expect(info.op_card_power).toBe(5000);
    expect(info.op_card_cost).toBe(4);
    expect(info.op_life).toBe(5);
    expect(info.op_counter).toBe(1000);
    expect(info.op_attribute).toBe('Strike');
    expect(info.op_sub_types).toBe('Straw Hat Crew');
    expect(info.op_variant_type).toBe('parallel_manga');
  });

  it('maps Yu-Gi-Oh onto the SAME generic keys — ATK is card_power, DEF is card_cost', () => {
    // Legacy yugioh is a copy of legacy onepiece; this mapping is the copy's,
    // reproduced deliberately. See the Yu-Gi-Oh parity doc.
    const info = buildCardInfo(
      {
        conversational_card_info: {
          card_power: 2500,
          card_cost: 2100,
          life: 8,
          counter_amount: 4,
          attribute: 'Dragon',
          sub_types: 'Blue-Eyes',
          variant_type: 'alternate_art',
        },
      },
      'yugioh',
    );
    expect(info.ygo_atk).toBe(2500);
    expect(info.ygo_def).toBe(2100);
    expect(info.ygo_level).toBe(8);
    expect(info.ygo_scale).toBe(4);
    expect(info.ygo_race).toBe('Dragon');
    expect(info.ygo_archetype).toBe('Blue-Eyes');
    expect(info.ygo_frame_type).toBe('alternate_art');
    // The variant FLAGS are driven by the COLUMN `ygo_frame_type`, not by the
    // JSON `variant_type` that feeds the field above. Legacy's chain exactly:
    // `conv.is_alternate_art ?? (card.ygo_frame_type === 'alternate_art')`.
    expect(info.is_alternate_art).toBe(false);
    expect(
      buildCardInfo({ ygo_frame_type: 'alternate_art' }, 'yugioh').is_alternate_art,
    ).toBe(true);
    expect(buildCardInfo({ ygo_frame_type: 'parallel_foil' }, 'yugioh').is_parallel).toBe(true);
    expect(info.is_sp).toBe(false);
  });

  it('keeps the Pokemon NULL-memorabilia quirk for the four TCGs', () => {
    // card.memorabilia_type !== 'none'; NULL !== 'none' is true.
    expect(buildCardInfo({}, 'mtg').memorabilia).toBe(true);
    expect(buildCardInfo({ memorabilia_type: 'none' }, 'mtg').memorabilia).toBe(false);
  });

  it('skips a grader classification bucket for the rarity', () => {
    const info = buildCardInfo(
      { rarity_tier: 'Parallel / Insert Variant', rarity_description: 'Mythic Rare' },
      'mtg',
    );
    expect(info.rarity_tier).toBe('Mythic Rare');
  });
});

/* ── Lorcana ──────────────────────────────────────────────────────────── */

describe('buildCardInfo — lorcana', () => {
  it('reads the DATABASE COLUMNS first, like Pokemon', () => {
    const info = buildCardInfo(
      {
        card_set: 'Rise of the Floodborn',
        conversational_card_info: { set_name: 'The First Chapter' },
      },
      'lorcana',
    );
    expect(info.set_name).toBe('Rise of the Floodborn');
  });

  it('rejects an invalid column set name and falls through to the JSON', () => {
    for (const bad of ['', 'Unknown', 'n/a', 'Unknown Lorcana Set']) {
      const info = buildCardInfo(
        { card_set: bad, conversational_card_info: { set_name: 'Ursula Return' } },
        'lorcana',
      );
      expect(info.set_name).toBe('Ursula Return');
    }
  });

  it("ends at the literal 'Unknown Set' when nothing is valid", () => {
    expect(buildCardInfo({ card_set: 'Unknown' }, 'lorcana').set_name).toBe('Unknown Set');
  });

  it('appends the subset only when the set name does not already contain it', () => {
    expect(
      buildCardInfo({ card_set: 'Rise of the Floodborn', subset: 'Enchanted' }, 'lorcana').set_name,
    ).toBe('Rise of the Floodborn - Enchanted');
    expect(
      buildCardInfo({ card_set: 'Enchanted Promos', subset: 'Enchanted' }, 'lorcana').set_name,
    ).toBe('Enchanted Promos');
  });

  it('takes the year from release_date RAW, not sliced', () => {
    expect(buildCardInfo({ release_date: '2023-11-17' }, 'lorcana').year).toBe('2023-11-17');
  });

  it('carries the Lorcana-only fields, columns first', () => {
    const info = buildCardInfo(
      {
        ink_color: 'Emerald',
        ink_cost: 3,
        lore_value: 1,
        is_enchanted: false,
        conversational_card_info: { ink_color: 'Ruby', is_enchanted: true },
      },
      'lorcana',
    );
    expect(info.ink_color).toBe('Emerald');
    expect(info.ink_cost).toBe(3);
    expect(info.lore_value).toBe(1);
    // The column is defined, so it wins even when it is false.
    expect(info.is_enchanted).toBe(false);
  });

  it("defaults the franchise to 'Disney' and the language to 'English'", () => {
    const info = buildCardInfo({}, 'lorcana');
    expect(info.franchise).toBe('Disney');
    expect(info.language).toBe('English');
  });
});

/* ── Other ────────────────────────────────────────────────────────────── */

describe('buildCardInfo — other', () => {
  it('reads the model JSON first', () => {
    const info = buildCardInfo(
      { card_set: 'COLUMN SET', conversational_card_info: { set_name: 'Galaxy' } },
      'other',
    );
    expect(info.set_name).toBe('Galaxy');
  });

  it('appends the subset with NO frame-treatment filter', () => {
    expect(buildCardInfo({ card_set: 'Galaxy', subset: 'Borderless' }, 'other').set_name).toBe(
      'Galaxy - Borderless',
    );
  });

  it('reads cards.manufacturer, not manufacturer_name', () => {
    const info = buildCardInfo({ manufacturer: 'Topps', manufacturer_name: 'IGNORED' }, 'other');
    expect(info.manufacturer).toBe('Topps');
    expect(buildCardInfo({ manufacturer_name: 'Topps' }, 'other').manufacturer).toBeNull();
  });

  it('decides autograph and memorabilia from the JSON ALONE', () => {
    // No NULL-memorabilia quirk here: an empty row is false, not true.
    expect(buildCardInfo({}, 'other').memorabilia).toBe(false);
    expect(buildCardInfo({}, 'other').autographed).toBe(false);
    expect(buildCardInfo({ memorabilia_type: 'patch' }, 'other').memorabilia).toBe(false);
    expect(buildCardInfo({ autograph_type: 'authentic' }, 'other').autographed).toBe(false);
    expect(
      buildCardInfo({ conversational_card_info: { autographed: 'yes' } }, 'other').autographed,
    ).toBe(true);
    expect(
      buildCardInfo({ conversational_card_info: { memorabilia: true } }, 'other').memorabilia,
    ).toBe(true);
  });

  it('carries the Other-only fields', () => {
    const info = buildCardInfo(
      {
        card_date: 'Nov 1977',
        conversational_card_info: {
          special_features: 'Die-cut',
          front_text: 'FRONT',
          back_text: 'BACK',
          facsimile_autograph: true,
        },
      },
      'other',
    );
    expect(info.card_date).toBe('Nov 1977');
    expect(info.special_features).toBe('Die-cut');
    expect(info.front_text).toBe('FRONT');
    expect(info.back_text).toBe('BACK');
    expect(info.facsimile_autograph).toBe(true);
    expect(info.official_reprint).toBe(false);
  });

  it('takes the year from release_date RAW, not sliced', () => {
    expect(buildCardInfo({ release_date: '1977-11-01' }, 'other').year).toBe('1977-11-01');
  });
});

/* ── Dispatch ─────────────────────────────────────────────────────────── */

describe('buildCardInfo — category dispatch', () => {
  it('normalises the category the way the rarity module does', () => {
    // 'Yu-Gi-Oh!' and 'One Piece' are how cards.category spells them.
    expect(buildCardInfo({}, 'Yu-Gi-Oh!').manufacturer).toBe('Konami');
    expect(buildCardInfo({}, 'One Piece').manufacturer).toBe('Bandai');
    expect(buildCardInfo({}, 'MTG').manufacturer).toBe('Wizards of the Coast');
  });

  it('answers from the row category when the caller names none', () => {
    expect(buildCardInfo({ category: 'Lorcana', card_set: 'Azurite Sea' }).franchise).toBe('Disney');
  });

  it('still routes an unrecognised category through the Pokemon chain', () => {
    expect(buildCardInfo({ release_date: '1999-01-09' }, 'naruto').year).toBe('1999');
  });
});
