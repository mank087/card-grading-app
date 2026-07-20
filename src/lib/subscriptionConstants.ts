/**
 * Shared Card Lovers subscription constants.
 *
 * Lives in its own module (no side effects, no SDK instantiation) so both
 * src/lib/stripe.ts (which constructs the Stripe client at import time) and
 * src/lib/credits.ts (imported by grading routes and offline scripts that
 * may not have STRIPE_SECRET_KEY loaded) can share one source of truth.
 * Previously this table was defined in stripe.ts AND duplicated as an inline
 * literal in credits.ts — a silent drift risk for loyalty bonus amounts.
 */

// Loyalty bonus milestones for monthly subscribers: month → bonus credits
export const CARD_LOVERS_LOYALTY_BONUSES: Record<number, number> = {
  3: 5,   // Month 3: +5 credits
  6: 10,  // Month 6: +10 credits
  9: 15,  // Month 9: +15 credits
  12: 20, // Month 12: +20 credits
};
