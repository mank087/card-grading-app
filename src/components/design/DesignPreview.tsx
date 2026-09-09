'use client'

import { useState } from 'react'
import PricingExperience from '@/components/marketing/PricingExperience'
import { ActionButton, ActionLink, Icon, Notice, SectionHeading } from './Primitives'
import { CardShowcase } from './CardShowcase'

export default function DesignPreview() {
  const [state, setState] = useState('guest')
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual')
  const [message, setMessage] = useState('')
  return <div className="dcm-brand">
    <section className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="Local design review" title="DCM component preview.">Preview-only states. Buttons below do not create accounts, purchase credits, or submit cards.</SectionHeading>
      <div className="dcm-three-grid">
        <div className="dcm-step"><h3>Actions</h3><div className="dcm-actions"><ActionButton onClick={() => setMessage('Primary action selected.')}>Primary <Icon name="arrow" /></ActionButton><ActionButton variant="secondary" onClick={() => setMessage('Secondary action selected.')}>Secondary</ActionButton><ActionButton disabled>Unavailable</ActionButton><ActionLink href="/" variant="text">Back to Homepage</ActionLink></div></div>
        <div className="dcm-step"><h3>Inputs</h3><label htmlFor="preview-name">Card name<input className="dcm-preview-field" id="preview-name" placeholder="Your card name" /></label><label htmlFor="preview-category" className="block mt-4">Category<select id="preview-category" className="dcm-preview-field"><option>Sports</option><option>Pokémon</option><option>Magic: The Gathering</option></select></label></div>
        <div className="dcm-step"><h3>Feedback</h3><Notice>Photo review is ready.</Notice><Notice tone="success">Photos uploaded successfully.</Notice><Notice tone="error">This image could not be read. Choose another photo.</Notice></div>
      </div>
      {message && <div className="mt-6"><Notice>{message}</Notice></div>}
      <div className="mt-10 dcm-split"><div><SectionHeading eyebrow="Resilient presentation" title="When a featured report is unavailable.">The fallback links to the public gallery without inventing a grade or attaching another card’s record.</SectionHeading></div><CardShowcase /></div>
    </div></section>
    <section className="dcm-section dcm-surface"><div className="dcm-container"><SectionHeading eyebrow="Pricing preview" title="Account and billing states." /><div className="dcm-actions">{['guest', 'checking', 'first-purchase', 'returning', 'founder', 'card-lover', 'error', 'busy'].map(value => <ActionButton variant={state === value ? 'primary' : 'secondary'} aria-pressed={state === value} key={value} onClick={() => setState(value)}>{value}</ActionButton>)}</div></div></section>
    <PricingExperience authenticated={state === 'checking' ? null : state !== 'guest'} balance={42} balanceLoading={state === 'checking'} firstPurchase={state === 'first-purchase'} founder={state === 'founder'} cardLover={state === 'card-lover'} error={state === 'error' ? 'Checkout could not be opened. Please try again.' : null} purchaseLoading={state === 'busy' ? 'pro' : null} selectedPlan={plan} onPlanChange={setPlan} onPurchase={() => setMessage('Preview only: no checkout was created.')} onVipPurchase={() => setMessage('Preview only: no checkout was created.')} onSubscribe={() => setMessage('Preview only: no subscription was created.')} />
  </div>
}
