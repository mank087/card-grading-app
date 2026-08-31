import { supabaseServer } from '@/lib/supabaseServer';

// Regenerate hourly. The blog itself revalidates at 60s; the feed is a
// lower-frequency surface and does not need to be that fresh.
export const revalidate = 3600;

const SITE_URL = 'https://dcmgrading.com';
const FEED_TITLE = 'DCM Grading Blog';
const FEED_DESCRIPTION =
  'Card grading news, collecting tips, and market insights from the DCM Grading team.';

/** Escape the five XML predefined entities. Applied to every interpolated value. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = supabaseServer();

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, meta_description, subtitle, published_at, updated_at')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching blog posts for RSS feed:', error);
  }

  const items = (posts || [])
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      const description = post.excerpt || post.meta_description || post.subtitle || '';
      const date = post.published_at || post.updated_at;
      const pubDate = date ? new Date(date).toUTCString() : undefined;

      return [
        '    <item>',
        `      <title>${xmlEscape(post.title || '')}</title>`,
        `      <link>${xmlEscape(link)}</link>`,
        `      <description>${xmlEscape(description)}</description>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : null,
        `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(FEED_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
