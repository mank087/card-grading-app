-- Enable RLS on Star Wars tables and add public read-only policies
-- These are public reference data, so anyone can SELECT but no one can modify via API

-- starwars_cards
ALTER TABLE public.starwars_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.starwars_cards
  FOR SELECT USING (true);

-- starwars_sets
ALTER TABLE public.starwars_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.starwars_sets
  FOR SELECT USING (true);

-- starwars_import_log
ALTER TABLE public.starwars_import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.starwars_import_log
  FOR SELECT USING (true);
