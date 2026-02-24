import type { Metadata } from 'next';
import { getCategoryFromSlug, getCategoryMeta, POP_CATEGORIES } from '@/lib/popReport';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = getCategoryMeta(category);
  const name = meta?.displayName || getCategoryFromSlug(category);

  return {
    title: `${name} Population Report | DCM Grading`,
    description: `View every ${name} card graded by DCM — grade distributions, player stats, and grading volume. Explore the full ${name} population report.`,
    openGraph: {
      title: `${name} Population Report | DCM Grading`,
      description: `Complete grade distribution data for all ${name} cards graded by DCM.`,
      url: `https://www.dcmgrading.com/pop/${category}`,
      siteName: 'DCM Grading',
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  return POP_CATEGORIES.map((cat) => ({ category: cat.slug }));
}

export default function PopCategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
