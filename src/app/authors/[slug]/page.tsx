import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseServer } from '@/lib/supabaseServer'
import { BlogPost } from '@/types/blog'
import { BlogPostCard } from '@/components/blog'
import { AUTHORS, authorUrl, getAuthorBySlug, personSchema } from '@/lib/authors'
import { breadcrumbList, SITE_URL } from '@/lib/seo/blogSchema'

export const revalidate = 300

interface AuthorPageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return AUTHORS.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params
  const author = getAuthorBySlug(slug)
  if (!author) return { title: { absolute: 'Author Not Found | DCM Grading' } }
  const url = authorUrl(author)
  return completeMetadata({
    title: { absolute: author.metaTitle },
    description: author.metaDescription,
    openGraph: { url, title: author.metaTitle, description: author.metaDescription, type: 'profile' },
    twitter: { card: 'summary', title: author.metaTitle, description: author.metaDescription },
    alternates: { canonical: url },
  })
}

async function getPostsByAuthor(name: string): Promise<BlogPost[]> {
  const supabase = supabaseServer()
  const { data } = await supabase
    .from('blog_posts')
    .select('*, category:blog_categories(*)')
    .eq('status', 'published')
    .eq('author_name', name)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(30)
  return (data || []) as BlogPost[]
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params
  const author = getAuthorBySlug(slug)
  if (!author) notFound()

  const posts = await getPostsByAuthor(author.name)
  const url = authorUrl(author)

  const profileLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': url,
    url,
    name: author.metaTitle,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: personSchema(author),
  }
  const crumbsLd = breadcrumbList([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    { name: author.name, url },
  ])

  return (
    <main className="dcm-brand dcm-editorial dcm-blog min-h-screen relative dcm-editorial-soft">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbsLd) }} />

      <article className="relative z-10">
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 dcm-editorial-heading">
            <div role="navigation" aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Link href="/" className="hover:text-purple-600 transition-colors">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-purple-600 transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-gray-900">{author.name}</span>
            </div>
            <p className="dcm-eyebrow">Author</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">{author.name}</h1>
            <p className="text-lg text-purple-700 font-medium mb-6">{author.title}</p>
            <p className="text-lg text-gray-700 leading-relaxed">{author.summary}</p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 lg:p-10 space-y-10">
            {author.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.heading}</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {s.image && (
                  <figure className="mt-6">
                    <img
                      src={s.image.src}
                      alt={s.image.alt}
                      loading="lazy"
                      className="w-full rounded-xl border border-gray-200 shadow-sm"
                    />
                    <figcaption className="mt-2 text-sm text-gray-500 text-center">{s.image.caption}</figcaption>
                  </figure>
                )}
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What he writes about</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                {author.topics.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick facts</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                {author.facts.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </section>
          </div>

          {posts.length > 0 && (
            <section className="mt-12" aria-labelledby="author-posts">
              <h2 id="author-posts" className="text-2xl font-bold text-gray-900 mb-6">Articles by {author.name}</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => <BlogPostCard key={post.id} post={post} />)}
              </div>
            </section>
          )}
        </div>
      </article>
    </main>
  )
}
