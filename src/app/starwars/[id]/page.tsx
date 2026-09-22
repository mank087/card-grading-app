import { redirect } from 'next/navigation';

/**
 * Star Wars cards do not have their own detail page and have not had one since
 * March 2026 (commit d41b72f8): the category was retired, every Star Wars row
 * was migrated to `category='Other', sub_category='Star Wars'`, and this route
 * became a redirect to `/other/[id]`. `./CardDetailClient.tsx` is still on disk
 * but nothing imports it, and no Star Wars URL appears in `/sitemap.xml`.
 *
 * So there is NO `CardDetailV2Client` here and no `resolveCardDetailVersion`
 * call: the version decision belongs to `/other/[id]/page.tsx`, which is where
 * the card is actually rendered. What this route owes the rollout is only that
 * a reviewer's `?v=1` / `?v=2` survives the hop — otherwise an old Star Wars
 * link silently drops the override and serves whichever page the flag picks.
 */
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StarWarsCardDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;

  // Only `v`, and only an exact '1' or '2' — the same values
  // `resolveCardDetailVersion` honours. Anything else is dropped rather than
  // forwarded, so this cannot become a way to smuggle arbitrary query
  // parameters onto /other.
  const raw = (await searchParams)?.v;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const suffix = v === '1' || v === '2' ? `?v=${v}` : '';

  redirect(`/other/${id}${suffix}`);
}
