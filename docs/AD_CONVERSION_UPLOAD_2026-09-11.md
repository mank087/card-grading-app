# Server-side ad conversion upload

Date: September 11, 2026
Status: code deployed, queue live, uploads dormant until credentials are set. Rows accumulate as `pending` in `ad_conversion_uploads` and are sent on the first run after the environment variables exist.

## What it does

1. On every successful purchase (Stripe checkout, Card Lovers first payment, Apple in-app, Google Play in-app) the server looks up `profiles.ad_click_ids` for the buyer.
2. If the record exists and was captured with `consent = granted`, one queue row is written per platform: Google if a gclid, gbraid or wbraid is stored, Microsoft if an msclkid is stored.
3. A daily cron (`/api/cron/upload-ad-conversions`, 05:00 UTC) re-reads each buyer's profile, skips anyone whose record is gone (opt-out clears it), sends the rest in one batch per platform, and records sent / failed with the platform's error text.
4. The same cron deletes click IDs older than 90 days from profiles.

Payload per conversion: click ID, time, value, currency, order ID. Nothing else.

## Environment variables (Vercel, Production)

Google Ads:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads → Tools → API Center. The API Center only exists on a MANAGER account; the admin@dcmgrading.com login only sees the client account 272-330-2193, so this must be requested from whichever Google login owns manager 720-349-0431 (or a new manager account that links the client). Apply for Basic access; test-account tokens cannot upload to a production account. |
| `GOOGLE_ADS_OAUTH_CLIENT_ID`, `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client (Desktop app). Enable the Google Ads API on the project. |
| `GOOGLE_ADS_OAUTH_REFRESH_TOKEN` | One-time OAuth consent as admin@dcmgrading.com with scope `https://www.googleapis.com/auth/adwords`. Run `node scripts/google-ads-oauth.mjs` once the client ID and secret exist; it prints the refresh token. |
| `GOOGLE_ADS_CUSTOMER_ID` | 2723302193 (the DCM Grading account, digits only) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | 7203490431 (the manager account, digits only) |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | **7760461602** (created Sept 11: "Purchase (server)", source Import from clicks, Secondary, value per conversion with $1 fallback, count Every, 90-day window). Original instructions for reference: A NEW conversion action: Goals → Conversions → New → Import → "Other data sources or CRMs" → "Track conversions from clicks". Name it "Purchase (server)". Category Purchase, value from the upload, count Every, click-through window 90 days. The ID is in the action's URL. Do NOT reuse the GA4-imported PURCHASE action; click uploads only work on an upload-type action. |

Microsoft Advertising:

| Variable | Where it comes from |
|---|---|
| `MS_ADS_DEVELOPER_TOKEN` | ISSUED Sept 11 (production access approved by email). Read it at Settings → Developer settings under the manager account K145001CB7 (ads.microsoft.com/cc/settings/devsettings). Not recorded here. |
| `MS_ADS_OAUTH_CLIENT_ID`, `MS_ADS_OAUTH_CLIENT_SECRET` | Azure portal → App registrations → new app (public client or web). Redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient`. Secret optional for a public client. |
| `MS_ADS_OAUTH_REFRESH_TOKEN` | One-time consent as admin@dcmgrading.com with scope `https://ads.microsoft.com/msads.manage offline_access`. `node scripts/microsoft-ads-oauth.mjs` prints it. |
| `MS_ADS_CUSTOMER_ID` | 255040057 |
| `MS_ADS_ACCOUNT_ID` | 187301179 |
| `MS_ADS_OFFLINE_CONVERSION_NAME` | **Purchase (server)** (created Sept 11: offline conversion goal, category Purchase, value varies with $1 fallback, count All, 90-day window, NOT included in Conversions = secondary, enhanced conversions off). Original instructions: A NEW goal: Conversions → Conversion goals → Create → "Offline conversions". Name it "Purchase (server)", category Purchase, value varies, count Unique, 90-day window. The existing "Purchase" goal is an event goal and rejects offline uploads. |

## Avoiding double counting

For web buyers who accepted cookies, the client-side pixel already reports the purchase. Until the server path is validated, keep the new "Purchase (server)" actions as **secondary / not used for bidding** on both platforms and compare their counts with the pixel counts for two weeks. Then switch: make the server action primary and the pixel action secondary. The server action is the more complete one (it includes iOS and Android), so it should be the one bidding learns from. Do not run both as primary.

## Checking the queue

```sql
select platform, status, count(*), min(occurred_at), max(occurred_at)
from ad_conversion_uploads group by 1, 2 order by 1, 2;
```

`pending` with `error = 'credentials not configured'` means the platform's variables are missing. `skipped` means the buyer opted out before the upload ran. `failed` rows have five attempts and the platform's last error text.

## Manual run

```
curl -H "Authorization: Bearer $CRON_SECRET" https://dcmgrading.com/api/cron/upload-ad-conversions
```

The JSON response reports sent / skipped / failed / pending / pruned and which platforms are configured.

## Meta Conversions API (2026-10-22)

Meta is a third platform on the same queue and cron. It stays dormant until both required variables exist; until then Meta rows sit `pending` with `credentials not configured`, like Google and Microsoft.

**Apply first:** `supabase/migrations/20261022_ad_conversion_uploads_meta.sql` (adds platform `meta`, click kinds `fbc` / `fbp`, source `web`, and the `event_name` column). Without it the cron errors on the `event_name` read (rows stay pending) and Meta / registration rows fail to insert; Google and Microsoft purchase enqueues keep working.

### Environment variables (Vercel, Production)

| Variable | Value |
|---|---|
| `META_PIXEL_ID` | `2308558869571917` (the dataset / pixel ConsentManager loads) |
| `META_CAPI_ACCESS_TOKEN` | Events Manager > the dataset > Settings > Conversions API > Generate access token (a system-user token). |
| `META_TEST_EVENT_CODE` | Optional. The `TEST…` code from Events Manager > Test events. While set, every event goes to Test events only and is **not** counted. Remove it after verifying. |

### What is sent

- **Purchase** for every purchase (Stripe and in-app), **CompleteRegistration** for a new web account. Google and Microsoft still receive purchases only.
- `user_data` is `fbc` (built from the landing `fbclid` as `fb.1.<capture ms>.<fbclid>`) or, without a Meta click, the pixel's `_fbp` browser id. No email, phone or name. Hashed email would lift match rate and is a possible later change, deliberately not made.
- `action_source` is `website` for Stripe and registrations (with `event_source_url` set to the page the pixel fired on), `other` for App Store / Google Play purchases.
- **Limited Data Use** on every event: `data_processing_options: ['LDU']`, country `0`, state `0` (Meta geolocates and applies LDU where state law requires it).
- Meta refuses events older than 7 days, so Meta rows past that are marked `skipped` instead of retried. Turning the sender on later does not backfill older rows.
- Note: Meta documents `client_user_agent` as expected for `website` events. It is not stored or sent (minimal-payload policy). If Test events shows rejections or a low match-quality warning for it, that is the field to revisit.

### Registrations

`/auth/callback` (new account, both the main and retry paths) syncs click IDs, then calls `POST /api/account/registered`. That route queues a Meta `registration` row with event id `reg_<userId>` for accounts created in the last 7 days. It is idempotent through the `(platform, event_id)` unique index.

### Deduplication contract

Meta merges a browser and a server event that share `event_name` and `event_id` (48-hour window). The browser pixel passes the same id as its `eventID`:

| Event | Browser | Server event_id |
|---|---|---|
| CompleteRegistration | `/auth/callback` and every email sign-up form (login, card / pokemon / sports landing, why-dcm, floating CTA) pass `reg_<userId>` | `reg_<userId>` |
| Purchase, credits / VIP | `/credits/success` passes `analyticsTransactionId(session_id)` | same (Stripe webhook) |
| Purchase, Founders | `/founders/success` passes `analyticsTransactionId(session_id, 'founders_')` | same |
| Card Lovers | `/card-lovers/success` fires `Subscribe` with `analyticsTransactionId(session_id, 'card_lovers_')` | sent as `Purchase` with that id. Different names, so not merged; there is no browser Purchase for it to double count. |

In-app purchases have no browser event.

### Consent

Same gate as Google and Microsoft. `fbclid` / `fbc` are captured with the other click IDs (immediately in us-optout, only after Accept in strict regions; opt-out clears `dcm_fbclid` / `dcm_fbc` and the profile record). `_fbp` exists only after the pixel loads, which happens only after Accept. Server-side, a row is queued only when the stored record has `consent = 'granted'`, and consent is re-checked at send. In strict regions this means a Meta click that never reaches Accept on the landing page is not attributable, by design.

### Verifying

1. Set `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` and `META_TEST_EVENT_CODE`; redeploy.
2. Visit `https://dcmgrading.com/?fbclid=test123`, Accept, sign up with a fresh account; make a purchase if needed.
3. Run the cron manually (above). The summary should show `configured.meta: true`.
4. Events Manager > Test events should show the server events (CompleteRegistration / Purchase, "Server") beside the browser ones, marked deduplicated.
5. Remove `META_TEST_EVENT_CODE` and redeploy.
