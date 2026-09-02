import { Metadata } from 'next';

/**
 * The get-started page is a client component, so it cannot export `metadata`
 * itself. This layout carries the route's canonical URL and its title.
 *
 * Without a title of its own the route inherited the root default, which is the
 * homepage's title verbatim — two pages sharing one title is exactly the
 * duplicate-title defect the Sept 2026 crawl flagged.
 */
export const metadata: Metadata = {
  title: 'Get Started: Grade Your First Card in About a Minute',
  description:
    'How to grade a trading card with DCM: photograph the front and back, upload both, and get a full condition report with four subgrades in about a minute. No mailing, no waiting. Two free grades to start.',
  alternates: {
    canonical: 'https://dcmgrading.com/get-started',
  },
};

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
