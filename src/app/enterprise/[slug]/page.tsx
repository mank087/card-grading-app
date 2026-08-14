import { notFound } from 'next/navigation';
import { getStorefront, orgBrandPalette } from './data';
import StorefrontSlabMock from './StorefrontSlabMock';
import StorefrontRecentCards from './StorefrontRecentCards';
import SerialLookup from './SerialLookup';
import { DEFAULT_HOW_IT_WORKS, DEFAULT_FAQS, DEFAULT_ABOUT_TITLE, DEFAULT_ABOUT_BULLETS } from '@/lib/storefrontDefaults';
import { orgSerialPrefix } from '@/lib/organizations';

export const revalidate = 300;

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const c = sf.content;
  const brand = sf.org.brand_color || '#7C3AED';
  // 1–5 admin-chosen colors; a single pick renders as a solid band (the
  // heritage renderer expects at least two stops, so it gets duplicated).
  // Empty = "brand default" = the ORG's brand palette, not DCM's.
  const picked = (c.slab?.colors || []).filter(Boolean);
  const brandSet = orgBrandPalette(sf.org);
  const slabColors =
    picked.length >= 2 ? picked.slice(0, 5)
    : picked.length === 1 ? [picked[0], picked[0]]
    : brandSet.length >= 2 ? brandSet
    : [brandSet[0], brandSet[0]];
  const socials = Object.entries(c.socials || {}).filter(([, v]) => v);
  // Hero logo: color on a light chip by default — the white silhouette washed
  // out on light brand gradients; it stays available as an explicit choice.
  const heroLogo = c.hero_logo ?? 'color';
  const photoFit = c.photo_display === 'fit';
  // Undefined = shared defaults; explicit empty array = store hid the section.
  const howItWorks = c.how_it_works ?? DEFAULT_HOW_IT_WORKS;
  const faqs = c.faqs ?? DEFAULT_FAQS;
  const aboutTitle = c.about_title?.trim() || DEFAULT_ABOUT_TITLE;
  const aboutBullets = c.about_bullets ?? DEFAULT_ABOUT_BULLETS;
  const serialPrefix = orgSerialPrefix(sf.org);

  return (
    <div>
      {/* Hero */}
      {/* Hero gradient blends the first two brand colors (second falls back
          to dark slate when the palette has only one). */}
      <section className="text-white py-16" style={{ background: `linear-gradient(135deg, ${brandSet[0]}, ${brandSet[1] ?? '#111827'} 70%, #111827)` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {heroLogo === 'white' && sf.logos.white && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sf.logos.white} alt={`${sf.org.name} logo`} className="h-20 mx-auto mb-6 object-contain" />
          )}
          {heroLogo === 'color' && sf.logos.color && (
            <div className="inline-flex bg-white/95 rounded-2xl p-3 mb-6 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sf.logos.color} alt={`${sf.org.name} logo`} className="h-16 w-16 object-contain" />
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">{sf.org.name}</h1>
          {c.tagline && <p className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto">{c.tagline}</p>}
          <a href="#verify" className="inline-block mt-8 px-8 py-3 bg-white rounded-lg font-semibold" style={{ color: brand }}>
            Verify a Graded Card
          </a>
        </div>
      </section>

      {/* About + slab mockup */}
      <section id="about" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{aboutTitle}</h2>
          {c.description ? (
            <p className="text-gray-600 whitespace-pre-line leading-relaxed">{c.description}</p>
          ) : (
            <p className="text-gray-600 leading-relaxed">
              {sf.org.name} grades and encapsulates trading cards in-house, with sub-grades for centering,
              corners, edges, and surface, sealed under a serialized label you can verify right on this page.
            </p>
          )}
          {aboutBullets.length > 0 && (
            <ul className="mt-6 space-y-2 text-gray-700 text-sm">
              {aboutBullets.slice(0, 5).map((b, i) => (
                <li key={i}>✓ {b}</li>
              ))}
            </ul>
          )}
        </div>
        <StorefrontSlabMock
          orgName={sf.org.name}
          logoHref={sf.logos.color}
          pattern={c.slab?.pattern || 'diamond'}
          bandColors={slabColors}
          labelStyle={c.slab?.label_style || 'heritage'}
          serialPrefix={serialPrefix}
        />
      </section>

      {/* How it works */}
      {howItWorks.length > 0 && (
        <section className="bg-white py-16 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">How it works</h2>
            <div className={`grid gap-8 sm:grid-cols-2 ${howItWorks.length >= 4 ? 'lg:grid-cols-4' : howItWorks.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {howItWorks.slice(0, 6).map((step, i) => (
                <div key={i} className="text-center">
                  <div
                    className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: brand }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently graded — optional, admin-toggled */}
      {sf.recentCards.length > 0 && (
        <section className="py-16 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Recently Graded Cards</h2>
            <p className="text-gray-600 mb-8 text-center">The latest cards graded and encapsulated by {sf.org.name}.</p>
            <StorefrontRecentCards
              slug={slug}
              cards={sf.recentCards}
              pattern={c.slab?.pattern || 'diamond'}
              bandColors={slabColors}
              orgLogoColor={sf.logos.color}
            />
          </div>
        </section>
      )}

      {/* Store photos */}
      {sf.photoUrls.length > 0 && (
        <section className="bg-white py-16 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className={`grid gap-4 ${sf.photoUrls.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : sf.photoUrls.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {sf.photoUrls.map((url, i) => (
                photoFit ? (
                  <div key={i} className="h-56 rounded-xl shadow-sm bg-gray-100 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${sf.org.name} store photo ${i + 1}`} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`${sf.org.name} store photo ${i + 1}`} className="w-full h-56 object-cover rounded-xl shadow-sm" />
                )
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Serial lookup */}
      <section id="verify" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center relative">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify a card we graded</h2>
        <p className="text-gray-600 mb-8">Every slab we seal carries a serial number. Enter it to see the card&apos;s grade and report.</p>
        <SerialLookup slug={slug} serialPrefix={serialPrefix} />
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section id="faq" className="bg-gray-50 py-16 border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently asked questions</h2>
            <div className="space-y-3">
              {faqs.slice(0, 10).map((f, i) => (
                <details key={i} className="group bg-white rounded-xl shadow-sm border border-gray-100">
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 font-medium text-gray-900">
                    {f.q}
                    <span className="text-gray-400 transition-transform group-open:rotate-45 shrink-0" aria-hidden>+</span>
                  </summary>
                  <p className="px-5 pb-4 text-gray-600 text-sm leading-relaxed whitespace-pre-line">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Visit us</h3>
            {c.address ? <p className="text-gray-600 whitespace-pre-line">{c.address}</p> : <p className="text-gray-400">Address coming soon</p>}
            {c.hours && <p className="text-gray-600 mt-3 whitespace-pre-line">{c.hours}</p>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Get in touch</h3>
            {c.phone && <p className="text-gray-600">{c.phone}</p>}
            {c.public_email && <p><a href={`mailto:${c.public_email}`} className="text-gray-600 hover:underline">{c.public_email}</a></p>}
            {c.website && <p><a href={c.website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: brand }}>{c.website.replace(/^https?:\/\//, '')}</a></p>}
            {!c.phone && !c.public_email && !c.website && <p className="text-gray-400">Contact details coming soon</p>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Follow</h3>
            {socials.length > 0 ? (
              <ul className="space-y-1">
                {socials.map(([k, v]) => (
                  <li key={k}><a href={v as string} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline capitalize">{k}</a></li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">Social links coming soon</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
