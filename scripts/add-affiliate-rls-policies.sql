-- Add RLS policies for affiliate tables
-- RLS is already enabled but no policies exist.
-- All access is through server-side API routes using the service role key
-- (which bypasses RLS), so these policies are restrictive by design.
-- Only allow public read of active affiliates (for code validation)
-- and public insert to clicks (for tracking).

-- affiliate_clicks: public can insert (fire-and-forget tracking), no read
CREATE POLICY "Allow public insert for click tracking"
  ON public.affiliate_clicks FOR INSERT
  WITH CHECK (true);

-- affiliates: public can read active affiliates (for code validation)
CREATE POLICY "Allow public read active affiliates"
  ON public.affiliates FOR SELECT
  USING (status = 'active');

-- affiliate_commissions: no public access needed (admin-only via service role)
CREATE POLICY "Deny public access to commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (false);
