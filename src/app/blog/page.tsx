import { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost, BlogCategory } from '@/types/blog';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import { BlogPostCard, BlogPagination, CategoryBadge } from '@/components/blog';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Blog - Card Collecting News & Tips',
  description: 'Expert insights on card grading, market trends, collecting tips, and more from the DCM Grading team. Stay informed about Pokemon, Sports, MTG card news.',
  keywords: 'card grading blog, trading cards, collecting tips, market insights, pokemon cards, sports cards, MTG, card collecting news, grading tips',
  openGraph: {
    title: 'Blog - Card Collecting News & Tips | DCM Grading',
    description: 'Expert insights on card grading, market trends, and collecting tips.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'DCM Grading Blog',
    description: 'Card collecting news, grading tips, and market insights.',
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; category?: string }>;
}

async function getBlogPosts(page: number, categorySlug?: string) {
  const supabase = supabaseServer();
  const limit = 9;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('blog_posts')
    .select(`
      *,
      category:blog_categories(*)
    `, { count: 'exact' })
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (categorySlug) {
    const { data: categoryData } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (categoryData) {
      query = query.eq('category_id', categoryData.id);
    }
  }

  query = query.range(offset, offset + limit - 1);

  const { data: posts, count } = await query;
  return {
    posts: (posts || []) as BlogPost[],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

async function getCategories() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('blog_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return (data || []) as BlogCategory[];
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const categorySlug = params.category;

  const [{ posts, total, totalPages }, categories] = await Promise.all([
    getBlogPosts(page, categorySlug),
    getCategories(),
  ]);

  const featuredPost = page === 1 && !categorySlug ? posts[0] : null;
  const regularPosts = featuredPost ? posts.slice(1) : posts;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            DCM Blog
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Expert insights on card grading, market trends, collecting tips, and industry news
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Link
            href="/blog"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !categorySlug
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            All Posts
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/blog?category=${category.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categorySlug === category.slug
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h2>
            <p className="text-gray-600">
              {categorySlug
                ? 'No posts found in this category. Check back soon!'
                : 'We\'re working on some great content. Check back soon!'}
            </p>
          </div>
        ) : (
          <>
            {/* Featured Post (first page only) */}
            {featuredPost && (
              <div className="mb-10">
                <BlogPostCard post={featuredPost} featured />
              </div>
            )}

            {/* Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            <BlogPagination
              currentPage={page}
              totalPages={totalPages}
              basePath="/blog"
              queryParams={categorySlug ? { category: categorySlug } : {}}
            />
          </>
        )}

        {/* Newsletter CTA */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Stay Updated</h2>
          <p className="text-lg opacity-90 mb-6 max-w-xl mx-auto">
            Get the latest card grading tips, market insights, and news delivered to your inbox.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-block bg-white text-purple-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors shadow-lg"
          >
            Sign Up for Free
          </Link>
        </div>
      </div>
    </main>
  );
}
