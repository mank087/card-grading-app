import { Alert } from 'react-native'
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'
import { supabase } from './supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

export interface CreditTier {
  id: string
  name: string
  credits: number
  price: number
  perCredit: string
  popular?: boolean
}

export const CREDIT_TIERS: CreditTier[] = [
  { id: 'basic', name: 'Basic', credits: 1, price: 2.99, perCredit: '$2.99' },
  { id: 'pro', name: 'Pro', credits: 5, price: 9.99, perCredit: '$2.00', popular: true },
  { id: 'elite', name: 'Elite', credits: 20, price: 19.99, perCredit: '$1.00' },
  { id: 'vip', name: 'VIP', credits: 150, price: 99.00, perCredit: '$0.66' },
]

/**
 * Purchase credits using Stripe PaymentSheet (native in-app payment).
 *
 * Flow:
 * 1. Create PaymentIntent on server (with user's discount applied)
 * 2. Initialize PaymentSheet with the client secret
 * 3. Present PaymentSheet for card input
 * 4. On success, webhook grants credits automatically
 */
export async function purchaseCredits(tier: string): Promise<{
  error?: string
  success?: boolean
  credits?: number
  price?: number
  discountLabel?: string | null
}> {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Please sign in to purchase credits' }
    }

    console.log('[Stripe] Creating payment intent for tier:', tier)

    // Step 1: Create PaymentIntent on server
    const response = await fetch(`${API_BASE}/api/stripe/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tier }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Payment setup failed' }))
      console.error('[Stripe] PaymentIntent creation failed:', errorData)
      return { error: errorData.error || 'Payment setup failed' }
    }

    const data = await response.json()
    console.log('[Stripe] PaymentIntent created:', {
      tier: data.tier,
      credits: data.totalCredits,
      price: data.price,
      discount: data.discountLabel,
    })

    // Step 2: Initialize PaymentSheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: data.clientSecret,
      customerEphemeralKeySecret: data.ephemeralKey,
      customerId: data.customerId,
      merchantDisplayName: 'DCM Grading',
      allowsDelayedPaymentMethods: false,
      style: 'alwaysDark',
    })

    if (initError) {
      console.error('[Stripe] PaymentSheet init error:', initError)
      return { error: initError.message }
    }

    // Step 3: Present PaymentSheet
    const { error: presentError } = await presentPaymentSheet()

    if (presentError) {
      if (presentError.code === 'Canceled') {
        console.log('[Stripe] User cancelled payment')
        return { error: undefined } // Not an error, just cancelled
      }
      console.error('[Stripe] Payment error:', presentError)
      return { error: presentError.message }
    }

    // Step 4: Payment succeeded — webhook will grant credits
    console.log('[Stripe] Payment successful!')

    return {
      success: true,
      credits: data.totalCredits,
      price: data.price,
      discountLabel: data.discountLabel,
    }
  } catch (err: any) {
    console.error('[Stripe] Error:', err)
    return { error: err.message || 'Payment failed' }
  }
}
