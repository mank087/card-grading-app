'use client';

/**
 * The category-agnostic card detail page (V2).
 *
 * Eight category adapters will feed this one shell. An adapter supplies the
 * data hook's result, the view model, the label-style wiring and the handful
 * of genuinely category-specific nodes (the pricing component, the marketplace
 * search links, the download button, the share payload). Nothing in here reads
 * a category-specific column.
 *
 * LOADING / ERROR / NOT-FOUND / RE-GRADE states follow the legacy pokemon
 * client (CardDetailClient.tsx 2118-2225): the animated re-grade screen when a
 * re-grade is in flight, the private-card page for a 403, the generic
 * "Card Not Available" page for anything else, and the not-found page when the
 * fetch succeeded with nothing. The one deliberate difference is the initial
 * load: legacy returns `null` (a blank page); this renders a small skeleton,
 * because a blank white page is not an acceptable first paint for a redesign.
 *
 * OWNERSHIP is the legacy client-side check, reproduced and not widened. It is
 * open code-audit gap G6 and this page adds no new owner-only surface that
 * lacks a server check — `MarkAsSoldButton`, `CardBinderPicker`, the delete
 * and visibility endpoints and `DownloadReportButton` all authenticate
 * themselves.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import type { UseCardDetailResult } from './useCardDetail';
import type { CardDetailSectionId } from '@/lib/cardDetail/anchorMap';
import type { SavedCustomStyle, CustomLabelConfig } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import type { CardSharingData } from '@/lib/socialUtils';
import {
  generateFacebookShareUrl,
  generateTwitterShareUrl,
  openSocialShare,
  copyToClipboard,
} from '@/lib/socialUtils';

import CardAnalysisAnimation from '@/app/upload/sports/CardAnalysisAnimation';
import ImageZoomModal from '@/app/pokemon/[id]/ImageZoomModal';
import { SoldBanner } from '@/components/cards/SoldBanner';
import { MarkAsSoldButton } from '@/components/cards/MarkAsSoldButton';
import { CardBinderPicker } from '@/components/binders/CardBinderPicker';
import { EditCardLabelModal } from '@/components/EditCardLabelModal';
import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { FirstGradeCongratsModal } from '@/components/conversion/FirstGradeCongratsModal';
import { LowCreditsBottomBanner } from '@/components/conversion/LowCreditsBottomBanner';
import { PostResultOffer, usePostResultOfferEligible } from '@/components/conversion/PostResultOffer';
import { ActionLink } from '@/components/design/Primitives';
import { useCredits } from '@/contexts/CreditsContext';
import { getStoredSession } from '@/lib/directAuth';

import CardLabelShowcase, { type CardSide } from './CardLabelShowcase';
import {
  LabelsHoldersSection,
  OverviewHoldersBand,
} from './holders/HolderSections';
import type { CardHolderId } from '@/lib/cardDetail/holderSupport';
import { buildLabelStudioHref } from '@/lib/cardDetail/labelStudioLink';

/**
 * The hero's label + card piece. It pulls in every label renderer (the
 * Heritage and Classic SVGs, the Modern DOM labels), so it loads on demand;
 * `ssr: false` because the Heritage QR effect and ScaleToFit measure the DOM.
 */
const CardLabelPiece = dynamic(() => import('./holders/CardLabelPiece'), {
  ssr: false,
  loading: () => <div className="cd-label-piece cd-label-piece--loading" />,
});

/**
 * The holder compositions, which additionally pull in the holder photos and
 * (for Heritage) the compact canvas renderers. They sit well below the fold
 * and must never block the hero's first paint, so they load on demand too and
 * each card mounts only when it is near the viewport (HolderCards).
 */
const HolderComposition = dynamic(() => import('./holders/HolderComposition'), {
  ssr: false,
  loading: () => <div className="cd-holder-composition cd-holder-composition--loading" />,
});
import GradeSummary from './GradeSummary';
import CardValueSummary from './CardValueSummary';
import InstaListPanel from './InstaListPanel';
import GradeHighlights from './GradeHighlights';
import CardFacts from './CardFacts';
import GradeDetailsSection from './sections/GradeDetailsSection';
import {
  CardDetailSectionNav,
  CardDetailSections,
  useCardDetailSectionRouting,
} from './CardDetailSections';
import './card-detail.css';

type EbayCardType = 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';

/** What an adapter needs to render its own Card Information fields. */
export interface CategoryCardInfoContext {
  card: any;
  currentUserId: string | null | undefined;
  isOwner: boolean;
  onEdited: () => void;
}

export interface CardDetailShellProps {
  category: CardDetailCategory;
  /** "Pokémon" — how the breadcrumb and the copy name this category. */
  categoryLabel: string;
  cardId: string;
  /** Where "back" goes when there is no richer originating context. */
  backHref: string;
  /** The category's upload route, used by the not-found page as legacy does. */
  uploadHref: string;
  ebayCardType: EbayCardType;

  detail: UseCardDetailResult;
  /** Null until the card has loaded. */
  vm: CardDetailViewModel | null;

  /* Label style — `useCustomLabelStyleWithOrg(card.org_id)` in the adapter. */
  labelStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  activeConfig: CustomLabelConfig | null;
  colorOverrides: unknown;
  heritageBandColors: string[];
  onSwitchStyle: (id: LabelStyleId) => void;

  /* Category slots. Functions, not nodes, because several mount twice. */
  renderDownloadButton: () => ReactNode;
  renderPricing: () => ReactNode;
  renderMarketplaceLinks: () => ReactNode;
  /** The PSA/BGS/SGC/CGC mail-away estimates, mounted in the Market section. */
  renderProEstimates?: () => ReactNode;
  /**
   * The category's own Card Information fields, rendered inside the shared
   * `CardFacts` panel. Pokemon supplies `PokemonCardInfo` here.
   */
  renderCategoryCardInfo?: (ctx: CategoryCardInfoContext) => ReactNode;
  /** The category's own Special Features badges. */
  renderCategoryBadges?: () => ReactNode;
  /**
   * PHASE 2. One trigger that opens ONE holder's existing download flow
   * (`DownloadReportButton`'s additive `holderDownload` prop). Owner-only, as
   * legacy. Without it the hero falls back to the full download menu.
   */
  renderHolderDownload?: (holder: CardHolderId) => ReactNode;

  /**
   * Where "retake your photos" goes. Legacy pokemon uses
   * `/upload?category=Pokemon`, which is not `uploadHref`. Defaults to
   * `uploadHref` when an adapter has nothing more specific.
   */
  retakeHref?: string;

  /** A trusted live estimate, already through `assessValueTrust`. */
  liveEstimate: number | null;
  /** Low / median / high from the live price match; null until it reports. */
  marketRange?: { low: number; median: number; high: number } | null;
  /** `extractConditionSummary(card.conversational_grading)`, or null. */
  conditionSummary: string | null;
  shareData: CardSharingData;
}

function LoadingSkeleton() {
  return (
    <main className="dcm-brand dcm-card-detail">
      <div className="cd-container" style={{ paddingBlock: 48 }}>
        <p role="status" aria-live="polite" className="cd-caption">
          Loading this card…
        </p>
        <div
          aria-hidden="true"
          className="cd-hero"
          style={{ marginTop: 24 }}
        >
          <div className="cd-showcase" style={{ minHeight: 420 }} />
          <div className="cd-hero-summary">
            <div className="cd-panel" style={{ minHeight: 120 }} />
            <div className="cd-panel" style={{ minHeight: 180 }} />
          </div>
        </div>
      </div>
    </main>
  );
}

export function CardDetailShell(props: CardDetailShellProps) {
  const {
    category,
    categoryLabel,
    cardId,
    backHref,
    uploadHref,
    ebayCardType,
    detail,
    vm,
    labelStyle,
    customStyles,
    activeConfig,
    colorOverrides,
    heritageBandColors,
    onSwitchStyle,
    renderDownloadButton,
    renderPricing,
    renderMarketplaceLinks,
    renderProEstimates,
    renderCategoryCardInfo,
    renderCategoryBadges,
    renderHolderDownload,
    retakeHref,
    liveEstimate,
    marketRange,
    conditionSummary,
    shareData,
  } = props;

  const { card, loading, isProcessing, error, regradingImageUrl } = detail;
  const { balance, isFirstPurchase, isLoading: creditsLoading } = useCredits();

  const routing = useCardDetailSectionRouting();
  const [side, setSide] = useState<CardSide>('front');
  const [zoom, setZoom] = useState({ isOpen: false, imageUrl: '', alt: '', title: '' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRegradeConfirm, setShowRegradeConfirm] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [showEditLabelModal, setShowEditLabelModal] = useState(false);
  const [showFirstGradeModal, setShowFirstGradeModal] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  // The anchor the page was last asked to jump to. Grade details reads it to
  // select the matching evidence tab; `replaceState` fires no hashchange, so
  // handing it over directly is the only way the section learns.
  const [jumpAnchor, setJumpAnchor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Same rule as legacy: one ask per page for an empty balance.
  const postResultOfferEligible = usePostResultOfferEligible({
    ownerId: card?.user_id ?? null,
    gradeComplete: !loading && typeof card?.grade === 'number' && (card.grade ?? 0) > 0,
    orgId: (card as { org_id?: string | null } | null)?.org_id ?? null,
  });

  // Owner only, balance 0, and not already covered by the post-result offer.
  useEffect(() => {
    if (card && !loading && balance === 0 && !postResultOfferEligible) {
      const session = getStoredSession();
      if (session?.user?.id && card.user_id && session.user.id === card.user_id) {
        setShowFirstGradeModal(true);
      }
    }
  }, [card, loading, balance, postResultOfferEligible]);

  // Close the more-actions menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // ── States, in the legacy order ────────────────────────────────────────

  if (regradingImageUrl && (loading || isProcessing)) {
    return (
      <CardAnalysisAnimation
        frontImageUrl={regradingImageUrl}
        cardName={`${categoryLabel} Card`}
        allowNavigation
      />
    );
  }

  if (loading || isProcessing) return <LoadingSkeleton />;

  if (error) {
    if (error === 'PRIVATE_CARD') {
      return (
        <main className="dcm-brand dcm-card-detail">
          <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
            <h1 style={{ fontSize: 34, fontWeight: 750, letterSpacing: '-.03em' }}>
              This card is private
            </h1>
            <p className="dcm-lead">Only the owner can view this card.</p>
            <ul className="cd-caption" style={{ marginTop: 16, paddingLeft: 20 }}>
              <li>This card has been set to private by its owner.</li>
              <li>Private cards are not visible to other collectors.</li>
              <li>Private cards cannot be searched, and shared links stop working.</li>
            </ul>
            <div className="dcm-actions" style={{ marginTop: 28 }}>
              <Link className="dcm-button dcm-button--primary" href="/login">
                Log in
              </Link>
              <Link className="dcm-button dcm-button--secondary" href="/collection">
                View your collection
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="dcm-brand dcm-card-detail">
        <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
          <h1 style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-.03em' }}>
            Card not available
          </h1>
          <p className="dcm-lead">
            This card no longer exists or is not viewable at this moment.
          </p>
          <div className="dcm-actions" style={{ marginTop: 28 }}>
            <Link className="dcm-button dcm-button--primary" href="/collection">
              My collection
            </Link>
            <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
              Grade a card
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!card || !vm) {
    return (
      <main className="dcm-brand dcm-card-detail">
        <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
          <h1 style={{ fontSize: 30, fontWeight: 750 }}>{categoryLabel} card not found</h1>
          <div className="dcm-actions" style={{ marginTop: 24 }}>
            <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
              Back to {categoryLabel} upload
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── The page ───────────────────────────────────────────────────────────

  const isOwner = detail.isOwner;
  const isSold = vm.permissions.isSold;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  // ── holder showcase (Phase 2) ──────────────────────────────────────────
  /** The QR / verify destination, built exactly as legacy does (2680). */
  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${category}/${cardId}`
      : `https://dcmgrading.com/${category}/${cardId}`;

  /** Legacy's own rule for the on-screen back label (3075-3080). */
  const labelSubScores = card.conversational_sub_scores
    ? {
        centering: card.conversational_sub_scores.centering?.weighted ?? 0,
        corners: card.conversational_sub_scores.corners?.weighted ?? 0,
        edges: card.conversational_sub_scores.edges?.weighted ?? 0,
        surface: card.conversational_sub_scores.surface?.weighted ?? 0,
      }
    : null;

  const returnPath = `/${category}/${cardId}`;
  const labelStudioHref = (forHolder?: CardHolderId) =>
    buildLabelStudioHref(vm.identity.serial, {
      holder: forHolder,
      style: labelStyle,
      returnPath,
    });

  /** Shared by the hero piece and the three holder compositions. */
  const artworkProps = {
    card,
    frontUrl: vm.images.front.url,
    backUrl: vm.images.back.url,
    cardName: vm.identity.displayName,
    labelData: vm.labelData,
    labelStyle,
    activeConfig,
    colorOverrides: colorOverrides as never,
    heritageBandColors,
    orgLogos: detail.orgLogos,
    subScores: labelSubScores,
    emblems: detail.emblems,
    verifyUrl,
  };

  /**
   * Everything the two holder sections need, assembled once. There is no
   * holder SELECTION state: nothing in the hero depends on a holder any more,
   * so each card is self-contained and the mockup owns its own front/back.
   */
  const holderSectionProps = {
    labelStyle,
    activeConfig,
    isOwner,
    labelStudioHref,
    renderHolderDownload,
    renderComposition: (which: CardHolderId, maxWidth: number) => (
      <HolderComposition {...artworkProps} holder={which} maxWidth={maxWidth} />
    ),
  };
  const anyModalOpen =
    zoom.isOpen ||
    showDeleteModal ||
    showRegradeConfirm ||
    showInsufficientCredits ||
    showEditLabelModal ||
    showFirstGradeModal ||
    showOnboardingTour;
  const showMobileBar = isOwner && !anyModalOpen;

  const openZoom = (imageUrl: string, alt: string, title: string) =>
    setZoom({ isOpen: true, imageUrl, alt, title });

  const jumpTo = (id: CardDetailSectionId, anchorId?: string) => {
    setJumpAnchor(anchorId ?? null);
    routing.selectSection(id, anchorId);
  };

  // No menu item calls this, on purpose. The legacy clients keep the re-grade
  // handler and modals but removed the button, so V2 offers no re-grade entry
  // point either. Wiring one up is a product decision, not a parity fix.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRegradeClick = () => {
    setMenuOpen(false);
    // Legacy's gate: under one credit, offer the top-up instead of the confirm.
    if (!detail.canRegrade) {
      setShowInsufficientCredits(true);
      return;
    }
    setShowRegradeConfirm(true);
  };

  const handleVisibilityClick = () => {
    // The confirm exists only in the public → private direction, as legacy.
    if (detail.visibility === 'public') {
      const confirmed = window.confirm(
        '⚠️ Make this card private?\n\n' +
          '🔒 Only you will be able to view this card\n' +
          '🔒 Card will NOT be searchable by anyone\n' +
          '🔒 Shared links will stop working\n\n' +
          'Continue?'
      );
      if (!confirmed) return;
    }
    detail.toggleVisibility();
  };

  const refreshAfterEdit = () => window.location.reload();

  return (
    <main className="dcm-brand dcm-card-detail" data-mobile-bar={showMobileBar}>
      {/* The tour's caption card is fixed to the top of the screen and the tour
          scrolls each target to just below it. The first targets (visibility
          row, card images) sit at the very top of the page, where there is no
          scroll distance to give, so they ended up underneath the caption.
          This spacer gives the page that distance while the tour runs. */}
      {showOnboardingTour && <div className="cd-tour-spacer" aria-hidden="true" />}
      <div className="cd-container">
        {/* ── breadcrumb ─────────────────────────────────────────────── */}
        <div className="cd-breadcrumb">
          <Link className="dcm-button dcm-button--text" href={backHref}>
            ← My collection
          </Link>
          <span aria-hidden="true">/</span>
          <span>{categoryLabel}</span>
          <span aria-hidden="true">/</span>
          <span className="cd-crumb-name">{vm.identity.displayName}</span>

          <div className="cd-record-actions" id="tour-visibility-toggle">
            {isOwner ? (
              <button
                type="button"
                className="cd-quiet"
                onClick={handleVisibilityClick}
                disabled={detail.isTogglingVisibility}
                title={
                  detail.visibility === 'public'
                    ? 'This card is public (click to make private)'
                    : 'This card is private (click to make public)'
                }
              >
                <span
                  className="cd-status-dot"
                  data-private={detail.visibility !== 'public'}
                  aria-hidden="true"
                />
                {detail.isTogglingVisibility
                  ? 'Updating…'
                  : detail.visibility === 'public'
                    ? 'Public card'
                    : 'Private card'}
              </button>
            ) : (
              <span className="cd-caption">
                {detail.visibility === 'public' ? 'Public card' : 'Private card'}
              </span>
            )}

            {/* The compact style switcher legacy keeps in this same row. */}
            {isOwner && (
              <LabelStyleDropdown
                labelStyle={labelStyle}
                customStyles={customStyles}
                onSwitch={onSwitchStyle}
                compact
              />
            )}

            {/* Legacy keeps this in the page header; it is not owner-gated. */}
            <button
              type="button"
              className="cd-quiet"
              title="Take a guided tour of this page"
              onClick={() => {
                try {
                  localStorage.removeItem('dcm_onboarding_tour_completed');
                  localStorage.removeItem('dcm_onboarding_tour_started');
                } catch {
                  /* Private mode: the tour still runs, it just re-offers later. */
                }
                setShowOnboardingTour(true);
              }}
            >
              Page tour
            </button>

            <div className="cd-menu-wrap">
              <button
                type="button"
                className="cd-quiet"
                aria-expanded={shareOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setShareOpen((v) => !v);
                  setMenuOpen(false);
                }}
              >
                Share
              </button>
              {shareOpen && (
                <div className="cd-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="cd-menu-item"
                    onClick={() => {
                      openSocialShare(generateFacebookShareUrl(shareData, isOwner));
                      setShareOpen(false);
                    }}
                  >
                    Share on Facebook
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="cd-menu-item"
                    onClick={() => {
                      openSocialShare(generateTwitterShareUrl(shareData, isOwner));
                      setShareOpen(false);
                    }}
                  >
                    Share on X
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="cd-menu-item"
                    onClick={async () => {
                      const ok = await copyToClipboard(currentUrl);
                      window.alert(ok ? '✅ Link copied to clipboard!' : '❌ Failed to copy link. Please try again.');
                      setShareOpen(false);
                    }}
                  >
                    Copy link
                  </button>
                  <p className="cd-menu-note">DCM serial {vm.identity.serial}</p>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="cd-menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="cd-quiet"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="More card actions"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setShareOpen(false);
                  }}
                >
                  •••
                </button>
                {menuOpen && (
                  <div className="cd-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="cd-menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowEditLabelModal(true);
                      }}
                    >
                      Edit card label
                    </button>
                    <a
                      role="menuitem"
                      className="cd-menu-item"
                      href={`/labels?card=${encodeURIComponent(vm.identity.serial)}`}
                    >
                      Customize in Label Studio
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      className="cd-menu-item cd-menu-item--danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowDeleteModal(true);
                      }}
                    >
                      Delete card from collection
                    </button>
                    <p className="cd-menu-note">
                      Mark as sold and binder actions sit at the foot of the page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sold: the record is locked and stays online for the buyer. */}
        {isSold && (
          <SoldBanner
            cardId={card.id}
            soldAt={card.sold_at}
            soldPrice={card.sold_price}
            soldChannel={card.sold_channel}
            soldNote={card.sold_note}
            isOwner={isOwner}
          />
        )}

        {/* ── hero ───────────────────────────────────────────────────── */}
        <div className="cd-hero">
          <CardLabelShowcase
            vm={vm}
            side={side}
            onSideChange={setSide}
            onZoom={openZoom}
            labelStyle={labelStyle}
            customStyles={customStyles}
            onSwitchStyle={onSwitchStyle}
            downloadAction={renderDownloadButton()}
            onEditLabel={() => setShowEditLabelModal(true)}
            isOwner={isOwner}
            customizeHref={labelStudioHref()}
            renderCardPiece={({ side: pieceSide }) => (
              <CardLabelPiece
                {...artworkProps}
                side={pieceSide}
                imageUrl={
                  pieceSide === 'front' ? vm.images.front.url : vm.images.back.url
                }
                imageAlt={`${vm.identity.displayName} card ${pieceSide}`}
                priority={pieceSide === 'front'}
                onZoom={() => {
                  const img = pieceSide === 'front' ? vm.images.front : vm.images.back;
                  if (img.present && img.url) {
                    // ALWAYS the original photo, never the composition.
                    openZoom(
                      img.url,
                      `${vm.identity.displayName} card ${pieceSide}`,
                      `Card ${pieceSide === 'front' ? 'Front' : 'Back'} — full size`,
                    );
                  }
                }}
              />
            )}
          />

          <div className="cd-hero-summary">
            <div className="cd-identity">
              <div className="cd-identity-tags">
                <span className="cd-tag">{categoryLabel}</span>
                {vm.identity.contextLine && <span>{vm.identity.contextLine}</span>}
                <span className="cd-serial">#{vm.identity.serial}</span>
              </div>
              <h1>{vm.identity.displayName}</h1>
              {(vm.identity.cardNumberFormatted || vm.identity.language || vm.identity.rarityOrVariant) && (
                <p className="cd-subtitle">
                  {[vm.identity.cardNumberFormatted, vm.identity.rarityOrVariant, vm.identity.language]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>

            <GradeSummary
              vm={vm}
              conditionSummary={conditionSummary}
              onJumpToGrade={(anchorId) => jumpTo('grade', anchorId)}
            />

            <CardValueSummary
              value={vm.value}
              liveEstimate={liveEstimate}
              marketRange={marketRange ?? null}
              isOwner={isOwner}
              onJumpToMarket={() => jumpTo('market')}
            />

            <InstaListPanel
              card={card}
              cardId={cardId}
              cardType={ebayCardType}
              isOwner={isOwner}
              isSold={isSold}
              showFounderEmblem={detail.emblems.showFounderEmblem}
              labelStyle={labelStyle}
              customLabelConfig={activeConfig}
            />
          </div>
        </div>

        {/* ── sections ───────────────────────────────────────────────── */}
        <CardDetailSectionNav active={routing.active} onSelect={(id) => jumpTo(id)} />

        <CardDetailSections
          active={routing.active}
          overview={
            <div className="cd-section">
              <div className="cd-section-title">
                <p className="cd-eyebrow">The grade, at a glance</p>
                <h2>What we found on your card.</h2>
                <p>The findings behind each subgrade, then the record behind the label.</p>
              </div>
              <GradeHighlights
                vm={vm}
                card={card}
                conditionSummary={conditionSummary}
                onJumpToGrade={(anchorId) => jumpTo('grade', anchorId)}
              />
              <OverviewHoldersBand {...holderSectionProps} onSeeAll={() => jumpTo('labels')} />

              <div className="cd-two-col" style={{ marginTop: 20 }}>
                <CardFacts
                  vm={vm}
                  card={card}
                  currentUserId={getStoredSession()?.user?.id}
                  isOwner={isOwner}
                  onEdited={refreshAfterEdit}
                  categorySlot={renderCategoryCardInfo?.({
                    card,
                    currentUserId: getStoredSession()?.user?.id,
                    isOwner,
                    onEdited: refreshAfterEdit,
                  })}
                  categoryBadges={renderCategoryBadges?.()}
                />
                <section className="cd-panel">
                  <p className="cd-eyebrow">The whole picture</p>
                  <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Your grade, explained.</h3>
                  <p className="cd-caption" style={{ marginTop: 8 }}>
                    Explore the front-to-back findings, or keep a report with your collection.
                  </p>
                  <div className="dcm-actions" style={{ marginTop: 16 }}>
                    <button type="button" className="cd-quiet" onClick={() => jumpTo('grade')}>
                      Grade details
                    </button>
                    <button type="button" className="cd-quiet" onClick={() => jumpTo('reports')}>
                      Reports &amp; downloads
                    </button>
                  </div>
                </section>
              </div>
            </div>
          }
          labels={
            <LabelsHoldersSection
              {...holderSectionProps}
              customStyles={customStyles}
              onSwitchStyle={onSwitchStyle}
              onEditLabelText={() => setShowEditLabelModal(true)}
            />
          }
          market={
            <div className="cd-section">
              <div className="cd-section-title">
                <p className="cd-eyebrow">Know what you hold</p>
                <h2>Your card in the market.</h2>
                <p>Estimates, not sale guarantees.</p>
              </div>
              {/* Mounted exactly as legacy mounts it, including onPriceLoad. */}
              <div id="tour-live-market-pricing">{renderPricing()}</div>
              <section id="tour-market-pricing" className="cd-panel">
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
                  Find and price this card or similar
                </h3>
                <p className="cd-caption" style={{ marginBottom: 14 }}>
                  Search the marketplaces for comparable listings.
                </p>
                <div className="cd-link-grid">{renderMarketplaceLinks()}</div>
              </section>
              <section id="tour-pro-estimates" className="cd-panel">
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  Estimated mail-away grades
                </h3>
                {renderProEstimates ? (
                  renderProEstimates()
                ) : (
                  <p className="cd-caption" style={{ marginTop: 8 }}>
                    No mail-away estimates were produced for this card.
                  </p>
                )}
              </section>
              <div className="dcm-actions">
                <a className="cd-quiet" href="/market-pricing">
                  View in portfolio
                </a>
              </div>
            </div>
          }
          grade={
            <GradeDetailsSection
              card={card}
              vm={vm}
              category={category}
              focusAnchor={jumpAnchor}
              onZoom={openZoom}
            />
          }
          reports={
            <div className="cd-section">
              <div className="cd-section-title">
                <p className="cd-eyebrow">Keep it. Share it. Show it.</p>
                <h2>Your card, ready to go.</h2>
                <p>Reports, labels and images — all from the existing generators.</p>
              </div>
              <section id="tour-download-buttons" className="cd-panel">
                <div className="cd-showcase-row">
                  <span className="cd-caption">
                    DCM serial <strong className="cd-serial">{vm.identity.serial}</strong>
                  </span>
                  {isOwner ? (
                    renderDownloadButton()
                  ) : (
                    <span className="cd-caption">
                      Reports and labels are available to the card&rsquo;s owner.
                    </span>
                  )}
                </div>
              </section>
            </div>
          }
        />

        {/* Owner actions that legacy keeps at the foot of the page. */}
        <div style={{ paddingBottom: 40 }}>
          {/* "Grade another card" (legacy 6918-6940). The happy path used to
              end here with no next step, so most first-time graders stopped
              after one card; the onboarding-funnel work added this and it is
              not something V2 may quietly drop. */}
          {isOwner && (
            <div style={{ textAlign: 'center', paddingBlock: 24 }}>
              <ActionLink
                href={!creditsLoading && balance === 0 ? '/credits' : (retakeHref ?? uploadHref)}
                variant="primary"
              >
                {!creditsLoading && balance === 0
                  ? 'Get credits to grade more'
                  : 'Grade another card'}
              </ActionLink>
              {!creditsLoading && (
                <p className="cd-caption" style={{ marginTop: 8 }}>
                  {balance === 0
                    ? 'Your free grades are used up.'
                    : `You have ${balance} credit${balance === 1 ? '' : 's'} left.`}
                </p>
              )}
            </div>
          )}
          <PostResultOffer
            ownerId={card?.user_id ?? null}
            gradeComplete={!loading && typeof card?.grade === 'number' && (card.grade ?? 0) > 0}
            orgId={(card as { org_id?: string | null } | null)?.org_id ?? null}
          />
          <MarkAsSoldButton
            cardId={card.id}
            cardName={vm.identity.displayName}
            serial={card.serial}
            ownershipStatus={card.ownership_status}
            isOwner={isOwner}
          />
          <CardBinderPicker cardId={card.id} isOwner={isOwner} />
        </div>
      </div>

      {/* ── mobile bottom action bar (≤760px) ───────────────────────── */}
      {showMobileBar && (
        <div className="cd-mobile-bar">
          {/* The GENERAL download menu (labels + reports), not a holder flow:
              the hero no longer selects a holder. */}
          <button
            type="button"
            className="dcm-button dcm-button--primary"
            onClick={() => {
              const target = document.getElementById('tour-holder-download');
              if (target) {
                target.scrollIntoView({ block: 'center' });
                target.querySelector('button')?.focus();
              } else {
                jumpTo('reports', 'tour-download-buttons');
              }
            }}
          >
            Download label
          </button>
          {!isSold && (
            <button
              type="button"
              className="dcm-button dcm-button--secondary"
              onClick={() => {
                document.getElementById('tour-insta-list')?.scrollIntoView({ block: 'start' });
              }}
            >
              InstaList
            </button>
          )}
        </div>
      )}

      {/* ── modals ─────────────────────────────────────────────────── */}
      <ImageZoomModal
        isOpen={zoom.isOpen}
        onClose={() => setZoom({ isOpen: false, imageUrl: '', alt: '', title: '' })}
        imageUrl={zoom.imageUrl}
        alt={zoom.alt}
        title={zoom.title}
      />

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Delete card from collection
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              This permanently removes the card and all associated data from the system.
            </p>
            <p className="text-xs text-red-600 text-center mb-6 font-medium">
              ⚠️ This action is non-reversible
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={detail.isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={detail.deleteCard}
                disabled={detail.isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {detail.isDeleting ? 'Deleting…' : 'Delete card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegradeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Re-grade this card?
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              This re-analyses the card using the <strong>same uploaded images</strong> with the
              latest DCM Optic™ grading system. The new grade <strong>replaces</strong> the
              current one.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 text-center font-medium">
                This will use 1 credit from your balance.
              </p>
              <p className="text-xs text-amber-600 text-center mt-1">
                Current balance: {balance} credit{balance !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRegradeConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRegradeConfirm(false);
                  detail.regradeCard();
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Re-grade card (1 credit)
              </button>
            </div>
          </div>
        </div>
      )}

      {showInsufficientCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Insufficient credits</h2>
            <p className="text-gray-600 mb-4">You need 1 credit to re-grade this card.</p>
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600">Current balance</p>
              <p className="text-2xl font-bold text-gray-900">{balance} credits</p>
            </div>
            <div className="space-y-2">
              <Link
                href="/credits"
                className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl"
              >
                Purchase credits
              </Link>
              <button
                onClick={() => setShowInsufficientCredits(false)}
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <EditCardLabelModal
        isOpen={showEditLabelModal}
        onClose={() => setShowEditLabelModal(false)}
        cardId={card.id}
        labelData={vm.labelData}
        labelStyle={labelStyle}
        activeConfig={activeConfig}
        heritageBandColors={heritageBandColors}
        colorOverrides={colorOverrides as never}
        hasCustomLabel={!!card.custom_label_data}
        onSaved={detail.refetch}
      />

      {showFirstGradeModal && (
        <FirstGradeCongratsModal
          isFirstPurchase={isFirstPurchase}
          onDismiss={() => setShowFirstGradeModal(false)}
          onStartTour={() => {
            setShowFirstGradeModal(false);
            setShowOnboardingTour(true);
          }}
        />
      )}

      {/* V2 passes onBeforeStep so a step targeting a closed section opens it
          first. Legacy pages pass nothing and are unaffected. */}
      <OnboardingTour
        isActive={showOnboardingTour}
        onComplete={() => setShowOnboardingTour(false)}
        onBeforeStep={routing.revealAnchor}
      />

      {!postResultOfferEligible && (
        <LowCreditsBottomBanner
          balance={balance}
          isFirstPurchase={isFirstPurchase}
          ownerId={card?.user_id ?? null}
          loading={creditsLoading}
        />
      )}
    </main>
  );
}

export default CardDetailShell;
