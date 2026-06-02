import { Metadata } from 'next';
import MarketplaceClient from './MarketplaceClient';

export const metadata: Metadata = {
  title: 'InstaList Marketplace — DCM Grading',
  description: 'List your DCM-graded cards on eBay and track your sales, views, and watchers. Same account, same credits, same Label Studio.',
  openGraph: {
    title: 'InstaList Marketplace | DCM Grading',
    description: 'Manage your eBay listings for DCM-graded cards in one place.',
    type: 'website',
  },
};

export default function InstaListMarketplacePage() {
  return <MarketplaceClient />;
}
