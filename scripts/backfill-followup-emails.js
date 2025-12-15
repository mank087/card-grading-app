/**
 * Backfill Follow-Up Emails
 * Schedules 24-hour follow-up emails for existing users who signed up in the last week
 *
 * Run with: node scripts/backfill-followup-emails.js
 *
 * This script will:
 * 1. Find all users who signed up in the last 7 days
 * 2. Check if they already have a follow_up_24h email scheduled
 * 3. Schedule the email to be sent immediately (scheduled_for = now)
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillEmails() {
  console.log('Starting backfill for follow-up emails...\n');

  // Get date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all auth users (source of truth for signup dates)
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('Error fetching auth users:', authError);
    process.exit(1);
  }

  // Filter to users who signed up in the last 7 days
  const recentAuthUsers = authData.users.filter(user =>
    new Date(user.created_at) >= sevenDaysAgo && user.email
  );

  console.log(`Found ${recentAuthUsers.length} users who signed up in the last 7 days\n`);

  if (recentAuthUsers.length === 0) {
    console.log('No users to backfill.');
    process.exit(0);
  }

  // Get profiles for these users to check marketing_emails_enabled
  const userIds = recentAuthUsers.map(u => u.id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, marketing_emails_enabled')
    .in('id', userIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    process.exit(1);
  }

  // Create a map of user_id -> marketing_emails_enabled
  const profileMap = new Map();
  profiles.forEach(p => {
    profileMap.set(p.id, p.marketing_emails_enabled);
  });

  // Combine auth user data with profile preferences
  const recentUsers = recentAuthUsers.map(user => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    marketing_emails_enabled: profileMap.get(user.id) !== false // Default to true if not set
  }));

  console.log(`Processing ${recentUsers.length} users...\n`);

  // Get existing scheduled emails to avoid duplicates
  const { data: existingEmails, error: emailsError } = await supabase
    .from('email_schedule')
    .select('user_id')
    .in('user_id', userIds)
    .eq('email_type', 'follow_up_24h');

  if (emailsError) {
    console.error('Error checking existing emails:', emailsError);
    process.exit(1);
  }

  const usersWithExistingEmail = new Set(existingEmails?.map(e => e.user_id) || []);

  // Filter users who don't have the email scheduled yet and are subscribed
  const usersToBackfill = recentUsers.filter(user => {
    if (usersWithExistingEmail.has(user.id)) {
      console.log(`Skipping ${user.email} - already has email scheduled`);
      return false;
    }
    if (user.marketing_emails_enabled === false) {
      console.log(`Skipping ${user.email} - unsubscribed from marketing`);
      return false;
    }
    return true;
  });

  console.log(`\n${usersToBackfill.length} users need backfill\n`);

  if (usersToBackfill.length === 0) {
    console.log('No users need backfill.');
    process.exit(0);
  }

  // Schedule emails for these users (send immediately since they're past the 24h window)
  const now = new Date().toISOString();
  const emailRecords = usersToBackfill.map(user => ({
    user_id: user.id,
    user_email: user.email,
    email_type: 'follow_up_24h',
    scheduled_for: now, // Send immediately on next cron run
    status: 'pending',
    created_at: now
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('email_schedule')
    .insert(emailRecords)
    .select();

  if (insertError) {
    console.error('Error inserting email records:', insertError);
    process.exit(1);
  }

  console.log(`Successfully scheduled ${inserted.length} follow-up emails!\n`);
  console.log('These emails will be sent on the next cron job run (hourly).\n');

  // List the users
  console.log('Users scheduled for follow-up email:');
  usersToBackfill.forEach(user => {
    console.log(`  - ${user.email} (signed up: ${new Date(user.created_at).toLocaleDateString()})`);
  });
}

backfillEmails().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
