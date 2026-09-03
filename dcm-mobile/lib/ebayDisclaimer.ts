/**
 * The InstaList seller terms — the copy behind the gate that blocks publishing
 * until they are accepted.
 *
 * Lifted out of app/pages/ebay-list.tsx unchanged when bulk publishing needed
 * the same gate: two copies of eight legal paragraphs is how the two flows
 * quietly start showing sellers different terms. The single-card wizard and the
 * bulk screen both read this file.
 *
 * Mirrors the web modal (src/components/ebay/EbayListingModal.tsx).
 */

export const DISCLAIMER_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. DCM is Not a Party to Your eBay Transactions',
    body: 'DCM Grading provides this listing tool solely as a convenience feature to help you list your DCM-graded cards on eBay. DCM is not a party to any transaction that occurs on the eBay platform. All sales, purchases, and related activities are conducted exclusively between you and the buyer through eBay.',
  },
  {
    heading: '2. No Liability for eBay Transactions',
    body: 'DCM shall not be held liable for any disputes, claims, damages, losses, or issues arising from your eBay listings or sales, including but not limited to: buyer complaints, return requests, refund disputes, shipping issues, payment problems, listing violations, account suspensions, or any other matters related to your eBay activity.',
  },
  {
    heading: '3. Grading Opinions',
    body: 'DCM grades represent our professional assessment of card condition at the time of grading. Grades are opinions and are not guarantees of value, authenticity, or future market performance. Buyers may have different opinions regarding condition, and you are responsible for handling any disputes that may arise.',
  },
  {
    heading: '4. Your Responsibilities',
    body: 'You are solely responsible for: the accuracy of all listing information (titles, descriptions, prices, shipping terms); compliance with eBay’s terms of service, listing policies, and all applicable laws; handling all buyer communications, shipping, returns, and refunds; any fees, taxes, or costs associated with your eBay sales; and ensuring you have the legal right to sell the items you list.',
  },
  {
    heading: '5. Indemnification',
    body: 'You agree to indemnify, defend, and hold harmless DCM, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys’ fees) arising from or related to your use of this eBay listing feature or any eBay transactions.',
  },
  {
    heading: '6. eBay Account',
    body: 'You are responsible for maintaining your eBay account in good standing. DCM is not responsible for any actions eBay may take against your account, including but not limited to listing removals, selling restrictions, or account suspensions.',
  },
  {
    heading: '7. Service Availability',
    body: 'DCM provides this listing feature "as is" and makes no guarantees regarding its availability, accuracy, or functionality. DCM may modify, suspend, or discontinue this feature at any time without notice.',
  },
  {
    heading: '8. Governing Law',
    body: 'These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration or in the courts of competent jurisdiction.',
  },
]

export const DISCLAIMER_VERSION_LINE = 'Last updated: January 2026 | Version 1.0'

export const DISCLAIMER_INTRO =
  "By using DCM's eBay listing feature, you acknowledge and agree to the following:"

export const DISCLAIMER_CONSENT =
  'I have read and agree to the terms and conditions above. I understand that DCM is not responsible for any transactions that occur on eBay.'
