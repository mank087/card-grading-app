import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront } from './data';

/**
 * Org storefront chrome. Deliberately carries NO DCM branding: the header is
 * the org's logo + name, nav is org-only anchors, and the sole platform
 * reference is the required footer line "powered by Dynamic Collectibles
 * Management" with a subtle link to the main domain.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf) return { title: 'Not found', robots: { index: false, follow: false } };
  const description =
    sf.content.tagline ||
    (sf.content.description ? sf.content.description.slice(0, 155) : `${sf.org.name}: trading cards professionally graded and encapsulated in-store, with serialized labels you can verify online.`);
  const canonical = `https://www.dcmgrading.com/enterprise/${slug}`;
  return {
    // Org pages carry the ORG's identity — no DCM title template or branding.
    title: { absolute: `${sf.org.name} — Professional Card Grading` },
    description,
    keywords: [sf.org.name, 'card grading', 'graded cards', 'trading card grading', 'card shop'],
    // Full override — icon, shortcut, AND apple — so no DCM icon variant from
    // the root metadata survives the merge on org pages.
    icons: {
      icon: [{ url: `/enterprise/${slug}/favicon`, type: 'image/png' }],
      shortcut: `/enterprise/${slug}/favicon`,
      apple: [{ url: `/enterprise/${slug}/favicon` }],
    },
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${sf.org.name} — Professional Card Grading`,
      description,
      url: canonical,
      siteName: sf.org.name,
      type: 'website',
      images: sf.logos.color ? [{ url: sf.logos.color, width: 1200, height: 1200, alt: `${sf.org.name} logo` }] : undefined,
    },
    twitter: { card: 'summary', title: `${sf.org.name} — Professional Card Grading`, description },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();

  const brand = sf.org.brand_color || '#7C3AED';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ ['--brand' as any]: brand }}>
      {/* Header — org only */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href={`/enterprise/${slug}`} className="flex items-center gap-3 min-w-0">
            {sf.logos.color && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sf.logos.color} alt={`${sf.org.name} logo`} className="h-9 w-9 object-contain shrink-0" />
            )}
            <span className="font-bold text-gray-900 truncate">{sf.org.name}</span>
          </a>
          <nav className="flex items-center gap-5 text-sm text-gray-600">
            <a href={`/enterprise/${slug}#about`} className="hover:text-gray-900 hidden sm:inline">About</a>
            <a href={`/enterprise/${slug}#verify`} className="hover:text-gray-900">Verify a Card</a>
            <a href={`/enterprise/${slug}#contact`} className="hover:text-gray-900">Contact</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer — the single platform reference, kept subtle. The copyright
          belongs to the ORG (their name, logo, photos, and copy are their
          content); the disclaimer line makes explicit that the org and the
          platform are unaffiliated businesses. */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col gap-2 text-sm text-gray-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; {new Date().getFullYear()} {sf.content.legal_name || sf.org.name}. All rights reserved.</span>
            <span>
              powered by{' '}
              <a
                href="https://www.dcmgrading.com"
                className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dynamic Collectibles Management
              </a>
            </span>
          </div>
          <p className="text-xs text-gray-400 text-center sm:text-left">
            {sf.org.name} is an independently owned and operated business. Dynamic Collectibles
            Management LLC provides the grading technology and this storefront platform, and is not
            affiliated with, and does not endorse or operate, {sf.content.legal_name || sf.org.name}.
          </p>
        </div>
      </footer>
    </div>
  );
}
