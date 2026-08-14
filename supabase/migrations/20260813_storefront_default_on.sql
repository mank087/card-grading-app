-- Storefront pages are live by default for every org: no manual DCM enable
-- step. The public page is still gated on org status = 'active' (pending
-- applications stay invisible), and the admin toggle remains as an OFF
-- switch for problem cases. Apply manually in the Supabase SQL Editor.

alter table organizations alter column storefront_enabled set default true;
update organizations set storefront_enabled = true;
