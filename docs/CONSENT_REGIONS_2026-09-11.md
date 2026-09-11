# Consent system: regions, regimes and the counsel switch

Date: September 11, 2026
Status: built and deployed with the US opt-out regime OFF. Production behaves exactly as the July consent gate until `NEXT_PUBLIC_CONSENT_US_OPTOUT=1` is set in Vercel.

## Goals

1. Comply with GDPR and ePrivacy for visitors in the EEA, UK and Switzerland: nothing non-essential loads before opt-in.
2. Comply with US state privacy law (CCPA/CPRA and the copycat statutes): notice, an opt-out that is reachable from every page, and Global Privacy Control honored as an opt-out.
3. Keep California wiretap (CIPA) exposure as low as the business will accept. The only pre-consent third-party load in any regime is the Google tag in Consent Mode denied, and only in the US regime, and only once counsel turns it on.

## How it works

| Piece | File | What it does |
|---|---|---|
| Region bucket | `src/middleware.ts`, `src/lib/consentRegion.ts` | Vercel's edge geolocation header is mapped to `eu`, `us`, `other` or `unknown` and stored in the `dcm_region` cookie (1 year, no raw country). `unknown` is retried on every request. |
| Regime selection | `src/lib/consentRegion.ts` | `strict` for eu, other, unknown, and every GPC visitor. `us-optout` only for `us` and only while the flag is `1`. |
| Banner | `src/components/consent/ConsentManager.tsx` | Three copy variants (GPC, US opt-out, strict). Strict copy leads with the reason ("Help us improve DCM"), buttons are Accept / Decline, EU visitors get equal-weight buttons. All variants name every vendor. Each first display logs a "shown" impression. |
| Pre-consent behavior | same | strict: nothing loads. us-optout: Google tag with all four Consent Mode v2 signals denied. Meta, Reddit and Microsoft UET never load before Accept in any regime. |
| Opt-out | same, `src/app/ui/Footer.tsx` | "Cookie Preferences" and "Do Not Sell or Share My Personal Information" both reopen the banner. Choosing Opt out / Reject clears click-ID cookies and reloads for a clean page. |
| Audit log | `src/app/api/consent/log/route.ts` | Every decision is stored with region and mode. Falls back to the old columns if the migration is not applied yet. |
| Click IDs | `src/lib/adClickIds.ts`, `src/app/api/account/click-ids/route.ts` | gclid, gbraid, wbraid and msclkid are captured from the landing URL into first-party cookies (90 days) and saved to `profiles.ad_click_ids` at signup, with the consent choice and region at capture. Capture happens immediately in us-optout mode and only after Accept in strict mode. |

## Migrations to apply

Run both in the Supabase SQL editor before relying on the new columns. The code degrades safely until then.

- `supabase/migrations/20260911_consent_logs_region.sql`
- `supabase/migrations/20260911_profiles_ad_click_ids.sql`
- `supabase/migrations/20260911_consent_logs_shown.sql` (banner impressions: choice = shown, one row per browser session, so accept rate = granted / shown)

## The counsel decision

Setting `NEXT_PUBLIC_CONSENT_US_OPTOUT=1` (Vercel, Production environment, then redeploy) turns on the US regime. Before flipping it, counsel should confirm they are comfortable with:

1. Loading the Google tag in Consent Mode denied before any choice for US visitors. It sets no cookies and sends no identifiers, but it is a third-party script running pre-consent, which is the surface the July demand letter attacks.
2. The banner wording for the US variant (in the consent manager file).
3. The privacy policy naming the five vendors and describing the opt-out, which it still does not do.

Everything else in this change is live now and reduces, rather than adds, exposure.

## What is still not built

- The server-side conversion upload itself. The click IDs are now captured; sending purchases to Google Ads and Microsoft Advertising needs API credentials (Google Ads developer token plus OAuth, Microsoft Advertising developer token) that only the account owner can create. The upload job must skip any profile whose stored consent is not `granted` unless the region is `us` and the US regime is on, and must always skip GPC opt-outs.
- Removing Meta Pixel and Reddit Pixel. Both remain opt-in only. Dropping them entirely is the single biggest CIPA exposure reduction available and is a business decision on ad spend.
- Privacy Policy and Cookie Policy rewrite with counsel (open since July).

## Verification checklist after deploy

1. Visit the site from a US IP with no cookies. With the flag off, the banner reads the strict copy and no vendor requests appear in the network tab before a click.
2. Visit from an EU IP (or set `dcm_region=eu` by hand). Accept and Reject buttons are equal weight; nothing loads before a click.
3. With GPC enabled in the browser, no banner, no vendor requests, `dcm_consent=essential`.
4. Land on `/?gclid=test123` and accept. `dcm_gclid` cookie exists. Sign up. `profiles.ad_click_ids` for that user contains `gclid: test123`, `consent: granted`, `region`.
5. Footer shows both "Cookie Preferences" and "Do Not Sell or Share My Personal Information", and each reopens the banner.
