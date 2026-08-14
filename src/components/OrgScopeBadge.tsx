'use client'

/**
 * "Grading as {store}" pill — shown next to grade CTAs so the payer is
 * visible at the moment of commitment. Renders nothing outside org context.
 * The server enforces the same rule via the dcm-org-scope cookie
 * (deductCredit payerScope), so this badge reflects, never decides.
 */

import { useOrgContext } from '@/contexts/OrgContext'

export default function OrgScopeBadge({ className = '' }: { className?: string }) {
  const { isOrgScope, membership } = useOrgContext()
  // Pending/suspended orgs can't draw the pool — showing the pill would claim
  // a payer that won't actually be charged.
  if (!isOrgScope || !membership || membership.status !== 'active') return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${className}`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: membership.brandColor || '#7C3AED' }}
      />
      Grading as {membership.name}
    </span>
  )
}
