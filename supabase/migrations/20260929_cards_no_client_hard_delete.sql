-- Stop clients from hard-deleting cards (Sept 29 2026).
--
-- Mobile builds from 2026-04-27 (a1dc8ef2) to 2026-07-30 (d92fb638) deleted
-- cards with supabase.from('cards').delete() straight from the device, which
-- the "Users can delete own cards" policy allowed. A device still running such
-- a bundle erases the row permanently: no deleted_at, no restore, no server
-- log. A Mana Vault (serial 311587) vanished that way on Sept 29.
--
-- Every current delete goes through the server (soft delete via
-- softDeleteOwnedCard; account/admin/Facebook deletion use the service role,
-- which bypasses RLS), so no client needs DELETE on cards. With no DELETE
-- policy, RLS denies it.

DROP POLICY IF EXISTS "Users can delete own cards" ON cards;
