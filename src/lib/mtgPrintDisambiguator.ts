// src/lib/mtgPrintDisambiguator.ts
// Visual print disambiguation for MTG cards.
//
// When the card NAME matches the internal mtg_cards database but the specific
// PRINT is ambiguous (heavily reprinted card, vintage card with no printed
// collector info, or an unreadable set symbol), this module shows the
// customer's photo alongside candidate reference images and asks a vision
// model to pick the matching print based on frame style, border, set symbol,
// art, and copyright line.

import OpenAI from 'openai';
import type { MtgCard } from './mtgCardMatcher';
import { BASELINE_MODEL, applyModelCompat } from './grading/modelRouter';

const MAX_CANDIDATES = 8;

export interface DisambiguationResult {
  card: MtgCard | null;
  chosenIndex: number | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  candidatesShown: number;
  candidatesTotal: number;
}

/**
 * Pick which print of a card matches the customer's photo.
 * Returns card: null when the model can't make a confident pick — callers
 * should then keep the AI-extracted info rather than guessing a print.
 */
export async function disambiguateMtgPrint(
  frontImageUrl: string,
  candidates: MtgCard[]
): Promise<DisambiguationResult> {
  const noPick = (reason: string): DisambiguationResult => ({
    card: null,
    chosenIndex: null,
    confidence: 'low',
    reason,
    candidatesShown: Math.min(candidates.length, MAX_CANDIDATES),
    candidatesTotal: candidates.length
  });

  if (candidates.length === 0) return noPick('No candidates provided');
  if (candidates.length === 1) {
    return {
      card: candidates[0],
      chosenIndex: 0,
      confidence: 'high',
      reason: 'Only one candidate print',
      candidatesShown: 1,
      candidatesTotal: 1
    };
  }

  // Cap the panel; candidates arrive oldest-first from getAllPrints, so keep a
  // spread across the full range rather than just the oldest N.
  let shown = candidates;
  if (candidates.length > MAX_CANDIDATES) {
    const step = (candidates.length - 1) / (MAX_CANDIDATES - 1);
    const indices = new Set<number>();
    for (let i = 0; i < MAX_CANDIDATES; i++) indices.add(Math.round(i * step));
    shown = [...indices].sort((a, b) => a - b).map(i => candidates[i]);
    console.log(`[MTG Disambiguator] ${candidates.length} prints, sampling ${shown.length} across the release range`);
  }

  const withImages = shown.filter(c => c.image_small || c.image_normal);
  if (withImages.length < 2) return noPick('Not enough candidate reference images');

  const candidateLines = withImages.map((c, i) => {
    const year = c.released_at ? new Date(c.released_at).getFullYear() : '?';
    const traits = [
      c.frame ? `frame ${c.frame}` : null,
      c.border_color ? `${c.border_color} border` : null,
      c.full_art ? 'full art' : null,
      c.promo ? 'promo' : null
    ].filter(Boolean).join(', ');
    return `${i}: ${c.set_name} (${c.set_code}) #${c.collector_number}, ${year}${traits ? ` — ${traits}` : ''}`;
  }).join('\n');

  const systemPrompt = `You identify which printing of a Magic: The Gathering card appears in a customer's photo.

The FIRST image is the customer's photo. Each following image is a reference for one candidate printing, in the same order as the numbered list.

Compare frame style (old frame vs modern vs borderless), border color, set symbol shape and rarity color, art and art crop, copyright/collector line, and any foil treatment. The customer photo may have glare or be slightly tilted — focus on print features, not condition.

Respond with JSON only:
{"chosen_index": <number or null>, "confidence": "high" | "medium" | "low", "reason": "<one short sentence>"}

Use null with confidence "low" if no candidate clearly matches. Do NOT guess between visually identical options — prefer null over a coin flip.`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: `Candidate printings:\n${candidateLines}\n\nFirst image = customer photo. Then one reference image per candidate, in order.` },
      { type: 'image_url', image_url: { url: frontImageUrl, detail: 'high' } },
      ...withImages.map(c => ({
        type: 'image_url' as const,
        image_url: { url: (c.image_small || c.image_normal)!, detail: 'low' as const }
      }))
    ];

    // Route through modelRouter rather than naming a model here. This call
    // sat on a hardcoded 'gpt-5.1' after the luna canary graduated, so it ran
    // mid-grade at ~6x the input cost — and it made cards.grading_model partly
    // untrue: a card stamped gpt-5.6-luna could have had its printing decided
    // by 5.1. applyModelCompat also strips temperature/top_p, which reasoning
    // models 400 on rather than ignore.
    const { config: disambigConfig } = applyModelCompat({
      model: BASELINE_MODEL,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ]
    }, BASELINE_MODEL);

    const response = await openai.chat.completions.create(disambigConfig as any);

    const raw = response.choices[0]?.message?.content;
    if (!raw) return noPick('Empty model response');

    const parsed = JSON.parse(raw);
    const idx = parsed.chosen_index;
    const confidence: 'high' | 'medium' | 'low' =
      parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low';

    if (typeof idx !== 'number' || idx < 0 || idx >= withImages.length || confidence === 'low') {
      console.log(`[MTG Disambiguator] No confident pick: ${parsed.reason || 'no reason given'}`);
      return noPick(parsed.reason || 'Model declined to pick');
    }

    const picked = withImages[idx];
    console.log(`[MTG Disambiguator] Picked print ${idx}: ${picked.set_name} (${picked.set_code}) #${picked.collector_number} — ${confidence}: ${parsed.reason}`);
    return {
      card: picked,
      chosenIndex: idx,
      confidence,
      reason: parsed.reason || '',
      candidatesShown: withImages.length,
      candidatesTotal: candidates.length
    };
  } catch (err: any) {
    console.error('[MTG Disambiguator] Error:', err.message);
    return noPick(`Disambiguation failed: ${err.message}`);
  }
}
