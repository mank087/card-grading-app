/**
 * Stripe Tax integration — flag-gated.
 *
 * IMPORTANT: automatic tax collection is only lawful where DCM is REGISTERED
 * to collect (state registrations, EU OSS, UK HMRC, etc.). Enabling collection
 * without registration is worse than not collecting. Therefore everything here
 * is inert until STRIPE_TAX_ENABLED=true is set, which should happen only
 * after: (1) Stripe Tax is activated in the dashboard with an origin address,
 * (2) registrations are added in Stripe Tax settings per the accountant's
 * guidance. Stripe Tax then computes tax only for jurisdictions with active
 * registrations and monitors thresholds everywhere else.
 */
import type Stripe from 'stripe'

export const STRIPE_TAX_ENABLED = process.env.STRIPE_TAX_ENABLED === 'true'

/**
 * Checkout session params for automatic tax. `hasExistingCustomer` must be
 * true when the session passes a `customer` id — Stripe then requires
 * customer_update permissions to save the address used for tax calculation.
 */
export function taxParams(hasExistingCustomer: boolean): Partial<Stripe.Checkout.SessionCreateParams> {
  if (!STRIPE_TAX_ENABLED) return {}
  return {
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    ...(hasExistingCustomer
      ? { customer_update: { address: 'auto', name: 'auto' } }
      : {}),
  }
}

/**
 * B2B additions for enterprise org checkouts: collect the business's tax ID
 * (e.g. UK/EU VAT number) so cross-border B2B sales can reverse-charge and the
 * invoice carries the customer's VAT number.
 */
export function orgTaxParams(hasExistingCustomer: boolean): Partial<Stripe.Checkout.SessionCreateParams> {
  if (!STRIPE_TAX_ENABLED) return {}
  return {
    ...taxParams(hasExistingCustomer),
    tax_id_collection: { enabled: true },
  }
}

/** tax_behavior for inline price_data: tax is added ON TOP of our USD price. */
export function priceDataTaxBehavior(): { tax_behavior?: 'exclusive' } {
  return STRIPE_TAX_ENABLED ? { tax_behavior: 'exclusive' } : {}
}
