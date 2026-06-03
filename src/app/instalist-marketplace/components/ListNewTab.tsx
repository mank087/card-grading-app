import Link from 'next/link';
import CardPicker from './CardPicker';
import type { MarketplaceCard } from '../types';

interface Props {
  cards: MarketplaceCard[];
  truncated?: boolean;
  onSelectCard: (card: MarketplaceCard) => void;
}

/**
 * "List a Card" tab. Left rail = card picker, right area = explainer/empty state.
 * On select, parent opens the EbayListingModal — same modal the card-detail page uses.
 */
export default function ListNewTab({ cards, truncated, onSelectCard }: Props) {
  if (cards.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          You&rsquo;ve listed all your graded cards.
        </h2>
        <p className="text-gray-600 mb-6">
          Grade more cards to keep your eBay store full.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
        >
          Grade a new card
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        {truncated && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Showing your 500 most recently graded cards. Older ones aren&rsquo;t in this picker — use search to narrow down.
          </div>
        )}
        <CardPicker cards={cards} onSelect={onSelectCard} />
      </div>
      <div className="lg:col-span-2">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Pick a card to list</h2>
          <p className="text-gray-600 mb-6 text-sm">
            Select a card from the list on the left. We&rsquo;ll open the same eBay listing
            flow you use on the card detail page — graded label images, mini grading report,
            raw photos, and gallery uploads all included.
          </p>

          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
            What gets generated for each listing
          </h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <Check />
              <span>Front and back graded label images (modern or traditional style)</span>
            </li>
            <li className="flex gap-3">
              <Check />
              <span>DCM mini grading report image (sub-scores + summary)</span>
            </li>
            <li className="flex gap-3">
              <Check />
              <span>Raw front and back photos of your card</span>
            </li>
            <li className="flex gap-3">
              <Check />
              <span>Add your own photos from gallery upload</span>
            </li>
            <li className="flex gap-3">
              <Check />
              <span>Auto-suggested title and price (from market median)</span>
            </li>
            <li className="flex gap-3">
              <Check />
              <span>DCM grader certification fields baked into eBay item specifics</span>
            </li>
          </ul>

          <p className="text-xs text-gray-400 mt-6">
            Cards already with an active listing are hidden from the list automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mt-0.5">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
