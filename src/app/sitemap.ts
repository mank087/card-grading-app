import { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dcmgrading.com';
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
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, category, created_at')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cards for sitemap:', error);
    return staticPages;
  }

  // Map category to URL path
  const categoryToPath: Record<string, string> = {
    sports: 'sports',
    pokemon: 'pokemon',
    mtg: 'mtg',
    lorcana: 'lorcana',
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

  return [...staticPages, ...cardPages];
}
