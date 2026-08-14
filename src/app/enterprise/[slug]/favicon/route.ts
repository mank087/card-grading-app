import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Stable favicon URL for an org storefront: serves the org's color logo from
 * storage. Referenced from the storefront metadata (icons) — a stable route
 * instead of a signed URL so cached HTML never points at an expired link.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: org } = await s
    .from('organizations')
    .select('logo_path, status, storefront_enabled')
    .eq('slug', slug)
    .maybeSingle();
  if (!org?.logo_path || org.status !== 'active' || !(org as any).storefront_enabled) {
    return new NextResponse(null, { status: 404 });
  }
  const { data: file, error } = await s.storage.from('org-assets').download(org.logo_path);
  if (error || !file) return new NextResponse(null, { status: 404 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = org.logo_path.endsWith('.webp') ? 'image/webp' : org.logo_path.endsWith('.jpg') || org.logo_path.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  return new NextResponse(buf, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
