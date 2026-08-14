/**
 * Legacy storefront URLs → Enterprise Page URLs.
 *
 * The org public pages moved from /storefront/{slug}/... to
 * /enterprise/{slug}/... (Aug 2026 rename). Printed slab labels and QR codes
 * encode the old path permanently, so this redirect must live forever.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await paramsPromise
  const url = new URL(request.url)
  const target = new URL(`/enterprise/${(path || []).join('/')}`, url.origin)
  target.search = url.search
  return NextResponse.redirect(target, 308)
}
