import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PRICING_INVALIDATION_COLUMNS } from './saveCardIdentity';

let db: PGlite;
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const card = '00000000-0000-4000-8000-000000000003';
const admin = '00000000-0000-4000-8000-000000000004';
const migration = readFileSync('supabase/migrations/20260917_identity_confirmation.sql', 'utf8');

// A cards table with exactly the columns the function touches, plus the grade
// and history columns it must never touch.
const CARDS_DDL = `CREATE TABLE public.cards(
  id uuid PRIMARY KEY, user_id uuid, category text, ownership_status text,
  card_name text, featured text, pokemon_featured text, card_set text, card_number text,
  release_date text, manufacturer_name text, serial_numbering text, autographed boolean,
  autograph_type text, rookie_card boolean, first_print_rookie boolean, memorabilia_type text,
  holofoil text, is_foil boolean, foil_type text, mtg_rarity text, is_double_faced boolean,
  mtg_set_code text, rarity_tier text, rarity_description text, pokemon_type text,
  pokemon_stage text, hp text,
  conversational_card_info jsonb, original_card_info jsonb,
  dcm_selected_product_id text, dcm_selected_product_name text, dcm_selected_at timestamptz,
  dcm_price_estimate numeric, dcm_price_raw numeric, dcm_price_graded_high numeric,
  dcm_price_median numeric, dcm_price_average numeric, dcm_price_updated_at timestamptz,
  dcm_price_match_confidence text, dcm_price_product_id text, dcm_price_product_name text,
  dcm_cached_prices jsonb, dcm_prices_cached_at timestamptz,
  ebay_price_lowest numeric, ebay_price_median numeric, ebay_price_average numeric,
  ebay_price_highest numeric, ebay_price_listing_count integer, ebay_price_updated_at timestamptz,
  scryfall_price_usd numeric, scryfall_price_usd_foil numeric,
  -- history and grade columns: must survive every save
  dcm_price_at_grading numeric, dcm_price_at_grading_date timestamptz,
  conversational_decimal_grade numeric, front_path text, graded_at timestamptz
)`;

const PRICED = {
  dcm_selected_product_id: 'p-old', dcm_selected_product_name: 'Old product',
  dcm_price_estimate: 120, dcm_price_raw: 40, dcm_price_median: 100,
  dcm_price_product_id: 'p-old', dcm_price_product_name: 'Old product',
  dcm_cached_prices: { estimatedValue: 120 }, ebay_price_median: 110, scryfall_price_usd: 9.5,
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; ${CARDS_DDL};`);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE public.cards CASCADE; TRUNCATE public.card_identity_history;');
  await db.query(
    `INSERT INTO public.cards(id, user_id, category, ownership_status, card_name, featured, card_set,
      card_number, release_date, conversational_card_info,
      dcm_selected_product_id, dcm_selected_product_name, dcm_price_estimate, dcm_price_raw,
      dcm_price_median, dcm_price_product_id, dcm_price_product_name, dcm_cached_prices,
      ebay_price_median, scryfall_price_usd,
      dcm_price_at_grading, conversational_decimal_grade, front_path)
     VALUES ($1,$2,'Baseball','owned','Mickey Mantle','Mickey Mantle','Topps','091/086','1960',
      $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [card, owner, JSON.stringify({ card_name: 'Mickey Mantle', set_name: 'Topps', card_number: '091/086', card_number_raw: '091/086', year: '1960' }),
      PRICED.dcm_selected_product_id, PRICED.dcm_selected_product_name, PRICED.dcm_price_estimate,
      PRICED.dcm_price_raw, PRICED.dcm_price_median, PRICED.dcm_price_product_id,
      PRICED.dcm_price_product_name, JSON.stringify(PRICED.dcm_cached_prices), PRICED.ebay_price_median,
      PRICED.scryfall_price_usd, 55, 9, 'cards/front.jpg']);
});

interface SaveArgs {
  actorId?: string | null;
  actorRole?: string;
  expectedRevision?: number | null;
  columnPatch?: Record<string, unknown> | null;
  cardInfo?: Record<string, unknown> | null;
  material?: boolean;
  confirm?: boolean;
  dismiss?: boolean;
  invalidate?: string[];
  changedFields?: string[];
  cardId?: string;
}

async function save(args: SaveArgs = {}) {
  const r = await db.query<{ result: any }>(
    'SELECT public.save_card_identity($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) AS result',
    [
      args.cardId ?? card,
      args.actorId === undefined ? owner : args.actorId,
      args.actorRole ?? 'owner',
      args.expectedRevision ?? null,
      args.columnPatch ? JSON.stringify(args.columnPatch) : null,
      args.cardInfo ? JSON.stringify(args.cardInfo) : null,
      args.material ?? false,
      args.confirm ?? false,
      args.dismiss ?? false,
      args.invalidate ?? (args.material ? [...PRICING_INVALIDATION_COLUMNS] : []),
      args.changedFields ?? [],
      null,
      null,
    ]);
  return r.rows[0].result;
}

async function row(): Promise<Record<string, any>> {
  return (await db.query<any>('SELECT * FROM public.cards WHERE id=$1', [card])).rows[0];
}
async function history(): Promise<Record<string, any>[]> {
  return (await db.query<any>('SELECT * FROM public.card_identity_history ORDER BY created_at')).rows;
}

describe('save_card_identity on local PostgreSQL (PGlite)', () => {
  it('saves an identity edit and snapshots the original AI card info once', async () => {
    const result = await save({
      columnPatch: { card_set: 'Bowman' },
      cardInfo: { card_name: 'Mickey Mantle', set_name: 'Bowman', card_number: '091/086', card_number_raw: '091/086' },
      material: true, changedFields: ['card_set'],
    });
    expect(result).toMatchObject({ status: 'saved', identity_revision: 1, confirmed: false, pricing_invalidated: true });
    const after = await row();
    expect(after.card_set).toBe('Bowman');
    expect(after.conversational_card_info.set_name).toBe('Bowman');
    expect(after.original_card_info.set_name).toBe('Topps');

    // A second edit must not overwrite the preserved original.
    await save({ columnPatch: { card_set: 'Fleer' }, cardInfo: { set_name: 'Fleer' }, material: true, changedFields: ['card_set'], expectedRevision: 1 });
    expect((await row()).original_card_info.set_name).toBe('Topps');
  });

  it('confirms without any edit and does not move the revision', async () => {
    const result = await save({ confirm: true });
    expect(result).toMatchObject({ status: 'saved', identity_revision: 0, confirmed: true, pricing_invalidated: false });
    const after = await row();
    expect(after.identity_revision).toBe(0);
    expect(after.identity_confirmed_revision).toBe(0);
    expect(after.identity_confirmed_at).not.toBeNull();
    expect(after.identity_confirmed_by).toBe(owner);
    expect(after.card_set).toBe('Topps');
    expect(after.dcm_price_estimate).toBe('120');
    expect((await history())[0]).toMatchObject({ action: 'confirm', identity_revision: 0 });
  });

  it('clears a previous confirmation when identity changes afterwards', async () => {
    await save({ confirm: true });
    await save({ columnPatch: { card_name: 'Roger Maris' }, material: true, changedFields: ['card_name'], expectedRevision: 0 });
    const after = await row();
    expect(after.identity_revision).toBe(1);
    expect(after.identity_confirmed_revision).toBeNull();
    expect(after.identity_confirmed_at).toBeNull();
    expect(after.identity_confirmed_by).toBeNull();
  });

  it('saves and confirms in one call, binding the confirmation to the new revision', async () => {
    const result = await save({
      columnPatch: { card_name: 'Roger Maris' }, material: true, confirm: true, changedFields: ['card_name'],
    });
    expect(result).toMatchObject({ status: 'saved', identity_revision: 1, confirmed: true });
    const after = await row();
    expect(after.identity_revision).toBe(1);
    expect(after.identity_confirmed_revision).toBe(1);
    expect((await history())[0]).toMatchObject({ action: 'edit_and_confirm', identity_revision: 1 });
  });

  it('records a dismissal without ever counting it as approval', async () => {
    const result = await save({ dismiss: true });
    expect(result).toMatchObject({ status: 'saved', confirmed: false });
    const after = await row();
    expect(after.identity_review_dismissed_at).not.toBeNull();
    expect(after.identity_confirmed_revision).toBeNull();
    expect((await history())[0].action).toBe('dismiss');
  });

  it('clears the dismissal when the owner later confirms', async () => {
    await save({ dismiss: true });
    await save({ confirm: true });
    expect((await row()).identity_review_dismissed_at).toBeNull();
  });

  it('rejects a stale revision and writes nothing', async () => {
    await save({ columnPatch: { card_set: 'Bowman' }, material: true, changedFields: ['card_set'] });
    const result = await save({ columnPatch: { card_set: 'Fleer' }, material: true, changedFields: ['card_set'], expectedRevision: 0 });
    expect(result).toEqual({ status: 'stale', current_revision: 1 });
    expect((await row()).card_set).toBe('Bowman');
    expect(await history()).toHaveLength(1);
  });

  it('refuses a sold card and writes nothing', async () => {
    await db.query("UPDATE public.cards SET ownership_status='sold' WHERE id=$1", [card]);
    expect(await save({ columnPatch: { card_set: 'Bowman' }, material: true })).toEqual({ status: 'locked' });
    expect((await row()).card_set).toBe('Topps');
    expect(await history()).toHaveLength(0);
  });

  it('refuses another owner but lets an admin correct the card', async () => {
    expect(await save({ actorId: other })).toEqual({ status: 'forbidden' });
    expect((await row()).card_set).toBe('Topps');

    const result = await save({ actorId: admin, actorRole: 'admin', columnPatch: { card_set: 'Bowman' }, material: true, changedFields: ['card_set'] });
    expect(result).toMatchObject({ status: 'saved', identity_revision: 1 });
    expect((await history())[0]).toMatchObject({ actor_role: 'admin', actor_id: admin });
  });

  it('returns not_found for an unknown card', async () => {
    expect(await save({ cardId: other, columnPatch: { card_set: 'Bowman' } })).toEqual({ status: 'not_found' });
  });

  it('rejects an unrecognised actor role', async () => {
    expect(await save({ actorRole: 'robot' })).toEqual({ status: 'forbidden' });
  });

  it('nulls every invalidation column on a material change and keeps the price history', async () => {
    await save({ columnPatch: { card_name: 'Roger Maris' }, material: true, changedFields: ['card_name'] });
    const after = await row();
    for (const column of PRICING_INVALIDATION_COLUMNS) {
      expect({ column, value: after[column] }).toEqual({ column, value: null });
    }
    expect(after.dcm_price_at_grading).toBe('55');
    expect(after.conversational_decimal_grade).toBe('9');
  });

  it('leaves pricing untouched for a non-material change', async () => {
    const result = await save({ columnPatch: { rarity_description: 'Holo Rare' }, material: false, changedFields: ['rarity_description'] });
    expect(result).toMatchObject({ pricing_invalidated: false });
    const after = await row();
    expect(after.rarity_description).toBe('Holo Rare');
    expect(after.dcm_price_estimate).toBe('120');
    expect(after.dcm_selected_product_id).toBe('p-old');
    expect(after.identity_revision).toBe(0);
  });

  it('ignores a column outside the allowlist in the patch', async () => {
    const result = await save({
      columnPatch: {
        card_set: 'Bowman',
        conversational_decimal_grade: 1,
        front_path: 'attacker/evil.jpg',
        graded_at: '1999-01-01T00:00:00Z',
        dcm_price_at_grading: 0,
      },
      material: true, changedFields: ['card_set'],
    });
    expect(result.status).toBe('saved');
    const after = await row();
    expect(after.card_set).toBe('Bowman');
    expect(after.conversational_decimal_grade).toBe('9');
    expect(after.front_path).toBe('cards/front.jpg');
    expect(after.graded_at).toBeNull();
    expect(after.dcm_price_at_grading).toBe('55');
  });

  it('ignores a column outside the allowlist in the invalidation list', async () => {
    const result = await save({
      columnPatch: { card_set: 'Bowman' }, material: true, changedFields: ['card_set'],
      invalidate: ['conversational_decimal_grade', 'front_path', 'dcm_price_at_grading', 'card_name'],
    });
    expect(result).toMatchObject({ status: 'saved', pricing_invalidated: false });
    const after = await row();
    expect(after.conversational_decimal_grade).toBe('9');
    expect(after.front_path).toBe('cards/front.jpg');
    expect(after.dcm_price_at_grading).toBe('55');
    expect(after.card_name).toBe('Mickey Mantle');
  });

  it('writes one history row per save with the changed fields', async () => {
    await save({ columnPatch: { card_set: 'Bowman' }, material: true, changedFields: ['card_set', 'card_number'] });
    await save({ confirm: true, expectedRevision: 1 });
    const rows = await history();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ action: 'edit', identity_revision: 1, changed_fields: ['card_set', 'card_number'], card_id: card });
    expect(rows[1]).toMatchObject({ action: 'confirm', identity_revision: 1 });
  });

  it('keeps alphanumeric card numbers verbatim through the jsonb round trip', async () => {
    await save({
      columnPatch: { card_number: 'OP11-001' },
      cardInfo: { card_number: 'OP11-001', card_number_raw: 'OP11-001' },
      material: true, changedFields: ['card_number'],
    });
    const after = await row();
    expect(after.card_number).toBe('OP11-001');
    expect(after.conversational_card_info).toEqual({ card_number: 'OP11-001', card_number_raw: 'OP11-001' });
  });

  it('is not executable by anon or authenticated clients', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(save({ confirm: true })).rejects.toThrow('permission denied');
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    expect((await save({ confirm: true })).status).toBe('saved');
    await db.exec('RESET ROLE');
  });

  it('keeps the history table server-only', async () => {
    const rls = await db.query<any>("SELECT relrowsecurity FROM pg_class WHERE relname='card_identity_history'");
    expect(rls.rows[0].relrowsecurity).toBe(true);
    const policies = await db.query<any>("SELECT count(*)::int AS n FROM pg_policies WHERE tablename='card_identity_history'");
    expect(policies.rows[0].n).toBe(0);
  });
});
