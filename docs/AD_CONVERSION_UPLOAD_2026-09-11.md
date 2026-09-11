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
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads → Tools → API Center (manager account 720-349-0431). Apply for Basic access; test-account tokens cannot upload to a production account. |
| `GOOGLE_ADS_OAUTH_CLIENT_ID`, `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client (Desktop app). Enable the Google Ads API on the project. |
| `GOOGLE_ADS_OAUTH_REFRESH_TOKEN` | One-time OAuth consent as admin@dcmgrading.com with scope `https://www.googleapis.com/auth/adwords`. Run `node scripts/google-ads-oauth.mjs` once the client ID and secret exist; it prints the refresh token. |
| `GOOGLE_ADS_CUSTOMER_ID` | 2723302193 (the DCM Grading account, digits only) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | 7203490431 (the manager account, digits only) |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | A NEW conversion action: Goals → Conversions → New → Import → "Other data sources or CRMs" → "Track conversions from clicks". Name it "Purchase (server)". Category Purchase, value from the upload, count Every, click-through window 90 days. The ID is in the action's URL. Do NOT reuse the GA4-imported PURCHASE action; click uploads only work on an upload-type action. |

Microsoft Advertising:

| Variable | Where it comes from |
|---|---|
| `MS_ADS_DEVELOPER_TOKEN` | Microsoft Advertising → Tools → Developer settings → Request token (approved for production, usually same day). |
| `MS_ADS_OAUTH_CLIENT_ID`, `MS_ADS_OAUTH_CLIENT_SECRET` | Azure portal → App registrations → new app (public client or web). Redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient`. Secret optional for a public client. |
| `MS_ADS_OAUTH_REFRESH_TOKEN` | One-time consent as admin@dcmgrading.com with scope `https://ads.microsoft.com/msads.manage offline_access`. `node scripts/microsoft-ads-oauth.mjs` prints it. |
| `MS_ADS_CUSTOMER_ID` | 255040057 |
| `MS_ADS_ACCOUNT_ID` | 187301179 |
| `MS_ADS_OFFLINE_CONVERSION_NAME` | A NEW goal: Conversions → Conversion goals → Create → "Offline conversions". Name it "Purchase (server)", category Purchase, value varies, count Unique, 90-day window. The existing "Purchase" goal is an event goal and rejects offline uploads. |

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
