/**
 * First look's pass 1 must count before the owner confirms (Sept 24 2026): the
 * Espeon-GX read "140/149" in pass 1 (~33s) but was only saved after the search
 * pass, ~194s later, when the owner had already confirmed the wrong number.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirstLook } from './firstLook';

const h = vi.hoisted(() => ({
  pass1: vi.fn(),
  pass2: vi.fn(),
  store: { first_look: null as any },
  after: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: h.pass1 } };
    responses = { create: h.pass2 };
  },
}));
vi.mock('sharp', () => ({
  default: () => {
    const img: any = { rotate: () => img, resize: () => img, jpeg: () => img, toBuffer: async () => Buffer.from('jpeg') };
    return img;
  },
}));
vi.mock('../apiUsageLogger', () => ({ logOpenAIUsage: vi.fn() }));
vi.mock('next/server', () => ({ after: h.after }));
vi.mock('../identity/pokemonCatalogLink', () => ({ reconcileFirstLookNumber: h.reconcile }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const filters: Array<[string, string, unknown]> = [];
      let payload: Record<string, any> | null = null;
      const q: any = {
        select: (_cols: string) => {
          if (!payload) return q;
          const ok = filters.every(([kind, col, value]) =>
            kind === 'is' ? h.store.first_look == null
              : col === 'first_look->>measured_at' ? h.store.first_look?.measured_at === value
                : true);
          if (ok) Object.assign(h.store, payload);
          return Promise.resolve({ data: ok ? [{ id: 'x' }] : [], error: null });
        },
        eq: (col: string, value: unknown) => { filters.push(['eq', col, value]); return q; },
        is: (col: string, value: unknown) => { filters.push(['is', col, value]); return q; },
        maybeSingle: async () => ({ data: { first_look: h.store.first_look }, error: null }),
        update: (p: Record<string, any>) => { payload = p; return q; },
      };
      return q;
    },
  }),
}));

import { runAndRecordFirstLook, shouldReplaceFirstLook, type FirstLookRecord } from './firstLookRunner';

const f = (value: string | null, source: any) => ({ value, source });
const look = (setSource: 'printed' | 'recognized'): FirstLook => ({
  photos: { item_type: 'trading_card', item_type_evidence: 'standard card', same_item_both_photos: 'yes', front_shows: 'card_front', back_shows: 'card_back', card_orientation: 'portrait', in_holder: 'none', text_legibility: 'all_readable' },
  printed_text: { front_title_or_name: 'Espeon-GX', front_other: 'Sun & Moon', back_header: null, card_number_as_printed: '140/149', copyright_line: null, serial_stamp: null, back_parallel_or_product_text: null },
  layout: { border: 'yellow', logo_placement: 'none', name_panel: 'top', back_layout: 'pokeball', numbering_style: 'fraction' },
  identity: { category: 'tcg', subject: f('Espeon-GX', 'printed'), card_title: f(null, 'unknown'), year: f('2017', 'inferred'), manufacturer: f('The Pokemon Company', 'recognized'),
    set_name: f('Sun & Moon', setSource), insert_or_subset: f(null, 'unknown'), card_number: f('140', 'printed'), language: 'english', licensed_product: 'licensed' },
  parallel: { finish_observed: 'holo', dominant_color_vs_base: null, pattern_observed: null, autograph: 'none', relic_or_patch: false, serial_denominator: null, is_base: true, parallel_name: 'Base', decided_by: 'recognized_design' },
  design_features: [], alternatives: [],
} as any);

const cardId = 'a9eca6ef-0000-4000-8000-000000000001';
const images = { front: Buffer.from('front'), back: Buffer.from('back') };

beforeEach(() => {
  vi.clearAllMocks();
  h.store.first_look = null;
  vi.stubEnv('OPENAI_API_KEY', 'test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  h.pass1.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(look('recognized')) } }], usage: {} });
});
afterEach(() => vi.unstubAllEnvs());

describe('runAndRecordFirstLook', () => {
  it('saves pass 1 and settles `contract` before the search pass finishes, then saves the search record', async () => {
    let finishSearch!: () => void;
    h.pass2.mockImplementation(() => new Promise(resolve => {
      finishSearch = () => resolve({ output: [{ type: 'web_search_call' }], output_text: JSON.stringify(look('recognized')), usage: {} });
    }));
    const run = runAndRecordFirstLook(cardId, images, { allowSearch: true });

    const contract = await run.contract;
    expect(contract?.pass).toBe('contract');
    expect(h.store.first_look?.pass).toBe('contract');
    expect(h.store.first_look?.result.printed_text.card_number_as_printed).toBe('140/149');
    expect(h.reconcile).toHaveBeenCalledTimes(1);
    expect(h.after).toHaveBeenCalledTimes(1); // kept alive past the response

    finishSearch();
    const final = await run.final;
    expect(final?.pass).toBe('contract_with_search');
    expect(h.store.first_look?.pass).toBe('contract_with_search');
  });

  it('with no search pass, settles once with the single record', async () => {
    h.pass1.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(look('printed')) } }], usage: {} });
    const run = runAndRecordFirstLook(cardId, images, { allowSearch: true });
    expect((await run.contract)?.pass).toBe('contract');
    expect(h.pass2).not.toHaveBeenCalled();
    expect(h.store.first_look?.pass).toBe('contract');
  });

  it("never replaces another run's search record with a contract record", async () => {
    h.store.first_look = { pass: 'contract_with_search', measured_at: 'earlier', result: look('recognized') };
    h.pass1.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(look('printed')) } }], usage: {} });
    const run = runAndRecordFirstLook(cardId, images);
    await run.final;
    expect(h.store.first_look.measured_at).toBe('earlier');
    expect(h.reconcile).not.toHaveBeenCalled();
  });
});

describe('shouldReplaceFirstLook', () => {
  const rec = (pass: FirstLookRecord['pass'], measured_at: string) => ({ pass, measured_at, result: look('printed') } as FirstLookRecord);
  it('writes into an empty slot', () => expect(shouldReplaceFirstLook(null, rec('contract', 'a'))).toBe(true));
  it('lets a richer pass replace a poorer one', () => expect(shouldReplaceFirstLook(rec('contract', 'a'), rec('contract_with_search', 'b'))).toBe(true));
  it('keeps an equal pass from another run (the dialog and the grade racing)', () => expect(shouldReplaceFirstLook(rec('contract', 'a'), rec('contract', 'b'))).toBe(false));
  it('keeps a richer stored pass', () => expect(shouldReplaceFirstLook(rec('contract_with_search', 'a'), rec('contract', 'b'))).toBe(false));
  it("lets a run's final record replace its own pass 1, but not the reverse", () => {
    expect(shouldReplaceFirstLook(rec('contract', 'a'), rec('contract_with_search', 'a'))).toBe(true);
    expect(shouldReplaceFirstLook(rec('contract_with_search', 'a'), rec('contract', 'a'))).toBe(false);
  });
});
