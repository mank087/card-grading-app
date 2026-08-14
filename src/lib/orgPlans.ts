/**
 * Enterprise org plan pricing — single source of truth (Scenario D, Aug 2026).
 *
 * Consumed by the admin checkout-link presets, the admin org console, and the
 * public /enterprise page. Plain constants only — safe to import from client
 * components. Custom (unpublished) deals bypass this entirely: the admin
 * checkout-link API accepts arbitrary amounts.
 *
 * Do NOT use 'pro' as an org plan key — it collides with the consumer Pro
 * credit pack (src/lib/stripe.ts).
 */
export const ORG_PLANS = {
  dealer: { key: 'dealer', name: 'Dealer', priceUsd: 199, gradesPerMonth: 400, perCardUsd: 0.5 },
  enterprise: { key: 'enterprise', name: 'Enterprise', priceUsd: 399, gradesPerMonth: 1000, perCardUsd: 0.4 },
} as const;

export type OrgPlanKey = keyof typeof ORG_PLANS;

/** Overage pack: one-time purchase; credits land in the rollover bucket. */
export const ORG_OVERAGE_PACK = { priceUsd: 12.5, grades: 25, perGradeUsd: 0.5 } as const;
