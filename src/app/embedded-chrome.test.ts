import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * App-compatibility guard (2026-09-09).
 *
 * Installed iOS/Android builds embed these pages in a WebView and inject
 * `header, nav, footer { display: none !important; }` into EVERY embedded page
 * (dcm-mobile/components/ui/InAppPage.tsx). Those builds cannot be updated
 * before the web deploys, so in-content markup must not use those three tags —
 * a hero, a jump list or a breadcrumb written as <header>/<nav>/<footer>
 * silently disappears for every app user.
 *
 * Accessibility is preserved by role="navigation" / <section>, which the app's
 * element selectors do not match.
 *
 * The real site chrome keeps its tags and is instead marked data-site-chrome so
 * a FUTURE app build can hide exactly that and nothing else.
 */

const root = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

// Files that render in-content markup on routes the app embeds.
const CONTENT_FILES = [
  'components/marketing/LearningExperience.tsx',
  'components/marketing/PricingExperience.tsx',
  'components/marketing/ReportsExperience.tsx',
  'components/design/ReportSectionNav.tsx',
  'components/blog/BlogPagination.tsx',
  'components/blog/TableOfContents.tsx',
  'components/market-pricing/LoggedOutPreview.tsx',
  'components/labelWizard/LabelWizard.tsx',
  'app/why-dcm/page.tsx',
  'app/card-lovers/page.tsx',
  'app/vip/page.tsx',
  'app/pop/page.tsx',
  'app/pop/[category]/page.tsx',
  'app/blog/[slug]/page.tsx',
  'app/blog/category/[category]/page.tsx',
  'app/faq/page.tsx',
  'app/grading-standard/page.tsx',
  'app/market-pricing/page.tsx',
  'app/shop/page.tsx',
  'app/collection/page.tsx',
  'app/lorcana-database/page.tsx',
  'app/mtg-database/page.tsx',
  'app/onepiece-database/page.tsx',
  'app/pokemon-database/page.tsx',
  'app/sports-database/page.tsx',
  'app/starwars-database/page.tsx',
  'app/yugioh-database/page.tsx',
]

describe('embedded-app chrome compatibility', () => {
  it.each(CONTENT_FILES)('%s renders no <header>/<nav>/<footer>', (file) => {
    const src = read(file)
    const offenders = ['<header', '<nav', '<footer'].filter((tag) => src.includes(tag))
    expect(offenders, `${file} uses ${offenders.join(', ')} — the app's injected CSS hides these`).toEqual([])
  })

  it('site chrome is marked so a future app build can target it precisely', () => {
    expect(read('app/ui/Navigation.tsx')).toContain('data-site-chrome="header"')
    expect(read('app/ui/Footer.tsx')).toContain('data-site-chrome="footer"')
    expect(read('components/marketing/FloatingCtaBar.tsx')).toContain('data-site-chrome="floating"')
    expect(read('components/helpbot/HelpBot.tsx')).toContain('data-site-chrome="floating"')
  })

  it('globals.css hides marked chrome only in embedded mode', () => {
    expect(read('app/globals.css')).toContain('html[data-embedded="1"] [data-site-chrome]')
  })

  it('embedded mode is stamped from the app UA or ?app=1', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('DCMGradingApp')
    expect(layout).toContain("setAttribute('data-embedded','1')")
  })
})
