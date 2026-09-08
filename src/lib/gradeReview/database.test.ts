import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;
const owner = '00000000-0000-4000-8000-000000000001';
const stranger = '00000000-0000-4000-8000-000000000002';
const concerns = JSON.stringify([{ category: 'centering', side: 'front' }]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE admin_users(id uuid PRIMARY KEY, is_active boolean, role text);
    INSERT INTO admin_users VALUES ('00000000-0000-4000-8000-000000000010', true, 'moderator'), ('00000000-0000-4000-8000-000000000011', true, 'support');
    CREATE TABLE admin_activity_log(id uuid DEFAULT gen_random_uuid(), admin_id uuid, action text, resource_type text, resource_id uuid, details jsonb);
    CREATE TABLE cards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, grade_status text,
      conversational_grading text, conversational_whole_grade numeric, front_path text, back_path text,
      category text, grading_model text, conversational_prompt_version text,
      ownership_status text DEFAULT 'owned', deleted_at timestamptz
    );
  `);
  for (const file of ['20260906_grade_review_intake.sql', '20260906_grade_review_processor.sql','20260906_grade_review_owner_decision.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE cards CASCADE; TRUNCATE admin_activity_log; SELECT set_config('request.jwt.claim.role','service_role',false);`);
});

async function card() {
  const { rows } = await db.query<{ id: string }>(`INSERT INTO cards(user_id, grade_status, conversational_grading, conversational_whole_grade, front_path, back_path, conversational_prompt_version)
    VALUES ($1, 'complete', '{}', 8, 'front.jpg', 'back.jpg', 'DCM_Grading_v9.23') RETURNING id`, [owner]);
  const run = await db.query<{ id: string }>('SELECT id FROM card_grade_runs WHERE card_id=$1 AND is_current', [rows[0].id]);
  return { id: rows[0].id, run: run.rows[0].id };
}
async function request(c: { id: string; run: string }, user = owner, selected = concerns) {
  const result = await db.query<{ id: string }>('SELECT request_card_grade_review($1,$2,$3,$4,$5) AS id', [c.id, user, c.run, selected, 'Check front']);
  return result.rows[0].id;
}
async function claim() {
  const result = await db.query<{ job: { id: string; lease_token: string } | null }>('SELECT claim_grade_review() AS job');
  return result.rows[0].job;
}
async function finish(job: { id: string; lease_token: string }, error: string | null = null) {
  const result = await db.query<{ ok: boolean }>('SELECT finish_grade_review($1,$2,$3,$4,$5,$6,$7) AS ok', [job.id, job.lease_token, { first: {} }, {}, error, 'grade_confirmed', 'The centering supports the original grade.']);
  return result.rows[0].ok;
}
async function correct(job: { id: string; lease_token: string }, options: { proposal?: unknown; patch?: unknown; expected?: unknown } = {}) {
  return db.query<{ ok: boolean }>('SELECT finish_grade_review($1,$2,$3,$4,$5,$6,$7,$8,$9) AS ok', [job.id,job.lease_token,
    options.proposal ?? { first: {}, confirmation: {}, verification: { agreed: true } }, {}, null, 'grade_corrected', 'Grade corrected from 8 to 9.',
    options.expected ?? { conversational_grading: '{}', conversational_whole_grade: 8 },
    options.patch ?? { conversational_grading: '{"reviewed":true}', conversational_whole_grade: 9 }]);
}

async function decide(job: { id: string }, decision = 'accept', user = owner) {
  return (await db.query<{ result: { accepted?: boolean; stale?: boolean; already_recorded?: boolean } }>(
    'SELECT decide_own_grade_review((SELECT card_id FROM card_grade_reviews WHERE id=$1),$1,$2,$3) AS result', [job.id,user,decision])).rows[0].result;
}

describe('review migrations executed in isolated PostgreSQL', () => {
  it('atomically corrects a grade and logs the original without creating a full grade run', async () => {
    await request(await card()); const job = (await claim())!;
    expect((await correct(job)).rows[0].ok).toBe(true);
    expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
    expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('awaiting_owner');
    expect(await decide(job)).toMatchObject({ accepted: true });
    expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('9');
    expect((await db.query('SELECT * FROM card_grade_runs')).rows).toHaveLength(1);
    const review = (await db.query<{ outcome: string; before_card: { conversational_whole_grade: number } }>('SELECT outcome,before_card FROM card_grade_reviews')).rows[0];
    expect(review.outcome).toBe('grade_corrected'); expect(review.before_card.conversational_whole_grade).toBe(8);
    expect((await correct(job)).rows[0].ok).toBe(false);
    expect((await db.query("SELECT * FROM card_grade_review_events WHERE event_type='owner_decision'")).rows).toHaveLength(1);
  });
  it('keeps the grade when declined and prevents reversing or repeating the review', async () => {
    const c = await card(); await request(c); const job = (await claim())!; await correct(job);
    expect(await decide(job,'keep_original')).toMatchObject({ accepted: false });
    expect(await decide(job,'keep_original')).toMatchObject({ already_recorded: true });
    expect(await decide(job,'accept')).toMatchObject({ stale: true });
    expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
    expect(await request(c)).toBe(job.id);
    expect((await db.query("SELECT * FROM card_grade_review_events WHERE event_type='owner_decision'")).rows).toHaveLength(1);
  });
  it('requires approval for a decrease too and applies an acceptance only once', async () => {
    await request(await card()); const job = (await claim())!;
    await correct(job,{ patch: { conversational_grading: '{"reviewed":true}', conversational_whole_grade: 7 } });
    expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
    await expect(decide(job,'accept',stranger)).rejects.toThrow('review_not_available');
    await decide(job);
    expect(await decide(job)).toMatchObject({ accepted: true, already_recorded: true });
    expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('7');
  });
  it('uses the numeric change to require approval even if a worker labels it report-only', async () => {
    await request(await card()); const job = (await claim())!;
    await db.query('SELECT finish_grade_review($1,$2,$3,$4,$5,$6,$7,$8,$9)', [job.id,job.lease_token,
      { first:{},confirmation:{},verification:{agreed:true} },{},null,'report_corrected','Centering update.',
      {conversational_grading:'{}',conversational_whole_grade:8},{conversational_grading:'{"reviewed":true}',conversational_whole_grade:9}]);
    expect((await db.query<{ status:string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('awaiting_owner');
    expect((await db.query<{ grade:string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
  });
  it('still applies a report correction automatically when the numeric grade is unchanged', async () => {
    await request(await card()); const job = (await claim())!;
    await db.query('SELECT finish_grade_review($1,$2,$3,$4,$5,$6,$7,$8,$9)', [job.id,job.lease_token,
      { first:{},confirmation:{},verification:{agreed:true} },{},null,'report_corrected','Centering corrected. Your grade remains 8.',
      {conversational_grading:'{}',conversational_whole_grade:8},{conversational_grading:'{"reviewed":true}',conversational_whole_grade:8}]);
    expect((await db.query<{ status:string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('completed');
    expect((await db.query<{ report:string }>('SELECT conversational_grading AS report FROM cards')).rows[0].report).toBe('{"reviewed":true}');
  });
  it('does not apply a pending suggestion after another full grade', async () => {
    const c = await card(); await request(c); const job = (await claim())!; await correct(job);
    await db.query("UPDATE cards SET grade_status='processing:new' WHERE id=$1",[c.id]);
    await db.query("UPDATE cards SET grade_status='complete' WHERE id=$1",[c.id]);
    expect(await decide(job)).toMatchObject({ stale: true });
    expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('superseded');
  });
  it('rolls back an accepted grade if its decision log fails', async () => {
    await request(await card()); const job = (await claim())!; await correct(job);
    await db.exec("CREATE FUNCTION fail_owner_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_failure'; END $$; CREATE TRIGGER fail_owner_event BEFORE INSERT ON card_grade_review_events FOR EACH ROW EXECUTE FUNCTION fail_owner_event();");
    try {
      await expect(decide(job)).rejects.toThrow('audit_failure');
      expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
      expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('awaiting_owner');
    } finally { await db.exec('DROP TRIGGER fail_owner_event ON card_grade_review_events; DROP FUNCTION fail_owner_event();'); }
  });
  it('rejects unverified and unauthorized corrections', async () => {
    await request(await card()); const job = (await claim())!;
    await expect(correct(job, { proposal: { first: {} } })).rejects.toThrow('unverified_correction');
    await expect(correct(job, { patch: { conversational_grading: '{}', conversational_whole_grade: 9, user_id: stranger } })).rejects.toThrow('invalid_correction_field');
  });
  it('rejects changed scoring fields', async () => {
    await request(await card()); const job = (await claim())!;
    expect((await correct(job, { expected: { conversational_grading: '{}', conversational_whole_grade: 7 } })).rows[0].ok).toBe(false);
  });
  it('rolls back a correction if its audit cannot be saved', async () => {
    await request(await card()); const job = (await claim())!;
    await db.exec("CREATE FUNCTION fail_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_failure'; END $$; CREATE TRIGGER fail_completion BEFORE INSERT ON card_grade_review_events FOR EACH ROW EXECUTE FUNCTION fail_completion();");
    try {
      await expect(correct(job)).rejects.toThrow('audit_failure');
      expect((await db.query<{ grade: string }>('SELECT conversational_whole_grade AS grade FROM cards')).rows[0].grade).toBe('8');
      expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('processing');
    } finally { await db.exec('DROP TRIGGER fail_completion ON card_grade_review_events; DROP FUNCTION fail_completion();'); }
  });
  it('allows only service-role invocation of the request function', async () => {
    const c = await card();
    await db.exec('SET ROLE service_role');
    expect(await request(c)).toBeTruthy();
    await db.exec('RESET ROLE');
  });
  it('rolls back intake if the event record cannot be saved', async () => {
    const c = await card();
    await db.exec(`CREATE FUNCTION fail_review_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test_event_failure'; END $$;
      CREATE TRIGGER fail_review_test_event BEFORE INSERT ON card_grade_review_events FOR EACH ROW EXECUTE FUNCTION fail_review_test_event();`);
    try {
      await expect(request(c)).rejects.toThrow('test_event_failure');
      expect((await db.query('SELECT * FROM card_grade_reviews')).rows).toHaveLength(0);
    } finally { await db.exec('DROP TRIGGER fail_review_test_event ON card_grade_review_events; DROP FUNCTION fail_review_test_event();'); }
  });
  it('captures a run and atomically records exactly one request event for duplicate submissions', async () => {
    const c = await card();
    const ids = await Promise.all([request(c), request(c)]);
    expect(ids[0]).toBe(ids[1]);
    expect((await db.query('SELECT * FROM card_grade_reviews')).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM card_grade_review_events WHERE event_type='requested'")).rows).toHaveLength(1);
  });
  it('enforces ownership in the database, including a new owner of an old grade', async () => {
    const c = await card();
    await expect(request(c, stranger)).rejects.toThrow('review_not_available');
    await db.query('UPDATE cards SET user_id=$1 WHERE id=$2', [stranger, c.id]);
    await expect(request(c, stranger)).rejects.toThrow('review_not_available');
  });
  it('rejects malformed concerns without creating a request', async () => {
    const c = await card();
    await expect(request(c, owner, '[]')).rejects.toThrow('invalid_review');
    await expect(request(c, owner, '[{"category":"price","side":"front"}]')).rejects.toThrow('invalid_review');
    expect((await db.query('SELECT * FROM card_grade_reviews')).rows).toHaveLength(0);
  });
  it('rejects sold/deleted cards and in-progress full grades', async () => {
    const c = await card();
    await db.query("UPDATE cards SET ownership_status='sold' WHERE id=$1", [c.id]);
    await expect(request(c)).rejects.toThrow('review_not_available');
    await db.query("UPDATE cards SET ownership_status='owned', grade_status='processing:test' WHERE id=$1", [c.id]);
    await expect(request(c)).rejects.toThrow('review_not_available');
    await db.query('UPDATE cards SET deleted_at=now() WHERE id=$1', [c.id]);
    await expect(request(c)).rejects.toThrow('review_not_available');
  });
  it('does not grant browser roles access to private evidence or service functions', async () => {
    await db.exec('SET ROLE authenticated');
    await expect(db.query('SELECT * FROM card_grade_runs')).rejects.toThrow('permission denied');
    await expect(db.query('SELECT claim_grade_review()')).rejects.toThrow('permission denied');
    await expect(db.query('SELECT request_card_grade_review($1,$2,$3,$4,$5)', [owner, owner, owner, concerns, ''])).rejects.toThrow('permission denied');
    await db.exec('RESET ROLE');
  });
  it('does not capture client-forged completion or create runs on cache writes', async () => {
    const c = await card();
    await db.query("UPDATE cards SET grade_status='complete' WHERE id=$1", [c.id]);
    expect((await db.query('SELECT * FROM card_grade_runs')).rows).toHaveLength(1);
    await db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false)");
    await db.query("UPDATE cards SET grade_status='processing:test' WHERE id=$1", [c.id]);
    await db.query("UPDATE cards SET grade_status='complete' WHERE id=$1", [c.id]);
    expect((await db.query('SELECT * FROM card_grade_runs')).rows).toHaveLength(1);
  });
  it('supersedes older requests on full re-grade and rejects stale browser runs', async () => {
    const c = await card(); await request(c);
    await db.query("UPDATE cards SET grade_status='processing:test' WHERE id=$1", [c.id]);
    await db.query("UPDATE cards SET grade_status='complete' WHERE id=$1", [c.id]);
    await expect(request(c)).rejects.toThrow('review_not_available');
    expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews')).rows[0].status).toBe('superseded');
    expect((await db.query('SELECT * FROM card_grade_runs WHERE is_current')).rows).toHaveLength(1);
  });
  it('completes a confirmed review without changing the grade or report', async () => {
    const c = await card(); await request(c); const job = (await claim())!;
    expect(await finish(job)).toBe(true);
    const review = (await db.query<{ status: string; customer_result: string | null }>('SELECT status, customer_result FROM card_grade_reviews')).rows[0];
    expect(review).toEqual({ status: 'completed', customer_result: 'The centering supports the original grade.' });
    expect((await db.query<{ conversational_whole_grade: string; conversational_grading: string }>('SELECT conversational_whole_grade, conversational_grading FROM cards')).rows[0]).toEqual({ conversational_whole_grade: '8', conversational_grading: '{}' });
    expect(await finish(job)).toBe(false);
  });
  it('rejects expired workers after their lease is replaced', async () => {
    await request(await card()); const old = (await claim())!;
    await db.exec("UPDATE card_grade_reviews SET lease_expires_at=now()-interval '1 second'");
    const replacement = (await claim())!;
    expect(replacement.lease_token).not.toBe(old.lease_token);
    expect(await finish(old)).toBe(false);
    expect(await finish(replacement)).toBe(true);
  });
  it('rejects completion if evidence changes during processing', async () => {
    const c = await card(); await request(c); const job = (await claim())!;
    await db.query("UPDATE cards SET front_path='replacement.jpg' WHERE id=$1", [c.id]);
    expect(await finish(job)).toBe(false);
  });
  it('caps concurrent leases and retries', async () => {
    for (let i = 0; i < 3; i++) await request(await card());
    const first = (await claim())!; expect(first).not.toBeNull();
    expect(await claim()).not.toBeNull(); expect(await claim()).toBeNull();
    await finish(first, 'transient_error');
    expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews WHERE id=$1', [first.id])).rows[0].status).toBe('queued');
    await db.query("UPDATE card_grade_reviews SET attempt_count=3, next_attempt_at=now()-interval '1 second' WHERE id=$1", [first.id]);
    await claim();
    expect((await db.query<{ status: string }>('SELECT status FROM card_grade_reviews WHERE id=$1', [first.id])).rows[0].status).toBe('completed');
  });
  it('enforces the global hourly attempt ceiling', async () => {
    const id = await request(await card());
    await db.query("INSERT INTO card_grade_review_events(review_id,event_type) SELECT $1, 'attempt_started' FROM generate_series(1,20)", [id]);
    expect(await claim()).toBeNull();
  });
  it('preserves an immutable snapshot when current report text changes', async () => {
    const c = await card();
    await db.query("UPDATE cards SET conversational_grading='changed' WHERE id=$1", [c.id]);
    expect((await db.query<{ report: string }>("SELECT snapshot->>'report' AS report FROM card_grade_runs WHERE id=$1", [c.run])).rows[0].report).toBe('{}');
    // Intake may persist the concern, but dispatch must refuse stale evidence.
    await request(c); expect(await claim()).toBeNull();
  });
  it('does not reuse stale policy settings when capture is disabled for a later grade', async () => {
    const c = await card();
    await db.query("UPDATE cards SET grade_status='processing:test', grade_review_policy_context=$2 WHERE id=$1", [c.id, { version: 'old', captured_at: 'earlier' }]);
    await db.query("UPDATE cards SET grade_status='complete' WHERE id=$1", [c.id]);
    expect((await db.query<{ policy: unknown }>("SELECT snapshot->'policy_context' AS policy FROM card_grade_runs WHERE card_id=$1 AND is_current", [c.id])).rows[0].policy).toBeNull();
    await db.query("UPDATE cards SET grade_status='processing:next' WHERE id=$1", [c.id]);
    await db.query("UPDATE cards SET grade_status='complete', grade_review_policy_context=$2 WHERE id=$1", [c.id, { version: 'current', captured_at: 'now' }]);
    expect((await db.query<{ policy: { version: string } }>("SELECT snapshot->'policy_context' AS policy FROM card_grade_runs WHERE card_id=$1 AND is_current", [c.id])).rows[0].policy.version).toBe('current');
  });
});
