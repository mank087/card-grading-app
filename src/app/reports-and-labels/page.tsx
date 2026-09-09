import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';
import ReportsExperience from '@/components/marketing/ReportsExperience';



export const metadata: Metadata = completeMetadata({
  twitter: { card: 'summary', title: 'Reports & Labels', description: 'Download professional grading labels and reports for your DCM-graded cards. Graded slab images, foldable labels for magnetic one-touch holders and top loaders, full grading reports, and mini reports for online sales. Customize with Label Studio.', images: ['/DCM-logo.png'] },
  title: 'Reports & Labels',
  description: "Explore DCM card reports and labels: full condition reports, mini reports, Heritage labels and printable formats for slabs, holders and online listings.",
  keywords: 'card grading labels, grading reports, slab labels, top loader labels, graded card slab, label studio, Avery 6871, card authentication, downloadable labels, grading certificate',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    title: 'DCM Reports & Labels - Professional Card Documentation',
    description: 'Professional grading labels and reports for your trading cards. Display, share, and sell with confidence.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://dcmgrading.com/reports-and-labels',
  },
});

export default function ReportsAndLabelsPage() {
  return <ReportsExperience />;
}
