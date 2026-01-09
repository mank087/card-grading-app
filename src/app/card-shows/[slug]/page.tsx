import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ShowPageClient from './ShowPageClient'
import { CardShow, formatDateRange, generateMetaTitle, generateMetaDescription } from '@/types/cardShow'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Fetch show data server-side
async function getShow(slug: string): Promise<CardShow | null> {
  const { data, error } = await supabase
    .from('card_shows')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

// Generate static params for popular shows (optional optimization)
export async function generateStaticParams() {
  const { data: shows } = await supabase
    .from('card_shows')
    .select('slug')
    .eq('is_active', true)
    .limit(20)

  return (shows || []).map((show) => ({
    slug: show.slug,
  }))
}

// Generate metadata for SEO
export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const show = await getShow(slug)

  if (!show) {
    return {
      title: 'Show Not Found | DCM Grading',
      description: 'The card show you are looking for could not be found.',
    }
  }

  const title = generateMetaTitle(show)
  const description = generateMetaDescription(show)
  const dateRange = formatDateRange(show.start_date, show.end_date)

  return {
    title,
    description,
    keywords: [
      show.name,
      show.city,
      show.state || '',
      'card grading',
      'PSA grading',
      'card show',
      'sports cards',
      'pokemon cards',
      'trading cards',
      dateRange,
      ...(show.keywords || []),
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://www.dcmgrading.com/card-shows/${show.slug}`,
      siteName: 'DCM Grading',
      images: show.hero_image_url ? [
        {
          url: show.hero_image_url,
          width: 1200,
          height: 630,
          alt: show.name,
        }
      ] : [
        {
          url: 'https://www.dcmgrading.com/og-image.png',
          width: 1200,
          height: 630,
          alt: 'DCM Grading - AI Card Grading',
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: show.hero_image_url ? [show.hero_image_url] : ['https://www.dcmgrading.com/og-image.png'],
    },
    alternates: {
      canonical: `https://www.dcmgrading.com/card-shows/${show.slug}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  }
}

// Page component
export default async function CardShowPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const show = await getShow(slug)

  if (!show) {
    notFound()
  }

  return <ShowPageClient show={show} />
}

// Revalidate every hour for fresh data
export const revalidate = 3600
