import { MarketingServiceSchema } from '@/components/marketing/MarketingServiceSchema'
import { completeMetadata } from '@/lib/seo/completeMetadata'
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary'
import { Metadata } from 'next';

/**
 * The get-started page is a client component, so it cannot export `metadata`
 * itself. This layout carries the route's canonical URL and its title.
 *
 * Without a title of its own the route inherited the root default, which is the
 * homepage's title verbatim — two pages sharing one title is exactly the
 * duplicate-title defect the Sept 2026 crawl flagged.
 */
export const metadata: Metadata = completeMetadata({
  twitter: { card: 'summary', title: 'Get Started: Grade Your First Card in a Minute', description: 'How to grade a trading card with DCM: photograph the front and back, upload both, and get a full condition report with four subgrades in about a minute. No mailing, no waiting. Two free grades to start.', images: ['/DCM-logo.png'] },
  openGraph: { title: 'Get Started: Grade Your First Card in About a Minute', description: 'How to grade a trading card with DCM: photograph the front and back, upload both, and get a full condition report with four subgrades in about a minute. No mailing, no waiting. Two free grades to start.', type: 'website', siteName: 'DCM Grading', images: ['/DCM-logo.png'] },
  title: 'Get Started: Grade Your First Card in a Minute',
  description:
    "Learn to grade a card with DCM: photograph the front and back, upload both and review four subgrades with condition findings. Start with two free grades.",
  alternates: {
    canonical: 'https://dcmgrading.com/get-started',
  },
});

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShowcaseBoundary selection="get-started"><MarketingServiceSchema page="get-started" />{children}</MarketingShowcaseBoundary>;
}
