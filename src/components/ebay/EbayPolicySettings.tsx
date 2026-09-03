'use client';

/**
 * InstaList settings → eBay business policies.
 *
 * The seller-facing half of Phase 3. Off by default, and turning it on is a
 * two-step: the toggle opens an inline confirmation that says plainly what
 * eBay is about to change on their account, and only a click on the confirm
 * button calls /api/ebay/opt-in. Nothing here uses window.confirm — a browser
 * dialog cannot carry that explanation, and on mobile web it is a system
 * sheet the seller has no reason to trust.
 *
 * Once on, the three dropdowns are the ACCOUNT defaults: the listing modal and
 * every new bulk batch start from them, and either can be overridden for one
 * listing or one batch without changing what is saved here.
 */

import { useCallback, useEffect, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import {
  usePolicyLists,
  PolicySelect,
  CreatePolicyForm,
  type PolicyOption,
} from '@/components/ebay/PolicyPickers';

interface DefaultsRow {
  useBusinessPolicies?: boolean;
  defaultShippingPolicyId?: string | null;
  defaultReturnPolicyId?: string | null;
  defaultPaymentPolicyId?: string | null;
}

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1';

export default function EbayPolicySettings() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | 'shipping' | 'returns'>(null);

  const { lists, loading: listsLoading, error: listsError, addPolicy } = usePolicyLists(token, enabled);

  useEffect(() => {
    const session = getStoredSession();
    setToken(session?.access_token ?? null);
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/ebay/listing-defaults', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          // Always the personal row: the eBay connection is per user, so the
          // policies that exist are this user's. The org scope never carries
          // these fields — the PUT refuses to write them there.
          const row: DefaultsRow = json?.personal ?? {};
          setEnabled(row.useBusinessPolicies === true);
          setShippingId(row.defaultShippingPolicyId ?? null);
          setReturnId(row.defaultReturnPolicyId ?? null);
          setPaymentId(row.defaultPaymentPolicyId ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(
    async (payload: Record<string, unknown>, message: string) => {
      if (!token) return false;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/ebay/listing-defaults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ scope: 'personal', ...payload }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          setError(json?.error || 'Could not save that. Please try again.');
          return false;
        }
        setFlash(message);
        setTimeout(() => setFlash(null), 2500);
        return true;
      } catch {
        setError('Could not save that. Please try again.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token]
  );

  /** The confirm button: opt in on eBay FIRST, then record the choice. */
  const turnOn = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ebay/opt-in', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || 'eBay would not switch business policies on for this account.');
        return;
      }
      // Only now is the flag ours to set: a flag without the eBay program
      // behind it produces listings eBay rejects.
      const saved = await save({ useBusinessPolicies: true }, 'Business policies are on');
      if (saved) {
        setEnabled(true);
        setConfirming(false);
      }
    } catch {
      setError('Could not reach eBay. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    // No eBay call: the SELLING_POLICY_MANAGEMENT program has no opt-out, and
    // leaving it on costs the seller nothing. This flag only decides what DCM
    // sends on new listings.
    const saved = await save({ useBusinessPolicies: false }, 'Back to per-listing shipping');
    if (saved) {
      setEnabled(false);
      setConfirming(false);
      setCreating(null);
    }
  };

  const selectPolicy = (
    kind: 'shipping' | 'returns' | 'payment',
    id: string | null
  ) => {
    if (kind === 'shipping') setShippingId(id);
    if (kind === 'returns') setReturnId(id);
    if (kind === 'payment') setPaymentId(id);
    const field =
      kind === 'shipping' ? 'defaultShippingPolicyId'
      : kind === 'returns' ? 'defaultReturnPolicyId'
      : 'defaultPaymentPolicyId';
    void save({ [field]: id }, 'Default saved');
  };

  const onCreated = (kind: 'shipping' | 'returns') => (policy: PolicyOption) => {
    addPolicy(kind, policy);
    setCreating(null);
    selectPolicy(kind, policy.id);
  };

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500">Loading listing settings…</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <header className="p-4 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-900">eBay business policies</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Use saved shipping, return and payment policies from your eBay account instead of
          filling the shipping form in on every listing.
        </p>
      </header>

      <div className="p-4 space-y-4">
        <label className="flex items-start gap-3 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy || !token}
            onChange={e => {
              setError(null);
              if (e.target.checked) setConfirming(true);
              else void turnOff();
            }}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            <span className="font-semibold">Use my eBay business policies</span>
            <span className="block text-xs text-gray-500">
              Off by default. Your existing listings are never changed either way.
            </span>
          </span>
        </label>

        {/* Inline confirmation. Deliberately not window.confirm: the whole
            point is the explanation, which a browser dialog cannot carry. */}
        {confirming && !enabled && (
          <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-3">
            <p className="text-sm font-semibold text-amber-900">
              This changes a setting on your eBay account
            </p>
            <ul className="text-xs text-amber-900 space-y-1 list-disc pl-4">
              <li>
                eBay switches your account into business policies. It applies account-wide, to
                every listing you make anywhere — not only the ones you create here.
              </li>
              <li>
                Listings you already have are <strong>not</strong> changed. They keep the
                shipping and return terms they were published with.
              </li>
              <li>
                New DCM listings will reference the policies you choose below instead of the
                shipping form.
              </li>
              <li>
                You can switch DCM back to per-listing shipping at any time by unticking this
                box. eBay has no way to leave the program once joined.
              </li>
            </ul>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? 'Switching on…' : 'Turn on business policies'}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={busy}
                className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {enabled && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Your defaults. Every new listing and every new batch starts from these; you can
              still pick a different policy for one listing without changing them.
            </p>

            {listsLoading && <p className="text-xs text-gray-500">Loading your eBay policies…</p>}
            {listsError && <p className="text-xs text-red-700">{listsError}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <PolicySelect
                id="default-shipping-policy"
                label="Shipping policy"
                options={lists.shipping}
                value={shippingId}
                onChange={id => selectPolicy('shipping', id)}
                onCreate={() => setCreating('shipping')}
                disabled={busy}
                selectClass={inputClass}
                labelClass={labelClass}
              />
              <PolicySelect
                id="default-return-policy"
                label="Return policy"
                options={lists.returns}
                value={returnId}
                onChange={id => selectPolicy('returns', id)}
                onCreate={() => setCreating('returns')}
                disabled={busy}
                selectClass={inputClass}
                labelClass={labelClass}
              />
              <PolicySelect
                id="default-payment-policy"
                label="Payment policy"
                options={lists.payment}
                value={paymentId}
                onChange={id => selectPolicy('payment', id)}
                disabled={busy}
                selectClass={inputClass}
                labelClass={labelClass}
              />
            </div>

            {creating && (
              <CreatePolicyForm
                kind={creating}
                token={token}
                onCreated={onCreated(creating)}
                onCancel={() => setCreating(null)}
                inputClass={inputClass}
                labelClass={labelClass}
              />
            )}

            <p className="text-xs text-gray-500">
              Payment policies are managed on eBay — under managed payments there is nothing to
              configure here, so pick the one your account already uses.
            </p>
          </div>
        )}

        {error && !confirming && <p className="text-xs text-red-700">{error}</p>}
        {flash && <p className="text-xs text-emerald-700">{flash}</p>}
      </div>
    </section>
  );
}
