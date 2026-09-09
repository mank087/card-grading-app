import { withColumnFallback } from '@/lib/cards/ownership';
import { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import { POP_CATEGORIES } from '@/lib/popReport';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dcmgrading.com';
  const supabase = supabaseServer();

  // Static pages with their priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Grading info & educational pages
    {
      url: `${baseUrl}/card-grading`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // SEO landing pages for high-intent commercial keywords
    {
      url: `${baseUrl}/ai-card-grading`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/psa-alternative`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // AEO content pages: the category, attribute and method questions answer
    // engines are actually asked.
    {
      url: `${baseUrl}/card-grading-companies`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ai-card-grading-accuracy`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fastest-card-grading`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cheapest-card-grading`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pokemon-grading`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sports-grading`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/get-started`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/grade-your-first-card`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      // The published, versioned grading standard — the citable reference page.
      url: `${baseUrl}/grading-standard`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/why-dcm`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/featured`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/grading-rubric`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/grading-limitations`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/reports-and-labels`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Card database pages
    {
      url: `${baseUrl}/pokemon-database`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/mtg-database`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/lorcana-database`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/onepiece-database`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Card shows
    {
      url: `${baseUrl}/card-shows`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Other pages
    {
      url: `${baseUrl}/card-lovers`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/market-pricing`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Population Report
    {
      url: `${baseUrl}/pop`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...POP_CATEGORIES.map((cat) => ({
      url: `${baseUrl}/pop/${cat.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/credits`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Page through narrow public rows: Supabase's default row limit must not
  // silently leave most graded cards out of the sitemap. Errors fail the
  // regeneration rather than publishing a successful partial sitemap.
  const cards: { id: string; category: string | null; user_id?: string; org_id?: string }[] = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await withColumnFallback(
      () => supabase.from('cards').select('id, category, user_id, org_id')
        .eq('visibility', 'public').is('deleted_at', null)
        .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
        .order('id').range(offset, offset + batchSize - 1),
      () => supabase.from('cards').select('id, category, user_id, org_id')
        .eq('visibility', 'public')
        .or('conversational_decimal_grade.not.is.null,conversational_grading.not.is.null')
        .order('id').range(offset, offset + batchSize - 1),
      'sitemap public cards'
    );
    if (error) throw new Error('Unable to generate the public card sitemap');
    cards.push(...(data || []));
    if (!data || data.length < batchSize) break;
  }
  // Omit lastModified: this schema has no reliable card-content update date.
  const cardPages: MetadataRoute.Sitemap = cards.map(card => ({
    url: `${baseUrl}/${categoryToRouteSlug(card.category) === 'starwars' ? 'other' : categoryToRouteSlug(card.category)}/${card.id}`,
    changeFrequency: 'weekly', priority: 0.6,
  }));
  // /verify/:serial redirects to the card; list only canonical destinations.

  // Fetch active card shows
  const { data: shows, error: showsError } = await supabase
    .from('card_shows')
    .select('slug, updated_at')
    .eq('is_active', true);

  if (showsError) {
    console.error('Error fetching card shows for sitemap:', showsError);
  }

  const showPages: MetadataRoute.Sitemap = (shows || []).map((show) => ({
    url: `${baseUrl}/card-shows/${show.slug}`,
    ...(show.updated_at ? { lastModified: new Date(show.updated_at) } : {}),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  // Fetch published blog posts
  const { data: blogPosts, error: blogError } = await supabase
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString());

  if (blogError) {
    console.error('Error fetching blog posts for sitemap:', blogError);
  }

  const blogPages: MetadataRoute.Sitemap = (blogPosts || []).map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    ...(post.updated_at ? { lastModified: new Date(post.updated_at) } : {}),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Fetch blog categories
  const { data: blogCategories } = await supabase
    .from('blog_categories')
    .select('slug, updated_at');

  const blogCategoryPages: MetadataRoute.Sitemap = (blogCategories || []).map((cat) => ({
    url: `${baseUrl}/blog/category/${cat.slug}`,
    ...(cat.updated_at ? { lastModified: new Date(cat.updated_at) } : {}),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Add blog index page
  const blogIndexPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/blog`,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }];

  const additionalPages: MetadataRoute.Sitemap = [
    'vip', 'enterprise', 'enterprise/terms', 'affiliates', 'instalist-marketplace', 'shop',
    'sports-database', 'starwars-database', 'yugioh-database', 'labels',
  ].map(path => ({ url: `${baseUrl}/${path}`, changeFrequency: 'monthly', priority: 0.6 }));

  // Discover only active, explicitly enabled public storefronts and owners
  // who already have a public, graded card in the canonical listing above.
  const orgs: { id: string; slug: string }[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from('organizations').select('id, slug')
      .eq('status', 'active').eq('storefront_enabled', true)
      .order('id').range(offset, offset + batchSize - 1);
    if (error) throw new Error('Unable to generate storefront sitemap');
    orgs.push(...(data || []));
    if (!data || data.length < batchSize) break;
  }
  const orgSlugs = new Map(orgs.map(org => [org.id, org.slug]));
  const discoveryPages: MetadataRoute.Sitemap = orgs.map(org => ({
    url: `${baseUrl}/enterprise/${encodeURIComponent(org.slug)}`, changeFrequency: 'weekly', priority: 0.6,
  }));
  for (const card of cards) {
    const slug = card.org_id && orgSlugs.get(card.org_id);
    if (slug) discoveryPages.push({ url: `${baseUrl}/enterprise/${encodeURIComponent(slug)}/card/${card.id}`, changeFrequency: 'weekly', priority: 0.5 });
  }
  const publicOwners = [...new Set(cards.flatMap(card => card.user_id ? [card.user_id] : []))];
  // Keep URL query strings small and bound concurrency during regeneration.
  for (let offset = 0; offset < publicOwners.length; offset += 400) {
    const batches = [0, 100, 200, 300].map(start => publicOwners.slice(offset + start, offset + start + 100)).filter(ids => ids.length);
    const results = await Promise.all(batches.map(ids => supabase.from('profiles').select('username').in('id', ids)));
    for (const { data, error } of results) {
      if (error) throw new Error('Unable to generate public collection sitemap');
      for (const profile of data || []) if (profile.username) discoveryPages.push({
        url: `${baseUrl}/collection/${encodeURIComponent(profile.username)}`, changeFrequency: 'weekly', priority: 0.4,
      });
    }
  }

  const entries = [
    ...discoveryPages,
    ...staticPages,
    ...additionalPages,
    ...cardPages,
    ...showPages,
    ...blogIndexPage,
    ...blogPages,
    ...blogCategoryPages,
  ];
  const unique = [...new Map(entries.map(entry => [entry.url, entry])).values()];
  if (unique.length > 50000) throw new Error('Sitemap exceeds 50,000 URLs; split into sitemap shards');
  return unique;
}
