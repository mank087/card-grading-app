-- Enable RLS on Yu-Gi-Oh tables with public read-only access
-- These are reference data tables - users never write to them.
-- Import scripts use the service role key which bypasses RLS.

ALTER TABLE public.yugioh_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.yugioh_cards FOR SELECT USING (true);

ALTER TABLE public.yugioh_card_printings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.yugioh_card_printings FOR SELECT USING (true);

ALTER TABLE public.yugioh_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.yugioh_sets FOR SELECT USING (true);

ALTER TABLE public.yugioh_import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.yugioh_import_log FOR SELECT USING (true);
