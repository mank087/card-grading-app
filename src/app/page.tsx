import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

// The homepage body is a client component (live stats, carousels, auth-aware
// CTAs) and so cannot export metadata itself. This thin server wrapper exists to
// carry the canonical: it CANNOT live on the root layout, because metadata is
// merged down the tree and a root canonical would be inherited by every page
// that does not set its own.
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://dcmgrading.com',
    // `alternates` is REPLACED, not merged, when a page declares it — so the
    // root layout's RSS link has to be restated wherever a canonical is set.
    types: {
      'application/rss+xml': [
        { url: 'https://dcmgrading.com/rss.xml', title: 'DCM Grading Blog' },
      ],
    },
  },
};

export default function Page() {
  return <HomePageClient />;
}
