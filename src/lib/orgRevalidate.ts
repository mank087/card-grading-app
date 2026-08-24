import { revalidatePath } from 'next/cache'

/**
 * Bust the ISR cache for an org's public pages after a settings write —
 * the Enterprise Page (`revalidate = 300`), its card report pages
 * (`revalidate = 60`) and the legacy /storefront alias — so a saved label
 * design or storefront edit is visible on the next request.
 *
 * Route handlers only (server). Failures are logged, never thrown: the row
 * update is the source of truth and the cache would expire anyway.
 */
export function revalidateOrgPages(slug: string | null | undefined): void {
  if (!slug) return
  try {
    revalidatePath(`/enterprise/${slug}`)
    revalidatePath(`/storefront/${slug}`)
    // Every org card page — there is no per-org tag on the dynamic route.
    revalidatePath('/enterprise/[slug]/card/[id]', 'page')
  } catch (err) {
    console.error('[orgRevalidate] failed for', slug, err)
  }
}
