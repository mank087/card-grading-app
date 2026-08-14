'use client'

/**
 * Enterprise active-context ("workspace") state — the Slack/Notion pattern.
 *
 * One login, two hats: an org member is either acting as themselves
 * ('personal') or as their store ('org'). The choice is GLOBAL — made in the
 * Navigation switcher, consumed by /collection scope, the grading flow
 * (payer + org_id stamp, when the credits work lands), and the account page.
 * Per-page toggles are the anti-pattern this replaces: they let the two hats
 * interleave on one screen and made the payer ambiguous at grade time.
 *
 * Non-members: membership stays null, scope is pinned to 'personal', and no
 * surface renders anything org-related — zero behavior change.
 *
 * Persistence: localStorage remembers the last choice per browser; a cookie
 * (dcm-org-scope) mirrors it so SERVER code can read the active context on
 * any request — the deduct API passes it to deductCredit as payerScope, so
 * the org pool is charged only when the grade was submitted in org context.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getStoredSession, AUTH_STATE_CHANGE_EVENT } from '@/lib/directAuth'

export type OrgScope = 'personal' | 'org'

export interface OrgMembership {
  name: string
  /** Org slug — the public Enterprise Page lives at /enterprise/{slug}. */
  slug: string | null
  role: 'owner' | 'member'
  /** Org lifecycle state — 'pending' orgs can't grade or subscribe yet. */
  status: 'pending' | 'active' | 'suspended' | 'cancelled'
  /** Owner has finished the post-approval Brand Setup walkthrough. */
  setupComplete: boolean
  gradeCredits: number
  brandColor: string | null
  /** Full brand palette ([0] = primary). */
  brandColors: string[]
  /** House label design from Brand Setup — applied to org-graded cards. */
  slab: { labelStyle: 'heritage' | 'modern'; pattern: string; colors: string[]; colorSource: 'brand' | 'card' } | null
  logos: { color: string | null; white: string | null; black: string | null }
}

interface OrgContextType {
  /** null = not an org member (or not loaded yet — see membershipLoaded) */
  membership: OrgMembership | null
  membershipLoaded: boolean
  /** Always 'personal' for non-members. */
  scope: OrgScope
  setScope: (scope: OrgScope) => void
  /** Convenience: scope === 'org' && membership !== null */
  isOrgScope: boolean
  refreshOrg: () => Promise<void>
}

const STORAGE_KEY = 'dcm-active-context'
const COOKIE_NAME = 'dcm-org-scope'

const OrgContext = createContext<OrgContextType | undefined>(undefined)

function writeCookie(scope: OrgScope) {
  try {
    document.cookie = `${COOKIE_NAME}=${scope}; path=/; max-age=31536000; SameSite=Lax`
  } catch { /* SSR/no-document */ }
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [membership, setMembership] = useState<OrgMembership | null>(null)
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  const [scope, setScopeState] = useState<OrgScope>('personal')

  const setScope = useCallback((next: OrgScope) => {
    setScopeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
    writeCookie(next)
  }, [])

  const refreshOrg = useCallback(async () => {
    const session = getStoredSession()
    if (!session?.access_token) {
      setMembership(null)
      setScopeState('personal')
      writeCookie('personal')
      setMembershipLoaded(true)
      return
    }
    try {
      const res = await fetch('/api/org/branding', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = res.ok ? await res.json() : null
      if (data?.membership) {
        setMembership({
          name: data.branding?.name || 'Store',
          slug: data.branding?.slug || null,
          role: data.membership.role === 'owner' ? 'owner' : 'member',
          status: (['pending', 'active', 'suspended', 'cancelled'].includes(data.membership.status)
            ? data.membership.status
            : 'active') as OrgMembership['status'],
          setupComplete: Boolean(data.membership.setupComplete),
          gradeCredits: data.membership.gradeCredits ?? 0,
          brandColor: data.branding?.brandColor ?? null,
          brandColors: Array.isArray(data.membership.brandColors) ? data.membership.brandColors : [],
          slab: data.membership.slab ?? null,
          logos: {
            color: data.branding?.logoUrl ?? null,
            white: data.branding?.logoWhiteUrl ?? null,
            black: data.branding?.logoBlackUrl ?? null,
          },
        })
        // First login after being added to an org defaults to org context —
        // they were added because of the store. A stored choice always wins.
        let stored: string | null = null
        try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* ignore */ }
        const next: OrgScope = stored === 'personal' || stored === 'org' ? stored : 'org'
        setScopeState(next)
        writeCookie(next)

        // First arrival after approval: bring the OWNER to Brand Setup once
        // per session until they finish it. Members and completed setups skip.
        try {
          const isOwner = data.membership.role === 'owner'
          const active = data.membership.status === 'active'
          const setupComplete = Boolean(data.membership.setupComplete)
          const alreadyPrompted = sessionStorage.getItem('dcm-brand-setup-prompted')
          const onSetupPage = window.location.pathname.startsWith('/store/settings')
          if (isOwner && active && !setupComplete && !alreadyPrompted && !onSetupPage) {
            sessionStorage.setItem('dcm-brand-setup-prompted', '1')
            window.location.href = '/store/settings?setup=1'
          }
        } catch { /* SSR/no-window */ }
      } else {
        setMembership(null)
        setScopeState('personal')
        writeCookie('personal')
      }
    } catch {
      /* network error: leave whatever we had */
    } finally {
      setMembershipLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshOrg()
    const handleAuthChange = () => { refreshOrg() }
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange)
    return () => window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange)
  }, [refreshOrg])

  return (
    <OrgContext.Provider
      value={{
        membership,
        membershipLoaded,
        scope: membership ? scope : 'personal',
        setScope,
        isOrgScope: scope === 'org' && membership !== null,
        refreshOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrgContext() {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error('useOrgContext must be used within an OrgProvider')
  }
  return context
}
