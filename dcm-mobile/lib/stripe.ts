import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

const WEB_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

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
 * Open Stripe checkout for credit purchase.
 * Creates a checkout session via the API and opens it in the in-app browser.
 * After payment, user returns to the app and credits refresh automatically.
 */
export async function purchaseCredits(tier: string): Promise<{ error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { error: 'Please sign in to purchase credits' }
    }

    // Open the credits page on the web — Stripe checkout happens there
    // This maintains consistency between web and mobile purchases
    await WebBrowser.openBrowserAsync(`${WEB_URL}/credits?tier=${tier}&mobile=true`, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    })

    return {}
  } catch (err: any) {
    return { error: err.message || 'Failed to open checkout' }
  }
}
