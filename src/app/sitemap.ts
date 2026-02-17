import { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.dcmgrading.com';
  const supabase = supabaseServer();

  // Static pages with their priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Grading info & educational pages
    {
      url: `${baseUrl}/card-grading`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pokemon-grading`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sports-grading`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/get-started`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/grade-your-first-card`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/grading-rubric`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/grading-limitations`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/reports-and-labels`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Card database pages
    {
      url: `${baseUrl}/pokemon-database`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/mtg-database`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/lorcana-database`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/onepiece-database`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Card shows
    {
      url: `${baseUrl}/card-shows`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Other pages
    {
      url: `${baseUrl}/card-lovers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/market-pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/credits`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Fetch all public cards from the database
  // Only include cards that are public and have been graded
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, category, created_at')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (cardsError) {
    console.error('Error fetching cards for sitemap:', cardsError);
  }

  // Map category to URL path
  const categoryToPath: Record<string, string> = {
    sports: 'sports',
    pokemon: 'pokemon',
    mtg: 'mtg',
    lorcana: 'lorcana',
    onepiece: 'onepiece',
    other: 'other',
  };

  // Generate sitemap entries for each public card
  const cardPages: MetadataRoute.Sitemap = (cards || []).map((card) => {
    const path = categoryToPath[card.category] || 'sports';

    return {
      url: `${baseUrl}/${path}/${card.id}`,
      lastModified: card.created_at ? new Date(card.created_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    };
  });

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
    lastModified: show.updated_at ? new Date(show.updated_at) : new Date(),
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
    lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Fetch blog categories
  const { data: blogCategories } = await supabase
    .from('blog_categories')
    .select('slug, updated_at');

  const blogCategoryPages: MetadataRoute.Sitemap = (blogCategories || []).map((cat) => ({
    url: `${baseUrl}/blog/category/${cat.slug}`,
    lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Add blog index page
  const blogIndexPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/blog`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }];

  return [...staticPages, ...cardPages, ...showPages, ...blogIndexPage, ...blogPages, ...blogCategoryPages];
}
