import { withColumnFallback } from '@/lib/cards/ownership'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabaseServer'
import { isUuid } from '@/lib/uuid'

/** Request-scoped memoization shares the narrow row between page and metadata. */
export const getCardMetadataRow = cache(async (id: string, columns: string) =>
  withColumnFallback(
    () => supabaseServer().from('cards').select(columns).eq('id', id).is('deleted_at', null).single(),
    () => supabaseServer().from('cards').select(columns).eq('id', id).single(),
    'card metadata'
  )
)

/** Validate before rendering the client shell so missing reports send HTTP 404. */
export async function requireCardMetadataRow(id: string, columns: string) {
  if (!isUuid(id)) notFound()
  const result = await getCardMetadataRow(id, columns)
  if (result.error?.code === 'PGRST116' || (!result.error && !result.data)) notFound()
  if (result.error) throw new Error('Unable to load card report')
  return result
}
