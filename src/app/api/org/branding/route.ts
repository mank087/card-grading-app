/**
 * Org branding for client surfaces (labels, reports, detail pages).
 *
 * GET /api/org/branding?cardId=<uuid>  → branding of the org that graded the
 *   card, or { branding: null }. Unauthenticated by design: the same logo and
 *   store name already appear on the card's public page and label.
 * GET /api/org/branding                → branding + pool balance for the
 *   CALLER's org (requires auth); used by account/grading UI.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { getBrandingForCard, getOrgForUser, getOrgBranding } from '@/lib/organizations'
import { isUuid } from '@/lib/uuid'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const cardId = request.nextUrl.searchParams.get('cardId')

  if (cardId) {
    if (!isUuid(cardId)) {
      return NextResponse.json({ error: 'Invalid cardId' }, { status: 400 })
    }
    const branding = await getBrandingForCard(cardId)
    return NextResponse.json({ branding })
  }

  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const membership = await getOrgForUser(authResult.user.id)
  if (!membership) {
    return NextResponse.json({ branding: null, membership: null })
  }

  const branding = await getOrgBranding(membership.org)
  const slab = ((membership.org as any).storefront?.slab || {}) as {
    label_style?: string; pattern?: string; colors?: string[]; color_source?: string
    logo_variant?: string; logo_scale?: number
  }
  const brandColors = membership.org.brand_colors?.length
    ? membership.org.brand_colors
    : membership.org.brand_color
      ? [membership.org.brand_color]
      : []
  return NextResponse.json({
    branding,
    membership: {
      role: membership.role,
      status: membership.org.status,
      gradeCredits: membership.org.grade_credits,
      monthlyAllotment: membership.org.monthly_allotment,
      plan: membership.org.plan,
      /** Owner has completed the post-approval Brand Setup walkthrough. */
      setupComplete: Boolean((membership.org as any).application?.brand_setup_done),
      /** Full brand palette + the org's house label design (Brand Setup). */
      brandColors,
      slab: {
        labelStyle: slab.label_style === 'modern' ? 'modern' : 'heritage',
        pattern: slab.pattern || 'diamond',
        colors: Array.isArray(slab.colors) ? slab.colors : [],
        colorSource: slab.color_source === 'card' ? 'card' : 'brand',
        logoVariant: slab.logo_variant === 'black' || slab.logo_variant === 'white' ? slab.logo_variant : 'color',
        logoScale: typeof slab.logo_scale === 'number' ? slab.logo_scale : 1,
        /** Label Designer document (resolved; seeded from the keys above when unset). */
        design: branding.design,
      },
    },
  })
}
