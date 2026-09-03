/**
 * /instalist-marketplace/bulk/[batchId] — the bulk listing review page.
 *
 * Server shell only. The flag is checked here as well as in the API so a
 * disabled feature does not render a shell that then 404s on its first fetch.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BulkBatchClient from './BulkBatchClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review your batch | DCM InstaList',
  robots: { index: false, follow: false },
};

export default async function BulkBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  if (process.env.EBAY_BULK_ENABLED !== 'true') notFound();
  const { batchId } = await params;
  return <BulkBatchClient batchId={batchId} />;
}
