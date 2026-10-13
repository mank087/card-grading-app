import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
  invoiceRetrieve: vi.fn(),
  upgrade: vi.fn(),
  userCredits: {} as Record<string, unknown>,
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { retrieve: m.retrieve, update: m.update },
    invoices: { retrieve: m.invoiceRetrieve },
  },
  CARD_LOVERS_SUBSCRIPTION: { monthly: { priceId: 'price_month' }, annual: { priceId: 'price_year' } },
  getSubscriptionPeriodEnd: () => new Date('2027-10-08T00:00:00Z'),
}));

vi.mock('@/lib/credits', () => ({ upgradeCardLoverToAnnual: m.upgrade }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: m.userCredits, error: null }) }) }),
    }),
  }),
}));

import { POST } from './route';

const request = () => new Request('https://dcmgrading.com/api/stripe/upgrade-subscription', {
  method: 'POST',
  headers: { authorization: 'Bearer token' },
}) as any;

const monthlySub = { id: 'sub_1', items: { data: [{ id: 'si_1', price: { id: 'price_month' } }] } };

beforeEach(() => {
  vi.clearAllMocks();
  m.userCredits = { card_lover_subscription_id: 'sub_1', card_lover_plan: 'monthly', is_card_lover: true, card_lover_months_active: 1 };
  m.retrieve.mockResolvedValue(monthlySub);
  m.upgrade.mockResolvedValue({ success: true, creditsAdded: 830 });
});

describe('POST /api/stripe/upgrade-subscription', () => {
  it('charges the prorated difference now and grants credits only for a paid invoice', async () => {
    m.update.mockResolvedValue({ ...monthlySub, latest_invoice: { id: 'in_1', status: 'paid' } });
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
      items: [{ id: 'si_1', price: 'price_year' }],
    }));
    expect(m.upgrade).toHaveBeenCalledWith('user-1', expect.objectContaining({ stripeInvoiceId: 'in_1', creditsAlreadyGivenThisCycle: 70 }));
    expect((await res.json()).creditsAdded).toBe(830);
  });

  it('grants nothing when the card is declined (Stripe leaves the plan unchanged)', async () => {
    m.update.mockRejectedValue(Object.assign(new Error('Your card was declined.'), { code: 'card_declined' }));
    const res = await POST(request());
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('card_declined');
    expect(m.upgrade).not.toHaveBeenCalled();
  });

  it('grants nothing when the upgrade invoice is not paid', async () => {
    m.update.mockResolvedValue({ ...monthlySub, latest_invoice: { id: 'in_2', status: 'open' } });
    const res = await POST(request());
    expect(res.status).toBe(402);
    expect(m.upgrade).not.toHaveBeenCalled();
  });

  it('a retry after the charge does not charge again', async () => {
    m.retrieve.mockResolvedValue({ ...monthlySub, items: { data: [{ id: 'si_1', price: { id: 'price_year' } }] }, latest_invoice: 'in_1' });
    m.invoiceRetrieve.mockResolvedValue({ id: 'in_1', status: 'paid' });
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.upgrade).toHaveBeenCalledWith('user-1', expect.objectContaining({ stripeInvoiceId: 'in_1' }));
  });

  it('refuses when the account is already annual', async () => {
    m.userCredits = { ...m.userCredits, card_lover_plan: 'annual' };
    const res = await POST(request());
    expect(res.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
});
