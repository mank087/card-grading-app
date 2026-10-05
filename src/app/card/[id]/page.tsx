import { notFound, redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabaseServer'
import { isUuid } from '@/lib/uuid'
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates'

/** Public UUID links from the app resolve through the normal category page and its visibility checks. */
export default async function PublicCardLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { data } = await supabaseServer().from('cards').select('id, category')
    .eq('id', id).eq('visibility', 'public').is('deleted_at', null).maybeSingle()
  if (!data) notFound()
  redirect(`/${categoryToRouteSlug(data.category)}/${data.id}`)
}
