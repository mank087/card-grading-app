/**
 * Local-only helper: flush the grade-review email queue once.
 *
 * On Vercel the every-minute cron at /api/grade-reviews/drain does this. A
 * local dev server has no cron and no CRON_SECRET, so run this by hand after
 * a review request or an admin verdict when testing locally:
 *
 *   npx tsx scripts/drain-grade-reviews.mts
 *
 * Reads .env.local (needs RESEND_API_KEY + Supabase service role) and forces
 * GRADE_REVIEW_EMAILS_ENABLED on for this process only.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
process.env.GRADE_REVIEW_EMAILS_ENABLED = 'true';
const { deliverReviewNotifications } = await import('../src/lib/gradeReview/notifications');
console.log(await deliverReviewNotifications());
