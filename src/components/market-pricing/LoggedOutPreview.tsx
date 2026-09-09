'use client';

import { ActionLink, SectionHeading } from '@/components/design/Primitives';
import CategoryBreakdownChart from '@/components/market-pricing/CategoryBreakdownChart';
import GradeDistributionChart from '@/components/market-pricing/GradeDistributionChart';
import ValueDistributionChart from '@/components/market-pricing/ValueDistributionChart';
import TopSetsChart from '@/components/market-pricing/TopSetsChart';
import PriceSourceChart from '@/components/market-pricing/PriceSourceChart';

/**
 * Logged-out Portfolio preview.
 *
 * Replaces the deleted MarketPricingGate. Same visual treatment (blurred
 * mock dashboard background + foreground feature panel with CTA) but the
 * primary action is now sign-in / create-account, not "Become a Card
 * Lover" — because the Portfolio view itself is free for every DCM user
 * after the gate-removal in commit f6f0c20.
 */

// Static mock data — purely decorative, never comes from any API call.
const MOCK_CATEGORIES = [
  { category: 'Pokemon', count: 42, value: 3840.50, percentage: 38.2 },
  { category: 'Sports', count: 28, value: 2950.00, percentage: 29.3 },
  { category: 'MTG', count: 18, value: 1620.75, percentage: 16.1 },
  { category: 'Lorcana', count: 12, value: 980.25, percentage: 9.7 },
  { category: 'One Piece', count: 8, value: 670.00, percentage: 6.7 },
];

const MOCK_GRADES = [{ grade: '10', count: 8 }, { grade: '9', count: 36 }, { grade: '8', count: 33 }, { grade: '7', count: 18 }, { grade: '6', count: 13 }];

const MOCK_VALUES = [
  { label: '$0-10', count: 18, min: 0.01, max: 10 },
  { label: '$10-25', count: 24, min: 10, max: 25 },
  { label: '$25-50', count: 20, min: 25, max: 50 },
  { label: '$50-100', count: 16, min: 50, max: 100 },
  { label: '$100-250', count: 12, min: 100, max: 250 },
  { label: '$250-500', count: 8, min: 250, max: 500 },
  { label: '$500+', count: 4, min: 500, max: 999999 },
];

const MOCK_SETS = [
  { set: 'Prismatic Evolutions', category: 'Pokemon', value: 1240.00, count: 8 },
  { set: 'Gold Standard Football', category: 'Sports', value: 980.00, count: 5 },
  { set: 'Modern Horizons 3', category: 'MTG', value: 720.50, count: 6 },
  { set: 'The First Chapter', category: 'Lorcana', value: 540.25, count: 4 },
  { set: 'Topps Chrome', category: 'Sports', value: 480.00, count: 7 },
];

const MOCK_SOURCES = [
  { source: 'PriceCharting', count: 78 },
  { source: 'eBay', count: 14 },
  { source: 'Scryfall', count: 10 },
  { source: 'Unpriced', count: 6 },
];

export default function LoggedOutPreview() {
  return <div className="dcm-brand dcm-portfolio-preview">
    <section className="dcm-hero dcm-dark"><div className="dcm-container dcm-hero-grid">
      <div><p className="dcm-eyebrow">Portfolio · Free with your DCM account</p><h1>Your collection.<br /><span>The bigger picture.</span></h1><p className="dcm-lead">Track your graded cards, understand where their value sits and follow price changes since grading. Keep the cards you own and the cards you’ve sold in separate views.</p><div className="dcm-actions"><ActionLink href="/login?mode=login&redirect=/market-pricing">Sign in to view yours</ActionLink><ActionLink href="/login?mode=signup&redirect=/market-pricing" variant="secondary">Create a free account</ActionLink></div><p className="dcm-fineprint">New accounts receive 2 free grading credits.</p></div>
      <div className="dcm-portfolio-example"><p className="dcm-eyebrow">Example portfolio · sample data</p><h2>Where the value lives</h2><CategoryBreakdownChart data={MOCK_CATEGORIES} /><p className="dcm-fineprint">An illustration of the category breakdown. Sign in to see your collection’s values.</p></div>
    </div></section>
    <div role="navigation" className="dcm-container dcm-why-section-nav" aria-label="Portfolio overview"><a href="#portfolio-tools">What you can track</a><a href="#portfolio-charts">Explore the charts</a><a href="#portfolio-pricing">How pricing works</a></div>
    <section id="portfolio-tools" className="dcm-container dcm-section"><SectionHeading eyebrow="Your collection at a glance" title="Know what you hold. See what changes." />
      <div className="dcm-why-plans"><article><h3>Holdings & sold cards</h3><p>Review the value of cards you still own separately from sold cards, so sales and current holdings stay clear.</p></article><article><h3>Value & pricing coverage</h3><p>See total portfolio value, how many cards have pricing data and the average value across priced cards.</p></article><article><h3>Movers & valuable cards</h3><p>Find your most valuable cards and compare current estimates with the values recorded when cards were graded.</p></article></div>
    </section>
    <section id="portfolio-charts" className="dcm-section dcm-surface"><div className="dcm-container"><SectionHeading eyebrow="Explore the portfolio" title="A closer look at your collection.">Interactive examples below use sample data. Your signed-in dashboard also includes value by grade, grade versus value and your most valuable cards.</SectionHeading><div className="dcm-portfolio-preview-charts">
      <article><h3>Grade distribution</h3><GradeDistributionChart data={MOCK_GRADES} /></article><article><h3>Value distribution</h3><ValueDistributionChart data={MOCK_VALUES} /></article><article><h3>Top sets by value</h3><TopSetsChart data={MOCK_SETS} /></article><article><h3>Price data sources</h3><PriceSourceChart data={MOCK_SOURCES} /></article>
    </div></div></section>
    <section id="portfolio-pricing" className="dcm-section dcm-container"><div className="dcm-why-next"><div><SectionHeading eyebrow="Understand the numbers" title="Market context for every decision.">Pricing draws on available card matches from PriceCharting, SportsCardsPro, Scryfall and eBay asking prices. Estimates and active listing prices are not completed sale prices.</SectionHeading><p className="dcm-lead">Prices refresh automatically on a schedule. Card Lovers also have access to on-demand price refreshes. Pricing coverage varies by card.</p><ActionLink href="/card-lovers" variant="text">Explore Card Lovers benefits →</ActionLink></div><div className="dcm-why-note"><h3>Start with your graded cards.</h3><p>Sign in to view your collection and its available pricing. Portfolio access is free for every DCM account.</p><div className="dcm-actions"><ActionLink href="/login?mode=login&redirect=/market-pricing">Open my portfolio</ActionLink><ActionLink href="/get-started" variant="text">How It Works →</ActionLink></div></div></div></section>
  </div>;
}
