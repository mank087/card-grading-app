import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseServer } from '@/lib/supabaseServer';
import { BlogPost } from '@/types/blog';
import { breadcrumbList, faqPage, markdownWordCount, SITE_URL } from '@/lib/seo/blogSchema';
import { getAuthorByName, personSchema } from '@/lib/authors';
import {
  BlogPostContent,
  CategoryBadge,
  ReadingProgress,
  TableOfContents,
  ShareButtons,
  RelatedPosts,
  FurtherReading,
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
      title: { absolute: 'Post Not Found | DCM Grading Blog' },
    };
  }

  // Both branches already carry the brand, and stored meta_title values end in
  // "| DCM Grading" too. `absolute` stops the root layout's `%s | DCM Grading`
  // template from appending a second suffix.
  const title = post.meta_title || `${post.title} | DCM Grading Blog`;
  const description = post.meta_description || post.excerpt || post.subtitle || '';

  return completeMetadata({
    title: { absolute: title },
    description,
    keywords: post.tags?.join(', '),
    openGraph: {
      url: `https://dcmgrading.com/blog/${slug}`,
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
    alternates: {
      canonical: `https://dcmgrading.com/blog/${slug}`,
      types: {
        'application/rss+xml': [
          { url: 'https://dcmgrading.com/rss.xml', title: 'DCM Grading Blog' },
        ],
      },
    },
  });
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dcmgrading.com';
  const postUrl = `${baseUrl}/blog/${post.slug}`;

  // JSON-LD structured data for SEO
  // "Updated" is only worth showing when an edit happened well after publish;
  // the trigger bumps updated_at on any save, so a same-day touch is noise.
  const publishedMs = post.published_at ? new Date(post.published_at).getTime() : 0;
  const updatedMs = post.updated_at ? new Date(post.updated_at).getTime() : 0;
  const showUpdated = publishedMs > 0 && updatedMs - publishedMs > 24 * 60 * 60 * 1000;
  const formattedUpdated = showUpdated
    ? new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const faq = Array.isArray(post.faq) ? post.faq.filter((f) => f?.question && f?.answer) : [];
  const author = getAuthorByName(post.author_name);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    headline: post.title,
    description: post.excerpt || post.subtitle,
    ...(post.quick_answer ? { abstract: post.quick_answer } : {}),
    image: post.featured_image_path,
    datePublished: post.published_at,
    dateModified: showUpdated ? post.updated_at : post.published_at,
    inLanguage: 'en-US',
    wordCount: markdownWordCount(post.content),
    ...(post.category?.name ? { articleSection: post.category.name } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
    author: author
      ? personSchema(author)
      : {
          '@type': 'Organization',
          name: post.author_name,
          url: SITE_URL,
        },
    publisher: { '@id': `${SITE_URL}/#organization` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
  };
  const breadcrumbLd = breadcrumbList([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    ...(post.category ? [{ name: post.category.name, url: `${SITE_URL}/blog/category/${post.category.slug}` }] : []),
    { name: post.title, url: postUrl },
  ]);
  const faqLd = faq.length ? faqPage(faq) : null;

  return (
    <>
      <ReadingProgress />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      <main className="dcm-brand dcm-editorial dcm-blog min-h-screen relative dcm-editorial-soft">

        <article className="relative z-10">
          {/* Header: breadcrumb, category and title only. The subtitle, byline
              and quick answer sit under the featured image so the top of the
              page is title, picture, details, in that order. (The old hero
              used .dcm-blog-hero, whose white heading colour on a light
              surface rendered the title invisible.) */}
          <header className="bg-white border-b border-gray-100">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
              <div role="navigation" aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500 mb-5">
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
              </div>

              {post.category && (
                <div className="mb-4">
                  <CategoryBadge category={post.category} size="md" />
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight" style={{ color: '#111827' }}>
                {post.title}
              </h1>
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image_path && (
            <div className="bg-white">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2">
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

          {/* Details under the image: subtitle, byline, quick answer */}
          <section className="bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
              {post.subtitle && (
                <p className="text-xl text-gray-600 mb-4">{post.subtitle}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span>By</span>
                {author ? (
                  <Link
                    href={`/authors/${author.slug}`}
                    rel="author"
                    className="font-semibold text-purple-700 underline decoration-purple-300 underline-offset-4 hover:text-purple-900 hover:decoration-purple-700 transition-colors"
                  >
                    {author.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900">{post.author_name}</span>
                )}
                <span aria-hidden="true">·</span>
                <time dateTime={post.published_at || undefined}>{formattedDate}</time>
                {showUpdated && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Updated <time dateTime={post.updated_at}>{formattedUpdated}</time></span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{post.read_time_minutes} min read</span>
              </div>

              {/* Quick answer: the direct answer to the title, kept near the
                  top so readers and answer engines get it without scrolling. */}
              {post.quick_answer && (
                <div className="mt-6 rounded-xl border-l-4 border-purple-600 bg-purple-50 px-5 py-4" data-quick-answer>
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-700 mb-1">Quick answer</p>
                  <p className="text-base sm:text-lg text-gray-900 leading-relaxed">{post.quick_answer}</p>
                </div>
              )}
            </div>
          </section>

          {/* Content */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="lg:grid lg:grid-cols-[1fr_250px] lg:gap-12">
              {/* Main Content */}
              <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 lg:p-10">
                <TableOfContents content={post.content} variant="inline" />
                <BlogPostContent content={post.content} />

                {/* FAQ */}
                {faq.length > 0 && (
                  <section className="mt-10 pt-6 border-t border-gray-200" aria-labelledby="post-faq">
                    <h2 id="post-faq" className="text-2xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
                    <dl className="space-y-5">
                      {faq.map((f, i) => (
                        <div key={i}>
                          <dt className="text-base font-semibold text-gray-900">{f.question}</dt>
                          <dd className="mt-1 text-gray-700 leading-relaxed">{f.answer}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

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

                {/* Further reading — topical static pages, chosen from the post's tags */}
                <FurtherReading
                  tags={post.tags}
                  categorySlug={post.category?.slug}
                  categoryTitle={post.category?.name}
                />

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
              categorySlug={post.category?.slug}
              tags={post.tags}
            />
          </div>
        </article>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
          <div className="rounded-2xl shadow-xl p-8 text-center text-white dcm-editorial-dark">
            <h2 className="text-2xl font-bold mb-3">Ready to Grade Your Cards?</h2>
            <p className="text-lg opacity-90 mb-6">
              Get accurate, instant card grades with DCM Optic&trade; technology.
            </p>
            <Link
              href="/login?mode=signup"
              className="inline-block bg-white text-purple-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors shadow-lg dcm-editorial-secondary"
            >
              Grade Your First Card Free
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
