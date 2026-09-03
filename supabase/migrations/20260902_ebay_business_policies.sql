-- eBay business policies opt-in (InstaList bulk Phase 3).
--
-- eBay sellers can either send shipping/returns/payment INLINE on every
-- listing (what we have always done) or point each listing at a saved
-- "business policy" on their account. Opting in is an ACCOUNT-WIDE change on
-- eBay's side (the SELLING_POLICY_MANAGEMENT program), so it is off by default
-- and only ever turned on from an explicit confirmation in the UI.
--
-- The flag and the seller's three chosen defaults live on the same
-- listing_templates row the rest of the listing defaults use, so a personal
-- seller and an enterprise store each get their own set (the row is keyed by
-- user_id with org_id null, or by org_id).
--
-- Apply manually in the Supabase SQL Editor.

alter table listing_templates
  add column if not exists use_business_policies boolean not null default false,
  add column if not exists default_shipping_policy_id text,
  add column if not exists default_return_policy_id text,
  add column if not exists default_payment_policy_id text;

comment on column listing_templates.use_business_policies is
  'Seller opted into eBay business policies. When true, listings send '
  '<SellerProfiles> instead of inline ShippingDetails/ReturnPolicy/DispatchTimeMax.';
comment on column listing_templates.default_shipping_policy_id is
  'eBay fulfillmentPolicyId prefilled into the listing modal and batch settings.';
comment on column listing_templates.default_return_policy_id is
  'eBay returnPolicyId prefilled into the listing modal and batch settings.';
comment on column listing_templates.default_payment_policy_id is
  'eBay paymentPolicyId prefilled into the listing modal and batch settings.';
