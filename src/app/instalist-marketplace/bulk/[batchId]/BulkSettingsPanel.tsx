'use client';

/**
 * Batch settings — the "across the board" panel.
 *
 * These are the same fields the single-card modal's shipping step collects
 * (same key names, same validators server-side), applied once to every row in
 * the batch instead of once per card. Phase 3 replaces the inline block with
 * business-policy dropdowns; `settings.policies` already has the slots.
 *
 * The panel is deliberately NOT the modal's JSX reused: that form is welded
 * into a 3,000-line stepper with its own state and its own submit path, and
 * lifting it out would change the single-card flow, which this phase must not
 * touch. What is shared is the shape and the server-side validation.
 */

import { useState } from 'react';
import {
  DOMESTIC_SHIPPING_SERVICES,
  INTERNATIONAL_SHIPPING_SERVICES,
} from '@/lib/ebay/tradingApi';
import type { BulkBatchSettings, BulkPriceRule } from '@/lib/ebay/bulkSettings';
import {
  usePolicyLists,
  PolicySelect,
  CreatePolicyForm,
  type PolicyOption,
} from '@/components/ebay/PolicyPickers';

interface Props {
  settings: BulkBatchSettings;
  /** Bearer token — the policy dropdowns read the seller's eBay account. */
  token: string | null;
  onChange: (settings: BulkBatchSettings) => void;
  onApply: () => void;
  onSaveDefaults: () => void;
  dirty: boolean;
  applying: boolean;
  savingDefaults: boolean;
  savedFlash: string | null;
  itemCount: number;
  /** eBay listing allowance, when the account reports one. */
  allowance: number | null;
}

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1';

export default function BulkSettingsPanel({
  settings,
  token,
  onChange,
  onApply,
  onSaveDefaults,
  dirty,
  applying,
  savingDefaults,
  savedFlash,
  itemCount,
  allowance,
}: Props) {
  const [open, setOpen] = useState(true);
  const ship = settings.shipping;
  const usePolicies = settings.policies.useBusinessPolicies;
  const [creatingPolicy, setCreatingPolicy] = useState<null | 'shipping' | 'returns'>(null);
  const {
    lists: policyLists,
    loading: policiesLoading,
    error: policiesError,
    addPolicy,
  } = usePolicyLists(token, usePolicies);

  const setShip = (patch: Partial<BulkBatchSettings['shipping']>) =>
    onChange({ ...settings, shipping: { ...ship, ...patch } });
  const setRule = (rule: BulkPriceRule) => onChange({ ...settings, priceRule: rule });
  const setPolicies = (patch: Partial<BulkBatchSettings['policies']>) =>
    onChange({ ...settings, policies: { ...settings.policies, ...patch } });

  // A fixed price of 0 is accepted by the server and re-seeds every un-edited
  // row to "no price", which makes the whole batch unpublishable — refuse to
  // apply it rather than let the seller find out row by row.
  const priceError =
    settings.priceRule.mode === 'fixed' && !(settings.priceRule.amount > 0)
      ? 'Enter a price above 0.'
      : settings.priceRule.mode === 'estimate_pct' &&
          !(settings.priceRule.percent >= 1 && settings.priceRule.percent <= 1000)
        ? 'Percent must be between 1 and 1000.'
        : null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">Batch settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {itemCount} card{itemCount === 1 ? '' : 's'} selected
            {allowance !== null && (
              <> &middot; eBay allows {allowance} more listing{allowance === 1 ? '' : 's'}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 flex-shrink-0"
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      </header>

      {open && (
        <div className="p-4 space-y-5">
          {/* ------------------------------------------------ price rule -- */}
          <div>
            <p className={labelClass}>Asking price</p>
            <div className="flex flex-wrap gap-2">
              {([
                { mode: 'estimate', label: 'DCM estimate' },
                { mode: 'estimate_pct', label: 'Estimate × %' },
                { mode: 'fixed', label: 'Fixed price' },
                { mode: 'blank', label: 'Blank (per row)' },
              ] as const).map(option => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() =>
                    setRule(
                      option.mode === 'estimate_pct'
                        ? { mode: 'estimate_pct', percent: 100 }
                        : option.mode === 'fixed'
                          ? { mode: 'fixed', amount: 0 }
                          : { mode: option.mode }
                    )
                  }
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                    settings.priceRule.mode === option.mode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {settings.priceRule.mode === 'estimate_pct' && (
              <div className="mt-2 max-w-[10rem]">
                <label className={labelClass} htmlFor="bulk-price-pct">Percent of estimate</label>
                <input
                  id="bulk-price-pct"
                  type="number"
                  min={1}
                  max={1000}
                  value={settings.priceRule.percent}
                  onChange={e =>
                    setRule({ mode: 'estimate_pct', percent: Number(e.target.value) || 100 })
                  }
                  className={inputClass}
                />
              </div>
            )}
            {settings.priceRule.mode === 'fixed' && (
              <div className="mt-2 max-w-[10rem]">
                <label className={labelClass} htmlFor="bulk-price-fixed">Price ($)</label>
                <input
                  id="bulk-price-fixed"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.priceRule.amount}
                  onChange={e => setRule({ mode: 'fixed', amount: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
            )}
            {priceError && (
              <p className="mt-1.5 text-xs text-red-600" role="alert">{priceError}</p>
            )}
            <p className="mt-1.5 text-xs text-gray-500">
              Rows where you typed your own price keep it.
            </p>
          </div>

          {/* -------------------------------------------------- policies -- */}
          {/* When the account uses eBay business policies, the three
              dropdowns REPLACE the shipping, international and returns
              blocks below — eBay refuses a listing that carries both. The
              parcel fields stay: they are properties of the package, not
              shipping terms, and a calculated policy needs them. */}
          {usePolicies && (
            <div className="space-y-3">
              <div>
                <p className={labelClass}>eBay business policies</p>
                <p className="text-xs text-gray-500 -mt-0.5 mb-2">
                  Applied to every card in this batch. Your account defaults are pre-selected.
                </p>
              </div>
              {policiesLoading && <p className="text-xs text-gray-500">Loading your eBay policies…</p>}
              {policiesError && <p className="text-xs text-red-700">{policiesError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PolicySelect
                  id="bulk-shipping-policy"
                  label="Shipping policy"
                  options={policyLists.shipping}
                  value={settings.policies.shippingPolicyId}
                  onChange={(id, name) => setPolicies({ shippingPolicyId: id, shippingPolicyName: name })}
                  onCreate={() => setCreatingPolicy('shipping')}
                  selectClass={inputClass}
                  labelClass={labelClass}
                />
                <PolicySelect
                  id="bulk-return-policy"
                  label="Return policy"
                  options={policyLists.returns}
                  value={settings.policies.returnPolicyId}
                  onChange={(id, name) => setPolicies({ returnPolicyId: id, returnPolicyName: name })}
                  onCreate={() => setCreatingPolicy('returns')}
                  selectClass={inputClass}
                  labelClass={labelClass}
                />
                <PolicySelect
                  id="bulk-payment-policy"
                  label="Payment policy"
                  options={policyLists.payment}
                  value={settings.policies.paymentPolicyId}
                  onChange={id => setPolicies({ paymentPolicyId: id })}
                  selectClass={inputClass}
                  labelClass={labelClass}
                />
              </div>
              {creatingPolicy && (
                <CreatePolicyForm
                  kind={creatingPolicy}
                  token={token}
                  onCreated={(policy: PolicyOption) => {
                    addPolicy(creatingPolicy, policy);
                    setPolicies(
                      creatingPolicy === 'shipping'
                        ? { shippingPolicyId: policy.id, shippingPolicyName: policy.name }
                        : { returnPolicyId: policy.id, returnPolicyName: policy.name }
                    );
                    setCreatingPolicy(null);
                  }}
                  onCancel={() => setCreatingPolicy(null)}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
              )}
              <div>
                <label className={labelClass} htmlFor="bulk-policy-zip">Ships from ZIP</label>
                <input
                  id="bulk-policy-zip"
                  type="text"
                  inputMode="numeric"
                  value={ship.postalCode}
                  onChange={e => setShip({ postalCode: e.target.value })}
                  placeholder="Required"
                  className={`${inputClass} max-w-[10rem]`}
                />
              </div>
            </div>
          )}

          {/* -------------------------------------------------- shipping -- */}
          {!usePolicies && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelClass} htmlFor="bulk-ship-type">Shipping</label>
              <select
                id="bulk-ship-type"
                value={ship.shippingType}
                onChange={e => setShip({ shippingType: e.target.value as typeof ship.shippingType })}
                className={inputClass}
              >
                <option value="CALCULATED">Calculated at checkout</option>
                <option value="FLAT_RATE">Flat rate</option>
                <option value="FREE">Free shipping</option>
              </select>
            </div>
            {ship.shippingType === 'FLAT_RATE' && (
              <div>
                <label className={labelClass} htmlFor="bulk-ship-flat">Flat rate ($)</label>
                <input
                  id="bulk-ship-flat"
                  type="number"
                  min={0}
                  step="0.01"
                  value={ship.flatRateAmount}
                  onChange={e => setShip({ flatRateAmount: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="bulk-ship-service">Carrier service</label>
              <select
                id="bulk-ship-service"
                value={ship.domesticShippingService}
                onChange={e => setShip({ domesticShippingService: e.target.value })}
                className={inputClass}
              >
                {DOMESTIC_SHIPPING_SERVICES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bulk-ship-handling">Handling (days)</label>
              <input
                id="bulk-ship-handling"
                type="number"
                min={0}
                max={30}
                value={ship.handlingDays}
                onChange={e => setShip({ handlingDays: Number(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bulk-ship-zip">Ships from ZIP</label>
              <input
                id="bulk-ship-zip"
                type="text"
                inputMode="numeric"
                value={ship.postalCode}
                onChange={e => setShip({ postalCode: e.target.value })}
                placeholder="Required"
                className={inputClass}
              />
            </div>
          </div>
          )}

          {/* ------------------------------------------------- package ---- */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['packageWeightOz', 'Weight (oz)'],
              ['packageLengthIn', 'Length (in)'],
              ['packageWidthIn', 'Width (in)'],
              ['packageDepthIn', 'Depth (in)'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass} htmlFor={`bulk-${key}`}>{label}</label>
                <input
                  id={`bulk-${key}`}
                  type="number"
                  min={0}
                  value={ship[key]}
                  onChange={e => setShip({ [key]: Number(e.target.value) || 0 } as any)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          {/* --------------------------------------------- international -- */}
          {!usePolicies && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ship.offerInternational}
                onChange={e => setShip({ offerInternational: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Offer international shipping
            </label>
            {ship.offerInternational && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6">
                <div>
                  <label className={labelClass} htmlFor="bulk-intl-type">International rate</label>
                  <select
                    id="bulk-intl-type"
                    value={ship.internationalShippingType}
                    onChange={e =>
                      setShip({ internationalShippingType: e.target.value as 'FLAT_RATE' | 'CALCULATED' })
                    }
                    className={inputClass}
                  >
                    <option value="CALCULATED">Calculated</option>
                    <option value="FLAT_RATE">Flat rate</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="bulk-intl-service">International service</label>
                  <select
                    id="bulk-intl-service"
                    value={ship.internationalShippingService}
                    onChange={e => setShip({ internationalShippingService: e.target.value })}
                    className={inputClass}
                  >
                    {INTERNATIONAL_SHIPPING_SERVICES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {ship.internationalShippingType === 'FLAT_RATE' && (
                  <div>
                    <label className={labelClass} htmlFor="bulk-intl-cost">International cost ($)</label>
                    <input
                      id="bulk-intl-cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={ship.internationalFlatRateCost}
                      onChange={e => setShip({ internationalFlatRateCost: Number(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* ------------------------------------------------- returns ---- */}
          {!usePolicies && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ship.domesticReturnsAccepted}
                onChange={e => setShip({ domesticReturnsAccepted: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Accept returns
            </label>
            {ship.domesticReturnsAccepted && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                <div>
                  <label className={labelClass} htmlFor="bulk-return-days">Return window (days)</label>
                  <select
                    id="bulk-return-days"
                    value={ship.domesticReturnPeriodDays}
                    onChange={e => setShip({ domesticReturnPeriodDays: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {[14, 30, 60].map(d => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="bulk-return-paid">Return shipping paid by</label>
                  <select
                    id="bulk-return-paid"
                    value={ship.domesticReturnShippingPaidBy}
                    onChange={e =>
                      setShip({ domesticReturnShippingPaidBy: e.target.value as 'BUYER' | 'SELLER' })
                    }
                    className={inputClass}
                  >
                    <option value="BUYER">Buyer</option>
                    <option value="SELLER">Seller</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          )}

          {/* -------------------------------------------------- format ---- */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.bestOfferEnabled}
                onChange={e => onChange({ ...settings, bestOfferEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Accept offers (Best Offer)
            </label>
            <span className="text-xs text-gray-500">
              Format: fixed price, Good &rsquo;Til Cancelled (eBay&rsquo;s only fixed-price duration)
            </span>
          </div>

          {/* -------------------------------------------------- actions --- */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onApply}
              disabled={!dirty || applying || priceError !== null}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply to every row'}
            </button>
            {/* Policy defaults are account state, saved from the InstaList
                settings tab, not from one batch. */}
            {!usePolicies && (
              <button
                type="button"
                onClick={onSaveDefaults}
                disabled={savingDefaults}
                className="mt-3 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                {savingDefaults ? 'Saving…' : 'Save as my shipping defaults'}
              </button>
            )}
            {savedFlash && <span className="mt-3 text-xs text-emerald-700">{savedFlash}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
