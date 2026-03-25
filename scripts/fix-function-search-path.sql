-- Fix "Function Search Path Mutable" warnings
-- Setting search_path to '' prevents search path injection attacks

ALTER FUNCTION public.get_starwars_card_by_id SET search_path = '';
ALTER FUNCTION public.get_yugioh_card_by_set_code SET search_path = '';
ALTER FUNCTION public.search_starwars_card SET search_path = '';
ALTER FUNCTION public.search_yugioh_card SET search_path = '';
