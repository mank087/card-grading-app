# Grading, card shows, databases and subscriber email review

Updated locally September 9, 2026. No commit, deployment, card submission, email send, billing change or recipient-list change.

## Pages to review

- http://127.0.0.1:3000/dev/experience-review — isolated grading-screen preview; does not submit a card. Production returns 404.
- http://127.0.0.1:3000/card-shows — show directory.
- http://127.0.0.1:3000/card-shows/collect-a-con-san-francisco-2026 — representative event detail; shared template covers all shows.
- http://127.0.0.1:3000/pokemon-database
- http://127.0.0.1:3000/sports-database
- http://127.0.0.1:3000/mtg-database
- http://127.0.0.1:3000/lorcana-database
- http://127.0.0.1:3000/onepiece-database
- http://127.0.0.1:3000/yugioh-database
- http://127.0.0.1:3000/starwars-database

## Changes

The post-submission component is shared by upload and all eight card-detail clients. It now displays the uploaded photo uncropped, a restrained purple scan, actual upload/completion/error status, and a longer-wait message. It no longer ticks analysis tasks complete every 15 seconds or presents timer-generated progress as measured results. It preserves completion routing and analytics. The four condition areas are educational, not fake live subgrades. Reduced motion disables the scan. Uploading suppresses navigation until photos are saved. The unused Pokemon-specific import now delegates to the shared component.

Seven databases share navy headers, light search/results surfaces, purple controls, 44px minimum control heights, visible keyboard focus, accessible filter names, and links between databases. Search, filters, pagination, card detail dialogs, and real Heritage latest-grade cards retain their existing data paths. Reference database images are ungraded catalog artwork; they intentionally do not receive invented Heritage grades. Pokemon year coverage no longer ends at 2025.

Event index and detail templates use the same palette and typography. Event names, dates, venues, directions, custom offers, and existing content remain. Removed duplicate brand suffix from event detail metadata titles.

Subscriber templates use matching navy/purple accents, larger small print and footer text, language attributes, and encoded personalized card text/URLs. Removed unverified rolling 48-hour expiry and current-week/trending claims from static email content. Discount codes, amounts, prices, credit grants, recipients and scheduling are unchanged.

## Resend subscriber email inventory

This inventory is based on application code and configured cron schedules, not a provider delivery-history export. These are lifecycle emails to eligible accounts, not six emails sent to every paid subscriber.

| Email | Trigger / timing | Current subject | Local preview |
|---|---|---|---|
| Welcome | Auth-user-created webhook; legacy web endpoint shares send helper | Welcome to DCM Grading! | http://127.0.0.1:3000/dev/experience-review?email=welcome |
| Signup reminder | Scheduled 24h after signup; DB trigger noted in code, plus legacy fallback | Your free credits are still waiting — plus 10% off inside | http://127.0.0.1:3000/dev/experience-review?email=reminder |
| First-grade education | +24h from first credit use; sends using first available graded card | Here's what your grade actually means | http://127.0.0.1:3000/dev/experience-review?email=education |
| Showcase / toolkit | +72h from first credit use | Explore graded cards and your DCM toolkit | http://127.0.0.1:3000/dev/experience-review?email=showcase |
| First-purchase offer | +7 days from first credit use; GRADE20 | Save 20% on your first credit pack | http://127.0.0.1:3000/dev/experience-review?email=offer |
| Winback | Daily audience scan, at least 14 days without grading; never purchased, prior graded card, no earlier winback; grants one credit before queueing | Your collection is waiting (free credit inside) | http://127.0.0.1:3000/dev/experience-review?email=winback |

Scheduled dispatcher runs hourly. Winback audience scan runs daily at 14:00 UTC. Pending batch limit is 50. Scheduled emails check marketing preferences and require an unsubscribe token; first-grade and winback messages also skip purchasers. Welcome uses successful-send logs for duplicate checks. Preview frames disable navigation and use illustrative personalized data; they never load the sending service.

Other Resend messages, separate from subscriber marketing: submission/batch completion; eBay bulk-listing completion; customer/manual-grade-review notifications and admin requests; Enterprise application acknowledgement, approval and activation; Enterprise lead/application/billing/settings admin notifications; contact-form forwarding. SES campaign scripts and Supabase authentication emails are separate systems and are not included in the six Resend marketing templates.

## Your review checklist

- [ ] Review the grading preview on desktop and phone. During your next normal test grade, verify completion opens the correct report, navigation works once uploaded, and pending/error states do not invite duplicate submission.
- [ ] In each database, try a name, card number, set filter, no-result search, Next/Previous, and a card detail dialog. Check Japanese Pokemon and alternate printings where supported.
- [ ] On event pages, check dates, venue, directions, event-specific coupon terms, embedded video and signed-in/signed-out CTA behavior. Some existing event copy still promises a minute/60 seconds; confirm whether to standardize this to variable timing.
- [ ] Review all six email previews, including mobile width, footer, offer wording, images and report links. Preview rendering is not an Outlook/Gmail inbox test.
- [ ] Confirm Grade10 and GRADE20 eligibility/expiry in the actual promotion configuration before activating these changes. No rolling 48-hour deadline is now asserted without recipient-specific expiry data.
- [ ] Confirm the welcome/reminder length: both remain long-form emails. Consider a shorter welcome focused on the first upload after reviewing this version.

## Delivery follow-ups identified (not changed by the creative pass)

1. Welcome can send promotional content without an unsubscribe token when the profile is not ready. It also does not check marketing preferences. Queue/retry until preferences and token are available; do not block account creation.
2. `isUserSubscribed` returns true on a profile query error/missing row, and `hasPurchased` returns false on purchase lookup errors. Defer sends when eligibility cannot be verified; do not interpret a database outage as eligible.
3. Scheduled sends have no provider idempotency key or atomic queue claim in this route. Overlapping hourly/manual runs can duplicate messages. Add a claim/retry strategy and tests before changing production dispatcher behavior. Welcome log checks alone also have a race.
4. First-grade series is scheduled at first credit deduction, not verified grading completion. Education skips without a graded card, but other series messages can still run. Anchor future scheduling to confirmed completion and prevent signup-reminder overlap/purchase-ineligible messaging.
5. Personalized image links expire after seven days. Older emails can lose images. Decide on a privacy-respecting persistent email image strategy; do not make private card photos public to solve this.
6. Social-proof cards use static assets and report IDs; verify the images, labels and report grades still agree before sending. They are now described as examples, not live trends.
7. Inspect authorization/rate limits on the legacy `/api/email/welcome` route before release: it accepts email/user ID from the request body without a visible auth guard in that route.
8. Verify actual Resend domain health, suppression state, bounces, complaint handling and delivery logs in the provider dashboard. This review did not inspect provider history or send test campaigns.

## Verification

TypeScript passed after the page/control changes. All seven database routes, the event index, a real event detail, and the email preview returned HTTP 200 locally. Browser screenshots checked the Pokemon database, grading preview, event index/detail and offer email. Three focused email tests cover HTML injection/URL safety and removal of unsupported timing claims. No production build or real submission/email was run for this pass.

Phone-width acceptance remains manual: the browser viewport override did not change the rendered viewport (it stayed 1280px), so no mobile screenshot pass is claimed. The temporary override was reset. Final TypeScript and all three email tests passed after the last edits; targeted diff whitespace checks also passed.

## Loading-screen feature restoration

Restored the rotating DCM use-case carousel and a four-part educational inspection animation (centering, corners, edges, surface) in the shared loading screen. The animation does not mark analysis tasks complete or modify the queue. Benefits are available to all users while processing, with hover/focus pause and manual controls. Reduced-motion preferences disable automatic cycling; hidden tabs do not advance it. Uploading/error/completed states suppress benefit navigation. The persistent status bar remains mounted independently in ClientLayout and reads the existing grading queue. Four focused tests verify active/empty status bar rendering and inspection/benefit states. Browser preview confirmed manual selection of Corners and eBay InstaList. No real submission or credit use was performed.
