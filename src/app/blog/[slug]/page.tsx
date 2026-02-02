import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost } from '@/types/blog';
import FloatingCardsBackground from '../../ui/FloatingCardsBackground';
import {
  BlogPostContent,
  CategoryBadge,
  ReadingProgress,
  TableOfContents,
  ShareButtons,
  RelatedPosts,
} from '@/components/blog';

export const revalidate = 60;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const supabase = supabaseServer();

  const { data: post } = await supabase
    .from('blog_posts')
    .select(`
      *,
      category:blog_categories(*)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .single();

  if (post) {
    // Increment view count (fire and forget)
    supabase
      .from('blog_posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', post.id)
      .then(() => {});
  }

  return post as BlogPost | null;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found | DCM Grading Blog',
    };
  }

  const title = post.meta_title || `${post.title} | DCM Grading Blog`;
  const description = post.meta_description || post.excerpt || post.subtitle || '';

  return {
    title,
    description,
    keywords: post.tags?.join(', '),
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      images: post.featured_image_path
        ? [{ url: post.featured_image_path, alt: post.featured_image_alt || post.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.featured_image_path ? [post.featured_image_path] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dcmgrading.com';
  const postUrl = `${baseUrl}/blog/${post.slug}`;

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.subtitle,
    image: post.featured_image_path,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Organization',
      name: post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DCM Grading',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/DCM-logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
  };

  return (
    <>
      <ReadingProgress />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
        <FloatingCardsBackground />

        <article className="relative z-10">
          {/* Hero Section */}
          <header className="bg-white border-b border-gray-100">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Link href="/" className="hover:text-purple-600 transition-colors">
                  Home
                </Link>
                <span>/</span>
                <Link href="/blog" className="hover:text-purple-600 transition-colors">
                  Blog
                </Link>
                {post.category && (
                  <>
                    <span>/</span>
                    <Link
                      href={`/blog/category/${post.category.slug}`}
                      className="hover:text-purple-600 transition-colors"
                    >
                      {post.category.name}
                    </Link>
                  </>
                )}
              </nav>

              {/* Category Badge */}
              {post.category && (
                <div className="mb-4">
                  <CategoryBadge category={post.category} size="md" />
                </div>
              )}

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>

              {/* Subtitle */}
              {post.subtitle && (
                <p className="text-xl text-gray-600 mb-6">{post.subtitle}</p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="font-medium text-gray-900">{post.author_name}</span>
                <span className="hidden sm:inline">·</span>
                <time dateTime={post.published_at || undefined}>{formattedDate}</time>
                <span className="hidden sm:inline">·</span>
                <span>{post.read_time_minutes} min read</span>
              </div>
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image_path && (
            <div className="bg-white">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="aspect-[16/9] relative rounded-2xl overflow-hidden shadow-lg">
                  <Image
                    src={post.featured_image_path}
                    alt={post.featured_image_alt || post.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1280px) 100vw, 1280px"
                  />
                </div>
                {post.featured_image_alt && (
                  <p className="text-center text-sm text-gray-500 mt-3 italic">
                    {post.featured_image_alt}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="lg:grid lg:grid-cols-[1fr_250px] lg:gap-12">
              {/* Main Content */}
              <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 lg:p-10">
                <BlogPostContent content={post.content} />

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <ShareButtons
                    url={postUrl}
                    title={post.title}
                    description={post.excerpt || post.subtitle || undefined}
                  />
                </div>
              </div>

              {/* Sidebar - Table of Contents */}
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <TableOfContents content={post.content} />
                </div>
              </aside>
            </div>

            {/* Related Posts */}
            <RelatedPosts
              currentPostId={post.id}
              categoryId={post.category_id}
              tags={post.tags}
            />
          </div>
        </article>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Ready to Grade Your Cards?</h2>
            <p className="text-lg opacity-90 mb-6">
              Get accurate, instant card grades with DCM Optic&trade; technology.
            </p>
            <Link
              href="/login?mode=signup"
              className="inline-block bg-white text-purple-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
