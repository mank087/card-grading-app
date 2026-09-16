-- Apply before deploying the Media API photo uploader. Existing listings remain untouched.
ALTER TABLE public.ebay_listings
  ADD COLUMN IF NOT EXISTS ebay_photo_uploads JSONB;

COMMENT ON COLUMN public.ebay_listings.ebay_photo_uploads IS
  'Ordered Media API photo receipts: sourceUrl, imageUrl, imageId, expirationDate. NULL for historical listings.';
