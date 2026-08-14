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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Request received</h3>
        <p className="text-gray-600">
          Thanks. We&apos;ll reach out within one business day to talk through plans and get you set up.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-md p-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store, stream or business name *</label>
          <input required value={storeName} onChange={e => setStoreName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="Store, stream or business name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input value={contactName} onChange={e => setContactName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="First and last name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="you@yourstore.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated grades per month</label>
          <select value={monthlyVolume} onChange={e => setMonthlyVolume(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white">
            <option value="">Select...</option>
            <option value="under-100">Under 100</option>
            <option value="100-300">100 to 300</option>
            <option value="300-1000">300 to 1,000</option>
            <option value="1000-plus">1,000+</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tell us about your brand or business</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="What do you sell, where are you located, and what would grading under your own brand do for your business?" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
        {submitting ? 'Sending...' : 'Request a demo'}
      </button>
    </form>
  )
}
