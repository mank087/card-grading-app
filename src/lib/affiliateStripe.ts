/**
 * affiliateStripe.ts: the one place that creates an affiliate's Stripe
 * coupon and promotion code.
 *
 * Why it exists (2026-09-15): the create route built the coupon name as
 * "Affiliate: CODE (15% off first purchase)", which is 43 characters for a
 * seven-letter code. Stripe caps coupon names at 40, so every code longer than
 * four characters failed silently and the affiliate row was saved with no
 * Stripe ids (MANIA15). The name here stays under the cap for any code up to
 * 20 characters, the failure is returned to the caller instead of swallowed,
 * and an existing promotion code with the same text is reused rather than
 * duplicated, so the admin "Create Stripe code" action is safe to repeat.
 */
import { stripe } from '@/lib/stripe';

export interface AffiliateStripeIds {
  couponId: string;
  promotionCodeId: string;
  reused: boolean;
}

/** Stripe's coupon name limit. */
const COUPON_NAME_MAX = 40;

export function affiliateCouponName(code: string, discountPercent: number): string {
  const name = `Affiliate ${code} ${discountPercent}% off`;
  return name.length <= COUPON_NAME_MAX ? name : name.slice(0, COUPON_NAME_MAX);
}

/**
 * Find or create the coupon + promotion code for an affiliate code.
 * Throws the Stripe error on failure; callers decide how to report it.
 */
export async function ensureAffiliateStripeCode(opts: {
  code: string;
  discountPercent: number;
}): Promise<AffiliateStripeIds> {
  const code = opts.code.trim().toUpperCase();
  const discountPercent = Math.max(1, Math.min(100, Math.round(opts.discountPercent)));

  // Reuse an existing promotion code with this text (codes are unique per
  // account, so creating a second one would fail anyway).
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  const found = existing.data[0];
  if (found) {
    const promo = (found as unknown as { promotion?: { coupon?: string | { id: string } | null }; coupon?: string | { id: string } | null });
    const rawCoupon = promo.promotion?.coupon ?? promo.coupon ?? null;
    const couponId = typeof rawCoupon === 'string' ? rawCoupon : rawCoupon?.id ?? '';
    return { couponId, promotionCodeId: found.id, reused: true };
  }

  const coupon = await stripe.coupons.create({
    percent_off: discountPercent,
    duration: 'once',
    name: affiliateCouponName(code, discountPercent),
    metadata: { affiliate_code: code },
  });

  const promotionCode = await stripe.promotionCodes.create({
    promotion: { coupon: coupon.id, type: 'coupon' },
    code,
    restrictions: { first_time_transaction: true },
    metadata: { affiliate_code: code },
  });

  return { couponId: coupon.id, promotionCodeId: promotionCode.id, reused: false };
}

export function describeStripeError(err: unknown): string {
  const e = err as { message?: string; code?: string; param?: string } | null;
  if (!e) return 'Unknown Stripe error';
  return [e.message, e.code ? `(${e.code})` : null, e.param ? `[${e.param}]` : null].filter(Boolean).join(' ');
}
