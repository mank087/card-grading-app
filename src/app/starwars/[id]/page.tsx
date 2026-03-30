import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StarWarsCardDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/other/${id}`);
}
