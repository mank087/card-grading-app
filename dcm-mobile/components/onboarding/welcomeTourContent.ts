import { Platform } from 'react-native'

/**
 * Welcome tour content — single source of truth for both the
 * WelcomeTourContext (which uses step counts to drive navigation) and
 * the WelcomeTour visual component (which renders title + body for
 * each step).
 *
 * Edit this file to tweak tour copy. No code changes needed elsewhere
 * unless you add or remove steps for a screen.
 */

// iOS App Store Reader-app compliance: don't show specific pricing or
// pitch a non-IAP subscription in onboarding. Android keeps the
// original copy since Stripe checkout is the established flow there.
const IS_IOS = Platform.OS === 'ios'

export type TourScreenId =
  | 'welcome'
  | 'grade'
  | 'collection'
  | 'labels'
  | 'portfolio'
  | 'instalist'
  | 'account'
  | 'complete'

export interface TourStep {
  title: string
  body: string
}

/**
 * The order screens appear in the tour. The context navigates the
 * user through these in sequence; changing this array changes the
 * tour flow.
 */
export const TOUR_SCREEN_ORDER: TourScreenId[] = [
  'welcome',
  'grade',
  'collection',
  'labels',
  'portfolio',
  'instalist',
  'account',
  'complete',
]

/**
 * Which Expo Router route to navigate to when entering each screen.
 * The welcome + complete screens overlay the Grade tab.
 */
export const TOUR_SCREEN_ROUTE: Record<TourScreenId, string> = {
  welcome: '/(tabs)/grade',
  grade: '/(tabs)/grade',
  collection: '/(tabs)/collection',
  labels: '/(tabs)/labels',
  portfolio: '/(tabs)/market-pricing',
  instalist: '/(tabs)/instalist-marketplace',
  account: '/(tabs)/account',
  complete: '/(tabs)/grade',
}

export const TOUR_STEPS: Record<TourScreenId, TourStep[]> = {
  welcome: [
    // The welcome screen is rendered as a special full-screen panel
    // (see WelcomeTour.tsx) — title/body are unused for this one but
    // kept here so step counts stay consistent.
    {
      title: 'Welcome to DCM Grading',
      body: 'Professional card grading in seconds — powered by DCM Optic™',
    },
  ],
  grade: [
    {
      title: 'Welcome to your Grading Station',
      body: 'This is where the magic happens. Snap photos of your card and DCM Optic™ analyzes centering, corners, edges, and surface for a professional grade in under 2 minutes.',
    },
    {
      title: 'Pick your card type first',
      body: 'We support Pokemon, Sports, MTG, Yu-Gi-Oh, Lorcana, One Piece, Star Wars and more. Each category uses a tuned grading model.',
    },
    {
      title: 'Capture or upload',
      body: 'Snap fresh photos with your camera, or pick existing shots from your gallery. Both front and back are required.',
    },
    {
      title: 'Your grading credits',
      body: 'Each grade uses one credit. New users get bonus credits — buy more anytime when you’re ready to grade.',
    },
  ],
  collection: [
    {
      title: 'Your Graded Card Vault',
      body: 'Every card you grade lands here, organized by category. Search, filter, and review your collection at a glance.',
    },
    {
      title: 'List or grid view',
      body: 'Switch between a detailed list or visual grid. The grid is great for showing off your collection.',
    },
    {
      title: 'Find any card fast',
      body: 'Search by name, filter by category, and sort by grade, date, or value.',
    },
    {
      title: 'Tap for the full report',
      body: 'Open any card to see its complete grading report, sub-grades, market value, and label download options.',
    },
  ],
  labels: [
    {
      title: 'Design Your Custom Labels',
      body: 'Make your graded cards stand out. DCM-branded slab labels you can customize and print for your physical holders.',
    },
    {
      title: 'Pick a base style',
      body: 'Start with Modern (dark gradient) or Traditional (classic light), then customize colors or save your own templates.',
    },
    {
      title: 'Match your brand',
      body: 'Adjust gradient colors and add emblems (Founder ★, VIP ◆, Card Lovers ♥). Preview live before printing.',
    },
    {
      title: 'Print on standard sheets',
      body: 'Export PDFs for Avery 6871 (magnetic one-touch) or 8167 (toploader). Batch-print from your Collection too.',
    },
  ],
  portfolio: [
    {
      title: 'Track Your Collection’s Value',
      body: 'See what your collection is worth in real time — pulled from actual eBay sales of similarly-graded cards.',
    },
    {
      title: 'Portfolio at a glance',
      body: 'Total value, top earners, and how your collection trends over time.',
    },
    {
      title: 'Live market data',
      body: 'Each card shows its current value based on recent sales of cards at the same grade.',
    },
    {
      title: 'Unlock full pricing dashboard',
      body: 'Card Lovers members get historical price trends, bulk valuation tools, and the complete market dashboard.',
    },
  ],
  instalist: [
    {
      title: 'Sell on eBay in seconds',
      body: "When you're ready to sell, the InstaList tab publishes your DCM-graded cards to eBay with front and back label images, your mini grading report, and the certification fields all filled in for you.",
    },
    {
      title: 'Connect once, list anywhere',
      body: "Sign in to your eBay seller account a single time. After that, every card you grade is one tap away from being a live listing.",
    },
    {
      title: 'Track every listing',
      body: 'Active, sold, and ended listings all sync here. See revenue at a glance and relist anything that ends without selling.',
    },
  ],
  account: [
    {
      title: 'Your Account Hub',
      body: 'Manage credits, subscriptions, settings, and find help — all from here.',
    },
    {
      title: 'Buy grading credits',
      body: IS_IOS
        ? 'Top up your credit balance from here whenever you run low.'
        : 'Top up anytime with Basic ($2.99/1), Pro ($9.99/5), Elite ($19.99/20), or VIP ($99/150).',
    },
    {
      title: 'Card Lovers benefits',
      body: IS_IOS
        ? 'Premium members get bonus credits, the full market pricing dashboard, and member-only label emblems.'
        : '$49.99/mo for 70 credits + the full market pricing dashboard. Annual saves more.',
    },
    {
      title: 'Settings & support',
      body: 'Edit your profile, find the FAQ, or replay this tour anytime from here.',
    },
  ],
  complete: [
    {
      title: 'You’re all set! 🎉',
      body: 'You know the layout — let’s grade your first card. Each grade builds your verified collection and unlocks DCM’s full toolkit.',
    },
  ],
}

/** Number of steps per screen — derived from TOUR_STEPS. */
export const TOUR_STEP_COUNT: Record<TourScreenId, number> = Object.fromEntries(
  TOUR_SCREEN_ORDER.map(id => [id, TOUR_STEPS[id].length]),
) as Record<TourScreenId, number>
