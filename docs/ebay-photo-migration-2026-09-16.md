# eBay photo migration

The shared single/bulk publisher now uses Media API `POST /commerce/media/v1_beta/image/create_image_from_url` instead of the retiring Trading API photo operation. Listing creation remains on the Trading API.

## Behavior

- Every selected image must yield a valid HTTPS EPS URL before a pending claim or listing is created. Partial failures no longer fall back to Supabase URLs.
- Up to three image uploads run concurrently, retaining the selected photo order. Each request has an eight-second timeout; the entire hosting step has a 25-second budget.
- Network failures, HTTP 429, and HTTP 5xx can retry once. Retry-After is respected; a delay beyond the remaining budget returns a retryable failure instead of an early retry. HTTP 400/401/403 are not automatically retried.
- Existing EPS input URLs are uploaded as fresh resources rather than assumed valid. This does not change any existing live listing.
- The publisher saves the final EPS URLs in `ebay_image_urls`. `ebay_photo_uploads` preserves each source URL, hosted URL, available image ID, and expiration date. Historical rows remain NULL for receipts; their URLs are not relabeled or backfilled speculatively.
- Structured `upload_complete` and `upload_failed` logs expose counts and failure category/index/status without credentials or source URLs. They are log events, not a configured alert service.
- Authorization errors use the existing reconnect handling, including pausing bulk publishing. Other photo failures leave the bulk item retryable through the existing failed-item UI. No automatic listing retry was introduced.

## Deployment order

1. Apply `supabase/migrations/20260916_ebay_photo_uploads.sql` before deploying the app. It adds one nullable JSONB column and is backward compatible with the old publisher. Without it, the claim insert fails safely before any eBay listing is created.
2. Deploy the changed application files together. No new environment variable or additional OAuth scope is required by the documented image API: `sell.inventory` is already requested. Historical seller grants/app permissions still need a real account check.
3. Use a sandbox seller to upload real front/back images. Check returned EPS URLs, order, image IDs, and expiration metadata. Read back the test listing to compare its pictures with the saved receipt.
4. Before broad rollout, use an authorized controlled production listing to verify images on web and mobile, title editing, and adding a gallery photo in the eBay app. Automated mocked tests cannot prove those external UI behaviors.
5. Monitor photo failures by HTTP status, especially 401/403 and 429, and overall publish duration. If uploads fail, preserve drafts and investigate; do not restore the retiring endpoint or silent external-photo fallback.

The initial migration was deployed as c71d4c76 after the production schema migration was confirmed. A subsequent Android attempt exposed a routing bug: production api.ebay.com returns an empty 404 for the Media image endpoint. The hotfix uses apim.ebay.com (apim.sandbox.ebay.com for sandbox). Routing and unknown service errors no longer tell the seller to replace a photo; known image validation codes still identify the affected photo. OAuth error bodies are recognized even when eBay returns HTTP 400.

POST /api/ebay/images/verify provides authenticated, card-owner-scoped photo-only verification. It accepts only public image URLs under that owner/card storage prefix, uploads them with the connected seller token, and returns EPS receipts. It never creates or edits a listing. Real account uploads are an explicit operational check; listing UI checks remain separate.

## Sources

- [eBay image management](https://www.developer.ebay.com/api-docs/sell/static/inventory/managing-image-media.html): creation response, Location image ID, EPS image URL, and expiration metadata.
- [eBay Media API authentication and image endpoints](https://www.ebay.co.jp/developer/api/media_api/documentation): seller user token with `sell.inventory`, REST paths, and response statuses.
- [Deprecation status](https://developer.ebay.com/develop/get-started/api-deprecation-status): `UploadSiteHostedPictures` shuts down September 30, 2026.

