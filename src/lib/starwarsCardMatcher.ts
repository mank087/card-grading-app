/** Retired catalog. Kept as a non-querying compatibility stub for old callers. */
export interface StarWarsCard {
  id: string;
  card_name: string;
  card_number: string | null;
  /** Bracket content from the PriceCharting product name (NULL = base card).
   *  May be undefined/null on all rows if the variant_text backfill hasn't run yet. */
  variant_text?: string | null;
  set_id: string | null;
  set_name: string | null;
  console_name: string | null;
  genre: string | null;
  release_date: string | null;
  loose_price: number | null;
  cib_price: number | null;
  new_price: number | null;
  graded_price: number | null;
  box_only_price: number | null;
  manual_only_price: number | null;
  bgs_10_price: number | null;
  sales_volume: string | null;
  pricecharting_id: string | null;
}

export interface MatchConfidenceFlags {
  nameMatched: boolean;
  nameScore: number;
  numberMatched: boolean;
  numberScore: number;
  setMatched: boolean;
  setScore: number;
  characterMatched: boolean;
  characterScore: number;
  overallConfidence: 'high' | 'medium' | 'low';
  matchedFeatures: number;
  totalFeatures: number;
  warnings: string[];
}

/** One member of a variant family: rows sharing a card_number/base name that
 *  differ only in their PriceCharting bracket variant (base + foils/parallels). */
export interface FamilyVariant {
  id: string;
  card_name: string;
  variant_text: string | null;
  loose_price: number | null;
  graded_price: number | null;
}

export type VariantResolution =
  | 'single'        // only one row in the family — no ambiguity
  | 'hint'          // variant resolved via the caller-supplied variant hint
  | 'default_base'; // multiple variants, defaulted to the base (non-variant) row

export interface MatchResult {
  card: StarWarsCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
  /** All rows sharing the matched card's number/base name (base + variants). */
  family: FamilyVariant[];
  variantResolution: VariantResolution | null;
}


export async function lookupStarWarsCard(_name:string,_number?:string,_set?:string,_character?:string,_variant?:string):Promise<MatchResult> {
  return {card:null,score:0,family:[],variantResolution:null,confidence:{nameMatched:false,nameScore:0,numberMatched:false,numberScore:0,
    setMatched:false,setScore:0,characterMatched:false,characterScore:0,overallConfidence:'low',matchedFeatures:0,totalFeatures:0,
    warnings:['Star Wars internal catalog retired; use Other / Star Wars photo identification and owner review']}};
}
