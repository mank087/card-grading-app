/**
 * Pokémon catalog link: verify a graded card against pokemon_cards and save the
 * result. This is the body of POST /api/pokemon/verify, moved here (Sept 24
 * 2026) so it can be called directly by server code that must not go through
 * HTTP: the owner-edit path and the first-look arrival hook.
 *
 * Three rules added with the move, all from production card a9eca6ef (Espeon-GX
 * printed 140/149, graded as "150/149", linked to sm1-152 by a ±3 fuzzy match):
 *
 *   1. AMBIGUOUS IS NOT A MATCH. When the lookup finds several possible catalog
 *      cards, they are stored in conversational_card_info.catalog_candidates for
 *      the owner to pick from, and cleared by the next successful verification.
 *   2. THE SECOND READ COUNTS. When the grading call's number finds no catalog
 *      card, first look's printed number is tried (unique exact match, name and
 *      denominator agreeing). This runs whenever verification runs, and again
 *      when a first-look record lands after the grade (reconcileFirstLookNumber).
 *   3. THE OWNER WINS. An owner-confirmed identity is never rewritten here: only
 *      the pokemon_api_* link is refreshed (or cleared when it no longer fits).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  verifyPokemonCard,
  verifyPokemonCardByPrintedNumber,
  getPokemonApiUpdateFields,
  extractPokemonMetadata,
  splitPrintedPokemonNumber,
  type CardInfoForVerification,
  type PokemonApiVerificationResult,
} from '@/lib/pokemonApiVerification';
import { preserveIdentityOnRegrade } from '@/lib/grading/preserveIdentity';
import { generateLabelData, type CardForLabel } from '@/lib/labelDataGenerator';
import { firstLookCandidate, firstLookResultOf } from './reviewPrefill';

export interface VerifyPokemonOptions {
  /** Re-verify a card that is already verified. */
  force?: boolean;
  /** Card info from the grading call (takes priority over the stored JSON). */
  overrideCardInfo?: Record<string, any> | null;
  /** Regrade context from the grading route: identity is preserved. */
  regrade?: boolean;
  reidentify?: boolean;
  /**
   * Refresh ONLY the pokemon_api_* link from the card's stored identity. Used
   * after an owner edit. Forced on for any owner-confirmed card.
   */
  linkOnly?: boolean;
  /** Log tag for who asked. */
  trigger?: string;
}

export interface VerifyPokemonOutcome {
  status: number;
  body: Record<string, any>;
}

const BASE_COLUMNS = [
  'id', 'category', 'card_name', 'featured', 'card_set', 'card_number', 'release_date',
  'manufacturer_name', 'conversational_card_info', 'pokemon_api_verified', 'serial',
  'conversational_decimal_grade', 'conversational_whole_grade', 'conversational_condition_label',
  'serial_numbering', 'first_print_rookie', 'holofoil', 'validated_source', 'ai_card_info_original',
  'label_data',
];
/** Newer columns: read when present, tolerated when a database lacks them. */
const OPTIONAL_COLUMNS = ['first_look', 'identity_revision', 'identity_confirmed_revision', 'grade_status'];

async function readCard(supabase: SupabaseClient<any, any, any>, cardId: string): Promise<Record<string, any> | null> {
  const full = await supabase.from('cards').select([...BASE_COLUMNS, ...OPTIONAL_COLUMNS].join(', ')).eq('id', cardId).maybeSingle();
  if (!full.error) return (full.data as Record<string, any> | null) ?? null;
  if (!/column|does not exist|42703|PGRST/i.test(`${full.error.code || ''} ${full.error.message || ''}`)) return null;
  const base = await supabase.from('cards').select(BASE_COLUMNS.join(', ')).eq('id', cardId).maybeSingle();
  return base.error ? null : ((base.data as Record<string, any> | null) ?? null);
}

/** The owner confirmed the CURRENT identity revision. */
export function isOwnerConfirmed(card: Record<string, any>): boolean {
  const confirmed = card?.identity_confirmed_revision;
  return confirmed !== null && confirmed !== undefined
    && Number(confirmed) >= Number(card?.identity_revision ?? 0);
}

/** The card number first look READ off the card (printed source only), or null. */
export function firstLookPrintedNumber(firstLook: unknown): string | null {
  const proposal = firstLookCandidate(firstLookResultOf(firstLook), 'card_number');
  return proposal && proposal.source === 'printed' ? proposal.value : null;
}

/** "066/196" and "66/196" are the same printed number. */
export function samePrintedNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = splitPrintedPokemonNumber(a);
  const pb = splitPrintedPokemonNumber(b);
  if (pa && pb) return pa.number.toUpperCase() === pb.number.toUpperCase() && pa.total === pb.total;
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

const LINK_CLEARED = {
  pokemon_api_id: null,
  pokemon_api_data: null,
  pokemon_api_verified: false,
  pokemon_api_verified_at: null,
  pokemon_api_confidence: null,
  pokemon_api_method: null,
};

function withoutCandidates(info: Record<string, any>): Record<string, any> {
  const { catalog_candidates: _c, catalog_candidates_at: _a, ...rest } = info;
  return rest;
}

/**
 * Verify one card and save what was found. Never throws for a normal miss; the
 * status/body pair is what the HTTP route returns.
 */
export async function verifyAndSavePokemonCard(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  opts: VerifyPokemonOptions = {},
): Promise<VerifyPokemonOutcome> {
  const startTime = Date.now();
  const tag = `[Pokemon Verify${opts.trigger ? ` ${opts.trigger}` : ''}]`;
  const card = await readCard(supabase, cardId);
  if (!card) return { status: 404, body: { error: 'Card not found' } };
  if (card.category !== 'Pokemon') {
    return { status: 200, body: { success: false, verified: false, reason: 'Not a Pokemon card', category: card.category } };
  }
  if (card.pokemon_api_verified && !opts.force) {
    return { status: 200, body: { success: true, verified: true, already_verified: true, message: 'Card was previously verified' } };
  }

  const confirmed = isOwnerConfirmed(card);
  const linkOnly = opts.linkOnly === true || confirmed;
  const convInfo = (card.conversational_card_info && typeof card.conversational_card_info === 'object')
    ? card.conversational_card_info as Record<string, any>
    : {};
  const override = linkOnly ? null : (opts.overrideCardInfo || null);

  // Link-only reads the identity the OWNER holds: the columns first, and none of
  // the grading call's number/set-code hints, which may describe the old read.
  const cardInfo: CardInfoForVerification = linkOnly
    ? {
      card_name: card.card_name || convInfo.card_name,
      player_or_character: card.featured || convInfo.player_or_character,
      set_name: card.card_set || convInfo.set_name,
      card_number: card.card_number || convInfo.card_number_raw || convInfo.card_number,
      year: card.release_date || convInfo.year,
    }
    : {
      card_name: override?.card_name || convInfo.card_name || card.card_name,
      player_or_character: override?.player_or_character || convInfo.player_or_character || card.featured,
      set_name: override?.set_name || convInfo.set_name || card.card_set,
      card_number: override?.card_number || convInfo.card_number || card.card_number,
      year: override?.year || convInfo.year || card.release_date,
      set_code: override?.set_code || convInfo.set_code || null,
      card_number_raw: override?.card_number_raw || convInfo.card_number_raw || null,
      card_number_format: override?.card_number_format || convInfo.card_number_format || null,
      set_total: override?.set_total || convInfo.set_total || null,
    } as CardInfoForVerification;

  console.log(`${tag} card ${cardId}${linkOnly ? ' (link only)' : ''}:`, cardInfo);
  let verification: PokemonApiVerificationResult = await verifyPokemonCard(cardInfo);

  // The second read: first look's printed number, when the grading read found nothing.
  let firstLookCorrection: { original: string | null; corrected: string | null } | null = null;
  if (!verification.success && !linkOnly) {
    const printed = firstLookPrintedNumber(card.first_look);
    const gradingNumber = cardInfo.card_number_raw || cardInfo.card_number || '';
    if (printed && !samePrintedNumber(printed, gradingNumber)) {
      const second = await verifyPokemonCardByPrintedNumber(cardInfo, printed);
      if (second.success) {
        console.log(`${tag} grading number "${gradingNumber}" had no catalog match; first look's printed "${printed}" → ${second.pokemon_api_id}`);
        const numberFix = second.corrections.find(c => c.field === 'card_number');
        firstLookCorrection = numberFix ? { original: numberFix.original, corrected: numberFix.corrected } : null;
        verification = second;
      } else if (second.candidates?.length && !verification.candidates?.length) {
        verification.candidates = second.candidates;
      }
    }
  }

  console.log(`${tag} result:`, {
    success: verification.success, pokemon_api_id: verification.pokemon_api_id,
    confidence: verification.confidence, corrections: verification.corrections.length,
    candidates: verification.candidates?.length || 0,
  });

  if (verification.success && verification.pokemon_api_data) {
    const updateFields = getPokemonApiUpdateFields(verification);
    if (updateFields) {
      const tcgplayerUrl = verification.pokemon_api_data.tcgplayer?.url || null;
      const metadata = extractPokemonMetadata(verification.pokemon_api_data);

      if (linkOnly) {
        const updateData = {
          pokemon_api_id: updateFields.pokemon_api_id,
          pokemon_api_data: updateFields.pokemon_api_data,
          pokemon_api_verified: true,
          pokemon_api_verified_at: updateFields.pokemon_api_verified_at,
          pokemon_api_confidence: updateFields.pokemon_api_confidence,
          pokemon_api_method: updateFields.pokemon_api_method,
          tcgplayer_url: tcgplayerUrl,
          conversational_card_info: {
            ...withoutCandidates(convInfo),
            pokemon_api_verified: true,
            pokemon_api_id: verification.pokemon_api_id,
            tcgplayer_url: tcgplayerUrl,
          },
        };
        const { error } = await supabase.from('cards').update(updateData).eq('id', cardId);
        if (error) console.error(`${tag} link update failed:`, error.message);
      } else {
        const updatedCardInfo: Record<string, any> = {
          ...withoutCandidates(convInfo),
          set_name: metadata.set_name || convInfo.set_name,
          pokemon_api_verified: true,
          pokemon_api_id: verification.pokemon_api_id,
          rarity_or_variant: metadata.rarity || convInfo.rarity_or_variant,
          tcgplayer_url: tcgplayerUrl,
          ...(verification.name_agreement ? { _name_agreement: verification.name_agreement } : {}),
          ...(verification.rejected_candidate ? { _rejected_candidate: verification.rejected_candidate } : {}),
        };
        if (firstLookCorrection) updatedCardInfo._number_from_first_look = firstLookCorrection;

        const identityKeys = ['card_name', 'card_set', 'card_number', 'release_date'] as const;
        const overridesIdentity = identityKeys.some(k => (updateFields as any)[k] != null && (updateFields as any)[k] !== card[k]);

        const updateData: Record<string, any> = { ...updateFields, conversational_card_info: updatedCardInfo };
        // Keep the two card-number keys in step with the column (consumers read either).
        if (updateData.card_number && updateData.card_number !== card.card_number) {
          updatedCardInfo.card_number = updateData.card_number;
          updatedCardInfo.card_number_raw = updateData.card_number;
        }

        // Aug 25 2026: keep a pre-override snapshot so any rewrite is reversible.
        if (overridesIdentity && !card.ai_card_info_original) {
          updateData.ai_card_info_original = {
            card_name: card.card_name, card_set: card.card_set, card_number: card.card_number,
            release_date: card.release_date, ...(convInfo || {}), _snapshot_by: 'pokemon/verify',
          };
        }

        // Regrade identity guard: on a plain regrade of an identified card this
        // strips the identity rewrites and leaves the pokemon_api_* refresh in place.
        const idGuard = await preserveIdentityOnRegrade(supabase, cardId, updateData, {
          forceRegrade: opts.regrade === true, reidentify: opts.reidentify === true, tag: `POST /api/pokemon/verify ${cardId}`,
        });
        if (idGuard.abort) {
          throw new Error(`identity guard aborted the save (${idGuard.reason}) — regrade not applied`);
        }

        const finalName = updateData.card_name ?? card.card_name;
        const finalSet = updateData.card_set ?? card.card_set;
        const finalNumber = updateData.card_number ?? card.card_number;
        const finalYear = updateData.release_date ?? card.release_date;
        if (finalName !== card.card_name || finalSet !== card.card_set || finalNumber !== card.card_number || finalYear !== card.release_date) {
          try {
            const cardForLabel: CardForLabel = {
              id: cardId,
              category: 'Pokemon',
              serial: card.serial,
              conversational_decimal_grade: card.conversational_decimal_grade ?? null,
              conversational_whole_grade: card.conversational_whole_grade ?? null,
              conversational_condition_label: card.conversational_condition_label ?? null,
              conversational_card_info: updateData.conversational_card_info ?? convInfo ?? null,
              card_name: finalName,
              card_set: finalSet,
              card_number: finalNumber,
              featured: card.featured,
              pokemon_featured: card.featured,
              release_date: finalYear,
              serial_numbering: card.serial_numbering,
              first_print_rookie: card.first_print_rookie,
              holofoil: card.holofoil,
            };
            updateData.label_data = generateLabelData(cardForLabel);
          } catch (labelErr: any) {
            console.warn(`${tag} label regeneration failed (row still updated): ${labelErr?.message}`);
          }
        }

        const { error } = await supabase.from('cards').update(updateData).eq('id', cardId);
        if (error) console.error(`${tag} failed to update card:`, error.message);
      }
    }
  } else if (linkOnly) {
    // The identity the owner holds does not match the linked catalog card any
    // more (or matches several). Drop the stale link; offer candidates if any.
    const info = withoutCandidates(convInfo);
    const updateData = {
      ...LINK_CLEARED,
      tcgplayer_url: null,
      conversational_card_info: {
        ...info,
        pokemon_api_verified: false,
        pokemon_api_id: null,
        tcgplayer_url: null,
        ...(verification.candidates?.length
          ? { catalog_candidates: verification.candidates, catalog_candidates_at: new Date().toISOString() }
          : {}),
      },
    };
    const { error } = await supabase.from('cards').update(updateData).eq('id', cardId);
    if (error) console.error(`${tag} could not clear the stale link:`, error.message);
  } else if (verification.candidates?.length) {
    const { error } = await supabase.from('cards').update({
      conversational_card_info: {
        ...convInfo,
        catalog_candidates: verification.candidates,
        catalog_candidates_at: new Date().toISOString(),
      },
    }).eq('id', cardId);
    if (error) console.error(`${tag} could not store catalog candidates:`, error.message);
  }

  return {
    status: 200,
    body: {
      success: verification.success,
      verified: verification.verified,
      pokemon_api_id: verification.pokemon_api_id,
      verification_method: verification.verification_method,
      confidence: verification.confidence,
      corrections: verification.corrections,
      candidates: verification.candidates || [],
      used_first_look_number: !!firstLookCorrection,
      link_only: linkOnly,
      metadata: verification.pokemon_api_data ? extractPokemonMetadata(verification.pokemon_api_data) : null,
      error: verification.error || null,
      processing_time_ms: Date.now() - startTime,
    },
  };
}

/** Fields whose change makes the stored catalog link describe a different card. */
const CATALOG_LINK_FIELDS = ['card_name', 'featured', 'card_set', 'card_number'];

export function catalogRelinkNeeded(category: string | null | undefined, changedFields: string[] | undefined): boolean {
  return category === 'Pokemon' && (changedFields || []).some(f => CATALOG_LINK_FIELDS.includes(f));
}

/**
 * A first-look record just landed. When it read a different printed number from
 * the one stored, the stored identity is not owner-confirmed, and the stored
 * number found no single catalog card, run verification again: the second read
 * may be the one the catalog confirms. Never throws.
 */
export async function reconcileFirstLookNumber(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
): Promise<'skipped' | 'verified' | 'unmatched'> {
  try {
    const card = await readCard(supabase, cardId);
    if (!card || card.category !== 'Pokemon') return 'skipped';
    // Mid-grade: the grading route runs verification itself once the grade is saved.
    if (typeof card.grade_status === 'string' && card.grade_status.startsWith('processing')) return 'skipped';
    if (isOwnerConfirmed(card)) return 'skipped';
    const info = (card.conversational_card_info && typeof card.conversational_card_info === 'object') ? card.conversational_card_info : {};
    const stored = card.card_number || info.card_number_raw || info.card_number;
    if (!stored) return 'skipped'; // not graded yet
    const printed = firstLookPrintedNumber(card.first_look);
    if (!printed || samePrintedNumber(printed, stored)) return 'skipped';
    const unresolved = !card.pokemon_api_verified || (Array.isArray(info.catalog_candidates) && info.catalog_candidates.length > 0);
    if (!unresolved) return 'skipped';
    const outcome = await verifyAndSavePokemonCard(supabase, cardId, { force: true, trigger: 'first-look' });
    return outcome.body?.success ? 'verified' : 'unmatched';
  } catch (err: any) {
    console.warn(`[Pokemon Verify first-look] reconcile failed for ${cardId}: ${err?.message || err}`);
    return 'skipped';
  }
}
