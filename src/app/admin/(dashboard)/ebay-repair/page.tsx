'use client';

import { useState } from 'react';
import type { RepairReport } from '@/lib/ebay/repairListingDescriptions';

export default function EbayRepairPage() {
  const [email, setEmail] = useState('');
  const [clearTemplate, setClearTemplate] = useState(true);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');

  const run = async (apply: boolean) => {
    setBusy(apply ? 'apply' : 'preview');
    setError('');
    try {
      const res = await fetch('/api/admin/ebay/listing-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, apply, clearTemplate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(null);
    }
  };
  const applied = Boolean(report?.wrong.some(r => r.result));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">eBay Listing Repair</h1>
        <p className="mt-1 text-sm text-gray-600">
          Finds a seller&apos;s live listings whose description names another card&apos;s serial (a finished
          description saved as their template), rebuilds each from its own card, and revises the description on
          eBay. Preview first; Apply changes live listings.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <label className="block text-sm">
          Seller account email
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seller@example.com"
            className="mt-1 block w-full max-w-md rounded border p-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={clearTemplate} onChange={e => setClearTemplate(e.target.checked)} />
          Also clear the seller&apos;s saved description template on Apply
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => run(false)}
            disabled={!email || busy !== null}
            className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50"
          >
            {busy === 'preview' ? 'Checking…' : 'Preview'}
          </button>
          <button
            onClick={() => {
              if (confirm(`Revise ${report?.wrong.length ?? 0} live eBay listing(s) for ${email}?`)) run(true);
            }}
            disabled={!report || report.wrong.length === 0 || busy !== null || applied}
            className="rounded-lg bg-purple-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy === 'apply' ? 'Revising on eBay…' : 'Apply'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {report && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            {report.activeListings} active listing(s); {report.wrong.length} describe another card.
            {report.templateHadNoMergeFields && !report.templateCleared
              ? ' The saved template has no merge fields and will keep doing this until cleared.'
              : ''}
            {report.templateCleared ? ' Template cleared.' : ''}
          </p>
          {report.wrong.length > 0 && (
            <table className="w-full rounded-xl border bg-white text-sm shadow-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="p-2">Listing</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Describes serial</th>
                  <th className="p-2">Card serial</th>
                  <th className="p-2">Rebuilt opening</th>
                  <th className="p-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {report.wrong.map(r => (
                  <tr key={r.listingId} className="border-t align-top">
                    <td className="p-2 font-mono text-xs">
                      <a className="text-purple-700" href={`https://www.ebay.com/itm/${r.listingId}`} target="_blank" rel="noreferrer">
                        {r.listingId}
                      </a>
                    </td>
                    <td className="p-2">{r.title}</td>
                    <td className="p-2 font-mono">{r.describedSerial}</td>
                    <td className="p-2 font-mono">{r.cardSerial}</td>
                    <td className="p-2 text-xs text-gray-700">{r.newHeadline}</td>
                    <td className="p-2">
                      {r.result === 'revised' ? (
                        <span className="text-green-700">Revised</span>
                      ) : r.result === 'failed' ? (
                        <span className="text-red-700">Failed: {r.error}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
