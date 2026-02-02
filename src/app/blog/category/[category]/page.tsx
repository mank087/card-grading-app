import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost, BlogCategory } from '@/types/blog';
import FloatingCardsBackground from '../../../ui/FloatingCardsBackground';
import { BlogPostCard, BlogPagination, CategoryBadge } from '@/components/blog';

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function getCategory(slug: string): Promise<BlogCategory | null> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('blog_categories')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as BlogCategory | null;
}

async function getCategoryPosts(categoryId: string, page: number) {
  const supabase = supabaseServer();
  const limit = 9;
  const offset = (page - 1) * limit;

  const { data: posts, count } = await supabase
    .from('blog_posts')
    .select(`
      *,
      category:blog_categories(*)
    `, { count: 'exact' })
    .eq('category_id', categoryId)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    posts: (posts || []) as BlogPost[],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

async function getAllCategories() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('blog_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return (data || []) as BlogCategory[];
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategory(categorySlug);

  if (!category) {
    return {
      title: 'Category Not Found | DCM Grading Blog',
    };
  }

  return {
    title: `${category.name} | DCM Grading Blog`,
    description: category.description || `Read our latest ${category.name.toLowerCase()} articles on card grading and collecting.`,
    openGraph: {
      title: `${category.name} | DCM Grading Blog`,
      description: category.description || `Read our latest ${category.name.toLowerCase()} articles.`,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || '1');

  const category = await getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  const [{ posts, totalPages }, allCategories] = await Promise.all([
    getCategoryPosts(category.id, page),
    getAllCategories(),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-purple-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-purple-600 transition-colors">
            Blog
          </Link>
          <span>/</span>
          <span className="text-gray-900">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4">
            <CategoryBadge category={category} size="lg" clickable={false} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {category.description}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-4">
            {category.post_count} {category.post_count === 1 ? 'article' : 'articles'}
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Link
            href="/blog"
            className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            All Posts
          </Link>
          {allCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/blog/category/${cat.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                cat.slug === categorySlug
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat.name}
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No posts in this category yet</h2>
            <p className="text-gray-600 mb-6">
              We're working on some great content. Check back soon!
            </p>
            <Link
              href="/blog"
              className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              View All Posts
            </Link>
          </div>
        ) : (
          <>
            {/* Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            <BlogPagination
              currentPage={page}
              totalPages={totalPages}
              basePath={`/blog/category/${categorySlug}`}
            />
          </>
        )}

        {/* Newsletter CTA */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Stay Updated</h2>
          <p className="text-lg opacity-90 mb-6 max-w-xl mx-auto">
            Get the latest {category.name.toLowerCase()} and more delivered to your inbox.
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
