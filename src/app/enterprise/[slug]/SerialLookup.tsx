'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Serial lookup scoped to the org's own graded cards. */
export default function SerialLookup({ slug, serialPrefix = 'ORG' }: { slug: string; serialPrefix?: string }) {
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;
    setBusy(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/storefront/lookup?slug=${encodeURIComponent(slug)}&serial=${encodeURIComponent(serial.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        // Relative path: resolves on both the subdomain and /enterprise/{slug}
        router.push(`/enterprise/${slug}/card/${data.id}`);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input
        value={serial}
        onChange={e => { setSerial(e.target.value); setNotFound(false); }}
        placeholder={`Serial number from the label (e.g. ${serialPrefix}442921)`}
        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-center sm:text-left focus:outline-none focus:ring-2"
        style={{ ['--tw-ring-color' as any]: 'var(--brand)' }}
      />
      <button
        type="submit"
        disabled={busy || !serial.trim()}
        className="px-6 py-3 rounded-lg font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {busy ? 'Checking…' : 'Verify'}
      </button>
      {notFound && (
        <p className="text-sm text-red-600 sm:absolute sm:mt-14">No card with that serial was graded here. Double-check the number on the label.</p>
      )}
    </form>
  );
}
