/**
 * One-off: import the list of users who unsubscribed via our prior
 * EmailOctopus campaigns into our internal suppression (profiles
 * .marketing_emails_enabled = false).
 *
 * For each email in the list:
 *   - If the email maps to a registered DCM user -> flip
 *     marketing_emails_enabled to false and stamp marketing_unsubscribed_at
 *     to now (idempotent — already-suppressed users are skipped).
 *   - If the email is NOT a registered DCM user -> log it. These users
 *     aren't in our send audience anyway, but if they ever sign up later
 *     they'd default to opted-in. Flagged at the bottom for visibility;
 *     a future suppression-list table would catch them globally.
 *
 * Run:  node scripts/suppress-emailoctopus-unsubs.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EMAIL_OCTOPUS_UNSUBS = [
  'toapers@gmail.com',
  'madleighb113@gmail.com',
  'gelousyvisualmedia@gmail.com',
  'creatingerin@gmail.com',
  'branch82owcp@gmail.com',
  'jackcamp064@gmail.com',
  'bekamins@gmail.com',
  'methsifu@gmail.com',
  'ryanrobles14@gmail.com',
  'fb-reviewer@dcmgrading.com',
  'strawhat7142@gmail.com',
  'xxmaplemagexx@gmail.com',
  'clodsire.dev@gmail.com',
  'benmartin92@live.fr',
  'cdyrhgwkphhcjevfuf@nesopf.com',
  'probettingsystems@yahoo.com',
  'rdotson@wowway.com',
  'hanktremain@gmail.com',
  'waylonruff01@gmail.com',
  'iamcjlucas@gmail.com',
  'georgetony308@gmail.com',
  'cardlegendstc@gmail.com',
  'crispinbenny@yahoo.com',
  'tracktmaster@gmail.com',
  'coonorfstern@gmail.com',
  'benkamin1337zoellner@gmail.com',
  'kellyhuang906@gmail.com',
  'jackthao2009@yahoo.com',
  'p.jelic.96@gmail.com',
  'jquick127@gmail.com',
  'emma.e.hauptman@gmail.com',
  'seniorsynapticspeed@gmail.com',
  'b33fjarky@gmail.com',
  'jeffmontville62@gmail.com',
  'billy@jerseyripz.com',
  'bmorelli19@gmail.com',
  'jackkramerds2@gmail.com',
  'michellar@528collectibles.com',
  'dappz@dappzsports.com',
  'melody@tealteacup.com',
  'james@premiumcards.net',
  'guy@yourgamehaven.com',
  'brendan@choicesportscards.com',
  'vince@alterealitygames.com',
  'dwebb@nquest.com',
  't.sims@yourgamehaven.com',
  'taylor@dappzsports.com',
];

async function main() {
  console.log(`Suppressing ${EMAIL_OCTOPUS_UNSUBS.length} emails from EmailOctopus opt-out list...\n`);

  const now = new Date().toISOString();
  const suppressed = [];
  const alreadySuppressed = [];
  const notRegistered = [];

  for (const rawEmail of EMAIL_OCTOPUS_UNSUBS) {
    const email = rawEmail.trim().toLowerCase();
    // Find the user (case-insensitive match)
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();
    if (userErr) {
      console.warn(`  ! lookup error for ${email}: ${userErr.message}`);
      continue;
    }
    if (!user) {
      notRegistered.push(email);
      continue;
    }

    // Check current opt-in state
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, marketing_emails_enabled, marketing_unsubscribed_at')
      .eq('id', user.id)
      .maybeSingle();
    if (prof && prof.marketing_emails_enabled === false) {
      alreadySuppressed.push(email);
      continue;
    }

    // Suppress
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        marketing_emails_enabled: false,
        marketing_unsubscribed_at: now,
      })
      .eq('id', user.id);
    if (updErr) {
      console.warn(`  ! update error for ${email}: ${updErr.message}`);
      continue;
    }
    suppressed.push(email);
  }

  // Report
  console.log(`=== Newly suppressed (${suppressed.length}) ===`);
  suppressed.forEach(e => console.log(`  ${e}`));
  if (alreadySuppressed.length) {
    console.log(`\n=== Already suppressed previously (${alreadySuppressed.length}) ===`);
    alreadySuppressed.forEach(e => console.log(`  ${e}`));
  }
  if (notRegistered.length) {
    console.log(`\n=== Not registered DCM users (${notRegistered.length}) ===`);
    console.log(`  (These addresses subscribed to EmailOctopus only — not in our audience either way.`);
    console.log(`   If any of them sign up for DCM later, they'll default to opted-in.)`);
    notRegistered.forEach(e => console.log(`  ${e}`));
  }

  console.log(`\nSummary: ${suppressed.length} suppressed, ${alreadySuppressed.length} already done, ${notRegistered.length} not in DB.`);
}

main().catch(e => { console.error('Fatal:', e?.message || e); process.exit(1); });
