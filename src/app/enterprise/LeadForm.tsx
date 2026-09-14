'use client'

import { useState } from 'react'

export default function LeadForm() {
  const [storeName, setStoreName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [monthlyVolume, setMonthlyVolume] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/enterprise/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, contactName, email, monthlyVolume, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div role="status" className="bg-white rounded-xl border border-[var(--dcm-border)] p-6 sm:p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Request received</h3>
        <p className="text-gray-600">
          Thanks. We&apos;ll reach out within one business day to talk through plans and get you set up.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-[var(--dcm-border)] p-6 sm:p-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="enterprise-business" className="block text-sm font-medium text-gray-700 mb-1">Store, stream or business name *</label>
          <input id="enterprise-business" autoComplete="organization" required value={storeName} onChange={e => setStoreName(e.target.value)}
            className="w-full border border-[var(--dcm-control-border)] rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-[var(--dcm-purple)]"
            placeholder="Store, stream or business name" />
        </div>
        <div>
          <label htmlFor="enterprise-name" className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input id="enterprise-name" autoComplete="name" value={contactName} onChange={e => setContactName(e.target.value)}
            className="w-full border border-[var(--dcm-control-border)] rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-[var(--dcm-purple)]"
            placeholder="First and last name" />
        </div>
        <div>
          <label htmlFor="enterprise-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input id="enterprise-email" autoComplete="email" required type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-[var(--dcm-control-border)] rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-[var(--dcm-purple)]"
            placeholder="you@yourstore.com" />
        </div>
        <div>
          <label htmlFor="enterprise-volume" className="block text-sm font-medium text-gray-700 mb-1">Estimated grades per month</label>
          <select id="enterprise-volume" value={monthlyVolume} onChange={e => setMonthlyVolume(e.target.value)}
            className="w-full border border-[var(--dcm-control-border)] rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-[var(--dcm-purple)] bg-white">
            <option value="">Select...</option>
            <option value="under-100">Under 100</option>
            <option value="100-300">100 to 300</option>
            <option value="300-1000">300 to 1,000</option>
            <option value="1000-plus">1,000+</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="enterprise-message" className="block text-sm font-medium text-gray-700 mb-1">Tell us about your brand or business</label>
        <textarea id="enterprise-message" value={message} onChange={e => setMessage(e.target.value)} rows={4}
          className="w-full border border-[var(--dcm-control-border)] rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-[var(--dcm-purple)]"
          placeholder="What do you sell, where are you located, and what would grading under your own brand do for your business?" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting}
        className="dcm-button dcm-button--primary w-full disabled:opacity-50">
        {submitting ? 'Sending...' : 'Request a Demo'}
      </button>
    </form>
  )
}
