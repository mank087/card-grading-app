import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

let db: PGlite;
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const card = '00000000-0000-4000-8000-000000000003';
const org = '00000000-0000-4000-8000-000000000004';
const migration = readFileSync('supabase/migrations/20260916_atomic_grading_refunds.sql', 'utf8');
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE user_credits(user_id uuid PRIMARY KEY, balance integer NOT NULL, total_used integer NOT NULL);
    CREATE TABLE organizations(id uuid PRIMARY KEY, monthly_credits integer DEFAULT 0, overage_credits integer DEFAULT 0,
      grade_credits integer GENERATED ALWAYS AS (monthly_credits + overage_credits) STORED);
    CREATE TABLE credit_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      card_id uuid, org_id uuid, type text, amount integer, balance_after integer, description text,
      metadata jsonb, created_at timestamptz DEFAULT now());`);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`RESET ROLE; DROP TRIGGER IF EXISTS fail_refund ON credit_transactions;
    TRUNCATE credit_transactions, user_credits, organizations CASCADE;`);
  await db.query('INSERT INTO user_credits VALUES ($1, 4, 2)', [owner]);
  await db.query('INSERT INTO organizations(id,monthly_credits,overage_credits) VALUES ($1,5,7)', [org]);
});
async function charge(type = 'grade', orgId: string | null = null, userId = owner) {
  return (await db.query<{ id: string }>(`INSERT INTO credit_transactions(user_id,card_id,org_id,type,amount)
    VALUES ($1,$2,$3,$4,-1) RETURNING id`, [userId, card, orgId, type])).rows[0].id;
}
async function refund(id: string, userId = owner, cardId = card) {
  return (await db.query<{ result: any }>('SELECT refund_grading_charge($1,$2,$3,$4) AS result', [userId, cardId, id, 'test failure'])).rows[0].result;
}
async function balance() { return (await db.query<any>('SELECT * FROM user_credits WHERE user_id=$1', [owner])).rows[0]; }

describe('atomic grading refund migration on local PostgreSQL (PGlite)', () => {
  it('restores the personal balance and links the ledger entry to its exact charge', async () => {
    const id = await charge();
    expect((await refund(id)).status).toBe('refunded');
    expect(await balance()).toMatchObject({ balance: 5, total_used: 1 });
    expect((await db.query<any>("SELECT refund_of_transaction_id,amount FROM credit_transactions WHERE type='refund'")).rows)
      .toEqual([{ refund_of_transaction_id: id, amount: 1 }]);
  });
  it('refunds a later paid regrade independently of an earlier refund', async () => {
    const first = await charge();
    await refund(first);
    const regrade = await charge('regrade');
    expect((await refund(regrade)).status).toBe('refunded');
    expect(await balance()).toMatchObject({ balance: 6, total_used: 0 });
    expect((await refund(first)).status).toBe('already_refunded');
    expect((await refund(regrade)).status).toBe('already_refunded');
    expect((await balance()).balance).toBe(6);
  });
  it('a delayed duplicate for an old charge cannot refund the newer charge', async () => {
    const old = await charge(); await refund(old);
    const newer = await charge('regrade');
    expect((await refund(old)).status).toBe('already_refunded');
    expect((await balance()).balance).toBe(5);
    expect((await refund(newer)).status).toBe('refunded');
  });
  it('handles duplicate submitted requests once (PGlite serializes execution)', async () => {
    const id = await charge();
    const results = await Promise.all([refund(id), refund(id), refund(id)]);
    expect(results.map(r => r.status)).toEqual(['refunded', 'already_refunded', 'already_refunded']);
    expect((await balance()).balance).toBe(5);
  });
  it('keeps different charge refunds additive on the same balance', async () => {
    const ids = [await charge(), await charge('regrade')];
    await Promise.all(ids.map(id => refund(id)));
    expect((await balance()).balance).toBe(6);
  });
  it('restores the organization overage pool without altering the personal balance', async () => {
    const id = await charge('grade', org);
    expect(await refund(id)).toMatchObject({ status: 'refunded', org_balance: 13 });
    expect((await balance()).balance).toBe(4);
    expect((await db.query<any>('SELECT monthly_credits,overage_credits FROM organizations')).rows[0])
      .toEqual({ monthly_credits: 5, overage_credits: 8 });
  });
  it.each([false, true])('rolls back balance restoration if the refund insert fails (org=%s)', async organization => {
    const id = await charge('grade', organization ? org : null);
    await db.exec(`CREATE OR REPLACE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected insert failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER fail_refund BEFORE INSERT ON credit_transactions FOR EACH ROW EXECUTE FUNCTION reject_refund();`);
    await expect(refund(id)).rejects.toThrow('injected insert failure');
    expect((await balance()).balance).toBe(4);
    expect((await db.query<any>('SELECT grade_credits FROM organizations')).rows[0].grade_credits).toBe(12);
    expect((await db.query<any>("SELECT id FROM credit_transactions WHERE type='refund'")).rows).toHaveLength(0);
    await db.exec('DROP TRIGGER fail_refund ON credit_transactions');
    expect((await refund(id)).status).toBe('refunded');
  });
  it('rejects another owner, another card and a non-grading charge', async () => {
    const id = await charge();
    expect((await refund(id, other)).status).toBe('invalid_charge');
    expect((await refund(id, owner, other)).status).toBe('invalid_charge');
    expect((await refund(await charge('purchase'))).status).toBe('invalid_charge');
    expect((await balance()).balance).toBe(4);
  });
  it('does not write a ledger entry if the payer balance is missing', async () => {
    const id = await charge();
    await db.exec('DELETE FROM user_credits');
    expect((await refund(id)).status).toBe('failed');
    expect((await db.query<any>("SELECT id FROM credit_transactions WHERE type='refund'")).rows).toHaveLength(0);
  });
  it('backfills unambiguous legacy refunds without changing balances', async () => {
    const id = await charge();
    await db.query("INSERT INTO credit_transactions(user_id,card_id,type,amount) VALUES ($1,$2,'refund',1)", [owner, card]);
    await db.exec(migration);
    expect((await refund(id)).status).toBe('already_refunded');
    expect((await balance()).balance).toBe(4);
    expect((await refund(await charge('regrade'))).status).toBe('refunded');
  });
  it('holds ambiguous legacy refunds for review rather than paying again', async () => {
    const id = await charge();
    await db.query("INSERT INTO credit_transactions(user_id,card_id,type,amount) VALUES ($1,$2,'refund',1),($1,$2,'refund',1)", [owner, card]);
    await db.exec(migration);
    expect((await refund(id)).status).toBe('needs_review');
    expect((await balance()).balance).toBe(4);
  });
  it('prevents authenticated clients from invoking the refund function directly', async () => {
    const id = await charge();
    await db.exec('SET ROLE authenticated');
    await expect(refund(id)).rejects.toThrow('permission denied');
  });
  it('permits the service role while retaining payer validation', async () => {
    const id = await charge();
    await db.exec('SET ROLE service_role');
    expect((await refund(id, other)).status).toBe('invalid_charge');
    expect((await refund(id)).status).toBe('refunded');
  });
});
