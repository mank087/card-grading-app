'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function AffiliateApplicationForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    channel: '',
    channelUrl: '',
    audienceSize: '',
    promotionPlan: '',
    website: '', // honeypot
  })
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setStatus('submitting')

    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        setErrorMessage(data?.error || 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="bg-white rounded-xl border border-[var(--dcm-border)] shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thanks, we will be in touch</h3>
        <p className="text-gray-600 text-sm">
          Your application is in. We review every one and reply within a few business days.
          Check your inbox for a confirmation email.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full border border-[var(--dcm-control-border)] rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--dcm-purple)] focus:border-transparent'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-[var(--dcm-border)] shadow-sm p-6 md:p-8 text-left space-y-4"
    >
      {errorMessage && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="aff-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name or business name
          </label>
          <input
            id="aff-name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={form.name}
            onChange={update('name')}
            placeholder="Your name, channel or business name"
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Your referral code is built from this, for example DCMCARDS15.
          </p>
        </div>
        <div>
          <label htmlFor="aff-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="aff-email"
            type="email"
            required
            maxLength={254}
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Use the email on your DCM Grading account so your credits land there.{' '}
            <a href="/login?mode=signup&redirect=/affiliates" className="underline">No account yet? Create one first.</a>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="aff-channel" className="block text-sm font-medium text-gray-700 mb-1">
            Where do you post?
          </label>
          <select id="aff-channel" value={form.channel} onChange={update('channel')} className={inputClass}>
            <option value="">Select one</option>
            <option value="YouTube">YouTube</option>
            <option value="TikTok">TikTok</option>
            <option value="Instagram">Instagram</option>
            <option value="X / Twitter">X / Twitter</option>
            <option value="Facebook">Facebook</option>
            <option value="Twitch">Twitch</option>
            <option value="Podcast">Podcast</option>
            <option value="Newsletter">Newsletter</option>
            <option value="Card shop or show">Card shop or show</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="aff-channel-url" className="block text-sm font-medium text-gray-700 mb-1">
            Link to your channel
          </label>
          <input
            id="aff-channel-url"
            type="url"
            maxLength={500}
            value={form.channelUrl}
            onChange={update('channelUrl')}
            placeholder="https://youtube.com/@yourchannel"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="aff-audience" className="block text-sm font-medium text-gray-700 mb-1">
          Audience size
        </label>
        <select id="aff-audience" value={form.audienceSize} onChange={update('audienceSize')} className={inputClass}>
          <option value="">Select one</option>
          <option value="Under 1,000">Under 1,000</option>
          <option value="1,000 to 10,000">1,000 to 10,000</option>
          <option value="10,000 to 50,000">10,000 to 50,000</option>
          <option value="50,000 to 250,000">50,000 to 250,000</option>
          <option value="250,000+">250,000+</option>
        </select>
      </div>

      <div>
        <label htmlFor="aff-plan" className="block text-sm font-medium text-gray-700 mb-1">
          How would you share DCM Grading?
        </label>
        <textarea
          id="aff-plan"
          rows={4}
          maxLength={2000}
          value={form.promotionPlan}
          onChange={update('promotionPlan')}
          placeholder="Tell us a bit about your audience and how you would work DCM Grading into your content."
          className={inputClass}
        />
        <p className="text-xs text-gray-600 mt-1">{form.promotionPlan.length} / 2000</p>
      </div>

      {/* Honeypot: hidden from real users */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="aff-website">Website</label>
        <input
          id="aff-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={update('website')}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="dcm-button dcm-button--primary w-full disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending...' : 'Apply to Become a Partner'}
      </button>
      <p className="text-xs text-gray-600 text-center"><a href="#program-terms" className="underline underline-offset-2">Review the program terms</a></p>
      <p className="text-xs text-gray-600 text-center">
        We review every application and reply within a few business days.
      </p>
    </form>
  )
}
