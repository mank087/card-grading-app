// Explicitly authorized account test. Default is read-only preflight.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const args = process.argv.slice(2);
const email = args[args.indexOf('--email') + 1];
if (!args.includes('--email') || !email?.includes('@')) throw new Error('--email is required');
const run = args.includes('--run');
function check(result, label) { if (result.error) throw new Error(`${label}: ${result.error.code || ''} ${result.error.message}`); return result.data; }
function loadCredits() {
  const compiled = ts.transpileModule(fs.readFileSync('src/lib/credits.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (id === '@supabase/supabase-js') return { createClient: () => client };
    if (id === './subscriptionConstants') return {};
    if (id === './organizations') return new Proxy({}, { get: () => () => { throw new Error('Organization operations are excluded from this personal-account test'); } });
    throw new Error(`Unexpected credit module dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  let user;
  for (let page = 1; page <= 100; page++) {
    const data = check(await client.auth.admin.listUsers({ page, perPage: 1000 }), 'Account lookup');
    user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase());
    if (user || data.users.length < 1000) break;
  }
  if (!user) throw new Error('Account not found');
  const readBalance = async () => check(await client.from('user_credits').select('balance,total_used,total_purchased')
    .eq('user_id', user.id).single(), 'Read credits');
  const before = await readBalance();
  const probe = check(await client.rpc('refund_grading_charge', {
    p_user_id: user.id, p_card_id: randomUUID(), p_charge_id: randomUUID(), p_reason: 'Read-only function preflight; nonexistent charge',
  }), 'Migration preflight');
  if (probe.status !== 'invalid_charge') throw new Error('Unexpected migration preflight result');
  console.log(JSON.stringify({ accountFound: true, before, migrationAvailable: true, mode: run ? 'authorized live test' : 'read-only preflight' }));
  if (!run) return;
  if (before.balance < 1) throw new Error('At least one existing credit is needed; no credits will be minted for this test');
  const cardId = randomUUID();
  const report = { test: 'account-grading-refund', cardId, startedAt: new Date().toISOString(), before, cycles: [], cleanup: 'pending' };
  fs.mkdirSync('artifacts', { recursive: true });
  const output = path.resolve('artifacts', `refund-test-${cardId}.json`);
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
  save();
  const { deductCredit, refundGradeCredit } = loadCredits();
  let cardCreated = false;
  try {
    check(await client.from('cards').insert({ id: cardId, user_id: user.id,
      serial: `RFTEST-${cardId}`, category: 'Other', visibility: 'private', grade_status: 'failed',
      card_name: 'Temporary credit refund verification',
      front_path: `refund-test/${cardId}/no-image`, back_path: `refund-test/${cardId}/no-image`,
    }), 'Create isolated test card');
    cardCreated = true;
    for (const isRegrade of [false, true]) {
      const cycle = { type: isRegrade ? 'regrade' : 'grade', before: await readBalance() };
      report.cycles.push(cycle); save();
      const deducted = await deductCredit(user.id, { cardId, isRegrade, payerScope: 'personal', description: `Authorized refund verification ${cardId}` });
      cycle.deduction = deducted; save();
      if (!deducted.success || deducted.alreadyCharged) throw new Error('Test deduction did not create the expected charge');
      const charge = check(await client.from('credit_transactions').select('id,amount').eq('card_id', cardId)
        .eq('user_id', user.id).eq('type', cycle.type).single(), 'Find exact test charge');
      cycle.chargeId = charge.id; cycle.afterDeduction = await readBalance(); save();
      // Issue duplicate requests concurrently against the real migrated function.
      cycle.refunds = await Promise.all(Array.from({ length: 3 }, () =>
        refundGradeCredit(user.id, cardId, `Authorized account verification ${cardId}`, charge.id)));
      cycle.afterRefund = await readBalance(); save();
      const statuses = cycle.refunds.map(item => item.status).sort();
      if (JSON.stringify(statuses) !== JSON.stringify(['already_refunded', 'already_refunded', 'refunded'])) throw new Error('Duplicate refund assertions failed');
      if (cycle.afterRefund.balance !== cycle.before.balance || cycle.afterRefund.total_used !== cycle.before.total_used) throw new Error('Account balance changed during the test; do not overwrite it');
    }
    const ledger = check(await client.from('credit_transactions').select('id,type,amount,refund_of_transaction_id')
      .eq('card_id', cardId).eq('user_id', user.id), 'Verify test ledger');
    report.ledger = ledger; save();
    if (ledger.length !== 4 || ledger.reduce((sum, row) => sum + row.amount, 0) !== 0) throw new Error('Test ledger did not balance');
    for (const cycle of report.cycles) {
      if (ledger.filter(row => row.type === 'refund' && row.refund_of_transaction_id === cycle.chargeId).length !== 1) throw new Error('Refund linkage invalid');
    }
    // Preserve the financial audit trail; mark only these new test transactions.
    check(await client.from('credit_transactions').update({ metadata: { authorized_refund_test: cardId } })
      .eq('user_id', user.id).eq('card_id', cardId), 'Tag test ledger');
    report.status = 'passed';
  } catch (error) {
    report.status = 'requires_attention'; report.error = error.message;
    // Preserve the test card and journal if anything is uncertain. Never reset
    // an account balance from a snapshot or delete a potentially unrefunded charge.
    throw error;
  } finally {
    if (cardCreated && report.status === 'passed') {
      const result = await client.from('cards').delete().eq('id', cardId).eq('user_id', user.id);
      report.cleanup = result.error ? `test card retained: ${result.error.message}` : 'temporary card deleted; balanced ledger retained';
    }
    report.after = await readBalance(); report.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: report.status, before: report.before, after: report.after, cycles: report.cycles.map(c => ({ type: c.type, statuses: c.refunds?.map(r => r.status) })), cleanup: report.cleanup, report: output }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
