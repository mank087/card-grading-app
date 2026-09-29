import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';

// 20260929 trigger: a card that leaves its owner (deleted, sold, archived,
// transferred) closes its open grade reviews, like the admin 'close' action.
let db: PGlite;
const owner = '00000000-0000-4000-8000-000000000001';
const buyer = '00000000-0000-4000-8000-000000000002';

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
    CREATE TABLE admin_users(id uuid PRIMARY KEY,is_active boolean,role text);
    CREATE TABLE user_credits(user_id uuid PRIMARY KEY,is_vip boolean,is_card_lover boolean,card_lover_current_period_end timestamptz);
    CREATE TABLE cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,grade_status text,conversational_grading text,conversational_whole_grade numeric,
      front_path text,back_path text,category text,card_name text,serial text,grading_model text,conversational_prompt_version text,ownership_status text DEFAULT 'owned',deleted_at timestamptz,visibility text);`);
  for (const file of ['20260906_grade_review_intake.sql', '20260906_grade_review_processor.sql', '20260906_grade_review_owner_decision.sql', '20260907_manual_grade_reviews.sql', '20260929_grade_review_autoclose_on_card_change.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec(`TRUNCATE cards CASCADE;TRUNCATE user_credits;INSERT INTO user_credits VALUES('${owner}',true,false,NULL);`); });

async function reviewedCard() {
  const card = (await db.query<{ id: string }>(`INSERT INTO cards(user_id,grade_status,conversational_grading,conversational_whole_grade,front_path,back_path,category,card_name)
    VALUES($1,'complete','{}',8,'f','b','sports','Test') RETURNING id`, [owner])).rows[0].id;
  const run = (await db.query<{ id: string }>('SELECT id FROM card_grade_runs WHERE card_id=$1', [card])).rows[0].id;
  const review = (await db.query<{ id: string }>('SELECT request_card_grade_review($1,$2,$3,$4,$5) AS id',
    [card, owner, run, [{ category: 'corners', side: 'both' }], 'Top-left corner looks sharp to me'])).rows[0].id;
  await db.query(`UPDATE card_grade_reviews SET status='processing',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes' WHERE id=$1`, [review]);
  return { card, review };
}
const reviewRow = async (id: string) => (await db.query<{ status: string; lease_token: string | null; lease_expires_at: string | null }>(
  'SELECT status,lease_token,lease_expires_at FROM card_grade_reviews WHERE id=$1', [id])).rows[0];
const closeEvents = async (id: string) => (await db.query<{ metadata: { reason: string } }>(
  "SELECT metadata FROM card_grade_review_events WHERE review_id=$1 AND event_type='auto_closed_card_changed'", [id])).rows;
const customerMail = async () => (await db.query("SELECT 1 FROM grade_review_notifications WHERE kind='customer_reviewed'")).rows.length;

it('closes an open review when the owner soft-deletes the card, without customer mail', async () => {
  const { card, review } = await reviewedCard();
  await db.query("UPDATE cards SET deleted_at=now(),visibility='private' WHERE id=$1", [card]);
  expect(await reviewRow(review)).toMatchObject({ status: 'superseded', lease_token: null, lease_expires_at: null });
  expect((await closeEvents(review)).map(e => e.metadata.reason)).toEqual(['card_deleted']);
  expect(await customerMail()).toBe(0);
});

it('does not reopen on restore and logs nothing extra', async () => {
  const { card, review } = await reviewedCard();
  await db.query('UPDATE cards SET deleted_at=now() WHERE id=$1', [card]);
  await db.query('UPDATE cards SET deleted_at=NULL WHERE id=$1', [card]);
  expect((await reviewRow(review)).status).toBe('superseded');
  expect(await closeEvents(review)).toHaveLength(1);
});

it.each([
  ['sold', "ownership_status='sold'", 'card_sold'],
  ['archived', "ownership_status='archived'", 'card_archived'],
  ['transferred', `user_id='${buyer}'`, 'card_owner_changed'],
])('closes an open review when the card is %s', async (_label, set, reason) => {
  const { card, review } = await reviewedCard();
  await db.query(`UPDATE cards SET ${set} WHERE id=$1`, [card]);
  expect((await reviewRow(review)).status).toBe('superseded');
  expect((await closeEvents(review))[0].metadata.reason).toBe(reason);
});

it('leaves reviews alone on unrelated card edits and leaves finished reviews alone', async () => {
  const { card, review } = await reviewedCard();
  await db.query("UPDATE cards SET card_name='Renamed', visibility='public' WHERE id=$1", [card]);
  expect((await reviewRow(review)).status).toBe('processing');
  await db.query(`UPDATE card_grade_reviews SET status='completed',lease_token=NULL WHERE id=$1`, [review]);
  await db.query('UPDATE cards SET deleted_at=now() WHERE id=$1', [card]);
  expect((await reviewRow(review)).status).toBe('completed');
  expect(await closeEvents(review)).toHaveLength(0);
});
