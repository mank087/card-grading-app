'use client';

/**
 * The business-policy controls, shared by the single-card listing modal and
 * the bulk batch settings panel.
 *
 * When a seller has opted into eBay business policies, both surfaces replace
 * their inline shipping/returns forms with the same three dropdowns and the
 * same "Create new…" form, so the two paths can never offer a different set of
 * choices — which is exactly how the inline forms drifted apart before.
 *
 * Everything here is presentational plus one fetch hook. The rules about
 * which listing may carry which policy live server-side in
 * publishCardListing; this module only helps the seller pick.
 */

import { useCallback, useEffect, useState } from 'react';
import { DOMESTIC_SHIPPING_SERVICES, DEFAULT_DOMESTIC_SHIPPING_SERVICE } from '@/lib/ebay/tradingApi';

export interface PolicyOption {
  id: string;
  name: string;
  summary: string;
}

export interface PolicyLists {
  shipping: PolicyOption[];
  returns: PolicyOption[];
  payment: PolicyOption[];
}

const EMPTY_LISTS: PolicyLists = { shipping: [], returns: [], payment: [] };

/**
 * The seller's policies off GET /api/ebay/policies.
 *
 * `enabled` keeps a seller who never opted in from spending an eBay call on
 * every modal open. `reload` is exposed so a freshly created policy can be
 * folded in without a second round trip on the happy path — the create
 * response carries the new policy, and this refetch is the fallback.
 */
export function usePolicyLists(token: string | null, enabled: boolean) {
  const [lists, setLists] = useState<PolicyLists>(EMPTY_LISTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ebay/policies', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message || json?.error || 'Could not load your eBay policies.');
        return;
      }
      setLists({
        shipping: json.shipping ?? [],
        returns: json.returns ?? [],
        payment: json.payment ?? [],
      });
    } catch {
      setError('Could not reach eBay to load your policies.');
    } finally {
      setLoading(false);
    }
  }, [token, enabled]);

  useEffect(() => { void reload(); }, [reload]);

  /** Fold a just-created policy into the list without a refetch. */
  const addPolicy = useCallback((kind: 'shipping' | 'returns', policy: PolicyOption) => {
    setLists(prev => ({ ...prev, [kind]: [policy, ...prev[kind]] }));
  }, []);

  return { lists, loading, error, reload, addPolicy };
}

/* ------------------------------------------------------------------ */
/* Dropdown                                                            */
/* ------------------------------------------------------------------ */

interface SelectProps {
  id: string;
  label: string;
  options: PolicyOption[];
  value: string | null;
  onChange: (id: string | null, name: string | null) => void;
  /** Shipping and returns can be created inline; payment cannot. */
  onCreate?: () => void;
  disabled?: boolean;
  selectClass: string;
  labelClass: string;
}

export function PolicySelect({
  id,
  label,
  options,
  value,
  onChange,
  onCreate,
  disabled,
  selectClass,
  labelClass,
}: SelectProps) {
  const CREATE = '__create__';
  const selected = options.find(o => o.id === value) ?? null;

  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={e => {
          if (e.target.value === CREATE) {
            onCreate?.();
            return;
          }
          const next = options.find(o => o.id === e.target.value) ?? null;
          onChange(next?.id ?? null, next?.name ?? null);
        }}
        className={selectClass}
      >
        <option value="">Choose a policy…</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
        {onCreate && <option value={CREATE}>Create new…</option>}
      </select>
      {selected?.summary && (
        <p className="mt-1 text-xs text-gray-500">{selected.summary}</p>
      )}
      {!selected && options.length === 0 && (
        <p className="mt-1 text-xs text-amber-700">
          No {label.toLowerCase()} found on your eBay account
          {onCreate ? ' — create one below.' : '. Add one in eBay Seller Hub, then reload.'}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Minimal create form                                                 */
/* ------------------------------------------------------------------ */

interface CreateFormProps {
  kind: 'shipping' | 'returns';
  token: string | null;
  onCreated: (policy: PolicyOption) => void;
  onCancel: () => void;
  inputClass: string;
  labelClass: string;
}

/**
 * The smallest form that produces a usable policy: eBay's own policy editor
 * has two dozen fields, and a seller who wants those uses eBay. This exists so
 * a seller who has just opted in is not sent away mid-listing.
 *
 * There is no window.confirm/alert anywhere in this flow — errors and the
 * account-wide warning both render inline.
 */
export function CreatePolicyForm({
  kind,
  token,
  onCreated,
  onCancel,
  inputClass,
  labelClass,
}: CreateFormProps) {
  const [name, setName] = useState(kind === 'shipping' ? 'DCM Shipping' : 'DCM Returns');
  const [service, setService] = useState(DEFAULT_DOMESTIC_SHIPPING_SERVICE);
  const [freeShipping, setFreeShipping] = useState(true);
  const [cost, setCost] = useState(5);
  const [handlingDays, setHandlingDays] = useState(1);
  const [returnsAccepted, setReturnsAccepted] = useState(true);
  const [days, setDays] = useState(30);
  const [paidBy, setPaidBy] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const body =
        kind === 'shipping'
          ? { kind, name, service, cost, handlingDays, freeShipping }
          : { kind, name, returnsAccepted, days, paidBy };
      const res = await fetch('/api/ebay/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message || json?.error || 'eBay would not create that policy.');
        return;
      }
      onCreated(json.policy as PolicyOption);
    } catch {
      setError('Could not reach eBay to create the policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg border border-indigo-200 bg-indigo-50/60 space-y-3">
      <p className="text-xs font-semibold text-indigo-900">
        New {kind === 'shipping' ? 'shipping' : 'return'} policy
      </p>

      <div>
        <label className={labelClass} htmlFor={`policy-name-${kind}`}>Policy name</label>
        <input
          id={`policy-name-${kind}`}
          type="text"
          value={name}
          maxLength={64}
          onChange={e => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      {kind === 'shipping' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="policy-service">Carrier service</label>
            <select
              id="policy-service"
              value={service}
              onChange={e => setService(e.target.value)}
              className={inputClass}
            >
              {DOMESTIC_SHIPPING_SERVICES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="policy-cost">Buyer pays ($)</label>
            <input
              id="policy-cost"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              disabled={freeShipping}
              onChange={e => setCost(Number(e.target.value) || 0)}
              className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="policy-handling">Handling (days)</label>
            <input
              id="policy-handling"
              type="number"
              min={0}
              max={30}
              value={handlingDays}
              onChange={e => setHandlingDays(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <label className="sm:col-span-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={freeShipping}
              onChange={e => setFreeShipping(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Free shipping (you cover the cost)
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={returnsAccepted}
              onChange={e => setReturnsAccepted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Accept returns
          </label>
          {returnsAccepted && (
            <>
              <div>
                <label className={labelClass} htmlFor="policy-days">Return window</label>
                <select
                  id="policy-days"
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className={inputClass}
                >
                  {[14, 30, 60].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="policy-paidby">Return shipping paid by</label>
                <select
                  id="policy-paidby"
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value as 'BUYER' | 'SELLER')}
                  className={inputClass}
                >
                  <option value="BUYER">Buyer</option>
                  <option value="SELLER">Seller</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !token}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create on eBay'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
