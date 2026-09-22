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
 * ROOT ELEMENT: a `<div>`, not a `<main>`. The app layout already renders
 * `<main id="main-content">` around every page (src/app/layout.tsx:153), and a
 * second main nested inside it gives the document two main landmarks.
 *
 * LABEL STYLE is a LOCAL PREVIEW here — see ./useLabelPreview. Every label on
 * the page reads `preview.style`, including the downloads; saving a default is
 * an explicit owner action.
 *
 * OWNERSHIP is the legacy client-side check, reproduced and not widened. It is
 * open code-audit gap G6 and this page adds no new owner-only surface that
 * lacks a server check.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import type { UseCardDetailResult } from './useCardDetail';
import type { CardDetailSectionId } from '@/lib/cardDetail/anchorMap';
import type { SavedCustomStyle, CustomLabelConfig } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import type { MarketRange } from '@/lib/pricing/marketRange';
import type { LiveValuationInput } from '@/lib/cardDetail/valuation';
import type { CardSharingData } from '@/lib/socialUtils';

import CardAnalysisAnimation from '@/app/upload/sports/CardAnalysisAnimation';
import ImageZoomModal from '@/app/pokemon/[id]/ImageZoomModal';
import { SoldBanner } from '@/components/cards/SoldBanner';
import { EditCardLabelModal } from '@/components/EditCardLabelModal';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { FirstGradeCongratsModal } from '@/components/conversion/FirstGradeCongratsModal';
import { LowCreditsBottomBanner } from '@/components/conversion/LowCreditsBottomBanner';
import { usePostResultOfferEligible } from '@/components/conversion/PostResultOffer';
import { useCredits } from '@/contexts/CreditsContext';
import { getStoredSession } from '@/lib/directAuth';

import CardLabelShowcase, { type CardSide } from './CardLabelShowcase';
import {
  LabelsHoldersSection,
  OverviewHoldersBand,
} from './holders/HolderSections';
import HolderEntryStrip from './holders/HolderEntryStrip';
import HolderEnlargeModal from './holders/HolderEnlargeModal';
import { holderCardAnchorId } from './holders/HolderCards';
import {
  HOLDER_LABEL_STOCK,
  holderStyleSupport,
  type CardHolderId,
} from '@/lib/cardDetail/holderSupport';
import { resolveEffectiveLabelSize } from '@/lib/cardDetail/labelSize';
import { buildLabelStudioHref } from '@/lib/cardDetail/labelStudioLink';
import { useLabelPreview } from './useLabelPreview';
import LabelPreviewControls from './LabelPreviewControls';
import { useCardDetailInstaList } from './useCardDetailInstaList';
import CardDetailBreadcrumb from './CardDetailBreadcrumb';
import CardDetailMobileBar from './CardDetailMobileBar';
import CardDetailModals from './CardDetailModals';
import CardDetailFooterActions from './CardDetailFooterActions';

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
import GradeDetailsSection, { type EvidenceKey } from './sections/GradeDetailsSection';
import MarketSection from './sections/MarketSection';
import ReportsSection from './sections/ReportsSection';
import InstaListSection from './sections/InstaListSection';
import type { ReportDownloadKind } from '@/components/reports/DownloadReportButton';
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

/**
 * What a download slot must render with. The PREVIEWED style, so a download
 * produces the label the reader is looking at rather than the account default.
 */
export interface DownloadSlotContext {
  labelStyle: LabelStyleId;
  customLabelConfig: CustomLabelConfig | null;
  /** Additive DownloadReportButton props, for the hero instance only. */
  openLabelsSignal?: number;
  onMenuOpenChange?: (open: boolean) => void;
  sheetOnMobile?: boolean;
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

  /* Label style. `labelStyle` is the SAVED default (account, or the org house
     style when one applies); the page previews on top of it. */
  labelStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  /** The org locks the design: read-only selector, no preview. */
  orgHouseStyleLocked: boolean;
  /** Resolves to whether the account default was actually written. */
  onSwitchStyle: (id: LabelStyleId) => Promise<boolean>;

  /* Category slots. Functions, not nodes, because several mount twice. */
  renderDownloadButton: (ctx: DownloadSlotContext) => ReactNode;
  renderPricing: () => ReactNode;
  renderMarketplaceLinks: () => ReactNode;
  /** The PSA/BGS/SGC/CGC mail-away estimates, mounted in the Market section. */
  renderProEstimates?: () => ReactNode;
  /**
   * Whether `renderProEstimates` has anything to draw. The panel renders
   * NOTHING when `estimated_professional_grades` is null (which is the honest
   * answer for a card graded before the two-stage system wrote that column),
   * and a heading with nothing under it reads as a section that broke. The
   * adapter holds the column, so it answers. Omitted: assume there is.
   */
  hasProEstimates?: boolean;
  /**
   * The category's own Card Information fields, rendered inside the shared
   * `CardFacts` panel. Pokemon supplies `PokemonCardInfo` here.
   */
  renderCategoryCardInfo?: (ctx: CategoryCardInfoContext) => ReactNode;
  /** The category's own Special Features badges. */
  renderCategoryBadges?: () => ReactNode;
  /**
   * One trigger that opens ONE holder's existing download flow
   * (`DownloadReportButton`'s additive `holderDownload` prop). Owner-only.
   */
  renderHolderDownload?: (holder: CardHolderId, ctx: DownloadSlotContext) => ReactNode;

  /**
   * One trigger that opens ONE REPORT export's existing download flow
   * (`DownloadReportButton`'s additive `reportDownload` prop). Owner-only;
   * the Reports tab shows a sign-in line instead when it is absent.
   */
  renderReportDownload?: (
    kind: ReportDownloadKind,
    ctx: DownloadSlotContext,
    label: string,
  ) => ReactNode;

  /**
   * Where "retake your photos" goes. Legacy pokemon uses
   * `/upload?category=Pokemon`, which is not `uploadHref`. Defaults to
   * `uploadHref` when an adapter has nothing more specific.
   */
  retakeHref?: string;

  /**
   * The live price lookup's result: the trusted amount AND the freshness that
   * belongs to it. Null until the pricing component reports one.
   */
  live: LiveValuationInput | null;
  /** Low / median / high from the live price match; null until it reports. */
  marketRange?: MarketRange | null;
  /** `extractConditionSummary(card.conversational_grading)`, or null. */
  conditionSummary: string | null;
  shareData: CardSharingData;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="dcm-brand dcm-card-detail">{children}</div>;
}

function LoadingSkeleton() {
  return (
    <PageShell>
      <div className="cd-container" style={{ paddingBlock: 48 }}>
        <p role="status" aria-live="polite" className="cd-caption">
          Loading this card…
        </p>
        <div aria-hidden="true" className="cd-hero" style={{ marginTop: 24 }}>
          <div className="cd-showcase" style={{ minHeight: 420 }} />
          <div className="cd-hero-summary">
            <div className="cd-panel" style={{ minHeight: 120 }} />
            <div className="cd-panel" style={{ minHeight: 180 }} />
          </div>
        </div>
      </div>
    </PageShell>
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
    orgHouseStyleLocked,
    onSwitchStyle,
    renderDownloadButton,
    renderPricing,
    renderMarketplaceLinks,
    renderProEstimates,
    hasProEstimates: hasProEstimatesProp,
    renderCategoryCardInfo,
    renderCategoryBadges,
    renderHolderDownload,
    renderReportDownload,
    retakeHref,
    live,
    marketRange,
    conditionSummary,
    shareData,
  } = props;

  const { card, loading, isProcessing, error, regradingImageUrl } = detail;
  const { balance, isFirstPurchase, isLoading: creditsLoading } = useCredits();

  const routing = useCardDetailSectionRouting(detail.isOwner);
  const [side, setSide] = useState<CardSide>('front');
  const [zoom, setZoom] = useState({ isOpen: false, imageUrl: '', alt: '', title: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRegradeConfirm, setShowRegradeConfirm] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [showEditLabelModal, setShowEditLabelModal] = useState(false);
  const [showFirstGradeModal, setShowFirstGradeModal] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [enlargedHolder, setEnlargedHolder] = useState<CardHolderId | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  // Counter the mobile bar bumps to open the download menu in place. See
  // DownloadReportButton.openLabelsSignal. The listing flow's own counter is
  // held by `insta` below, beside the rest of the listing state.
  const [openDownloadsSignal, setOpenDownloadsSignal] = useState(0);
  // The anchor the page was last asked to jump to. Grade details reads it to
  // select the matching evidence tab; `replaceState` fires no hashchange, so
  // handing it over directly is the only way the section learns.
  const [jumpAnchor, setJumpAnchor] = useState<string | null>(null);

  /**
   * Grade details' inspection context, lifted here (review item D).
   *
   * `CardDetailSections` unmounts an inactive section — deliberately, and that
   * mounting strategy is unchanged — so the selected evidence tab and the open
   * expanders used to reset every time the reader looked at Market and came
   * back. Holding them at this level survives the unmount without changing how
   * anything mounts.
   */
  const [evidenceTab, setEvidenceTab] = useState<EvidenceKey>('centering');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const [userReportOpen, setUserReportOpen] = useState(false);

  const viewerSignedIn = !!getStoredSession()?.user?.id;
  const hasProEstimates = !!renderProEstimates && (hasProEstimatesProp ?? true);

  const preview = useLabelPreview({
    savedStyle: labelStyle,
    customStyles,
    orgLocked: orgHouseStyleLocked,
    cardColors: (card as { card_colors?: unknown } | null)?.card_colors ?? null,
    switchStyle: onSwitchStyle,
  });

  /**
   * Listing status + the session-only pre-listing draft, in one hook shared by
   * the hero panel, the mobile bar and the InstaList tab. See that file for why
   * there is exactly one `/api/ebay/listing/check` per page view.
   */
  const insta = useCardDetailInstaList({
    cardId,
    card,
    cardType: ebayCardType,
    isOwner: detail.isOwner,
    isSold: !!vm?.permissions.isSold,
    instaListActive: routing.active === 'instalist',
  });

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

  const jumpTo = useCallback(
    (id: CardDetailSectionId, anchorId?: string) => {
      setJumpAnchor(anchorId ?? null);
      routing.selectSection(id, anchorId);
    },
    [routing],
  );

  /**
   * The hero's holder strip: open the Overview section, scroll to that
   * holder's card and mark it briefly so the reader's eye lands on it. The
   * highlight is a CSS animation and is suppressed under reduced motion.
   */
  const goToHolder = useCallback(
    (holder: CardHolderId) => {
      jumpTo('overview');
      const anchorId = holderCardAnchorId(holder);
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      // A timer, not requestAnimationFrame: rAF is throttled to a standstill in
      // a background tab, and this must still land when the reader comes back
      // to one. 60ms is enough for React to have mounted the band.
      window.setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
        el.setAttribute('data-arrived', 'true');
        window.setTimeout(() => el.removeAttribute('data-arrived'), 1600);
      }, 60);
    },
    [jumpTo],
  );

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
        <PageShell>
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
        </PageShell>
      );
    }

    return (
      <PageShell>
        <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
          <h1 style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-.03em' }}>
            Card not available
          </h1>
          <p className="dcm-lead">
            This card no longer exists or is not viewable at this moment.
          </p>
          <div className="dcm-actions" style={{ marginTop: 28 }}>
            {viewerSignedIn ? (
              <Link className="dcm-button dcm-button--primary" href="/collection">
                My collection
              </Link>
            ) : (
              <Link className="dcm-button dcm-button--primary" href="/">
                Back to DCM Grading
              </Link>
            )}
            <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
              Grade a card
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!card || !vm) {
    return (
      <PageShell>
        <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
          <h1 style={{ fontSize: 30, fontWeight: 750 }}>{categoryLabel} card not found</h1>
          <div className="dcm-actions" style={{ marginTop: 24 }}>
            <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
              Back to {categoryLabel} upload
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── The page ───────────────────────────────────────────────────────────

  const isOwner = detail.isOwner;
  const isSold = vm.permissions.isSold;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

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
      style: preview.style,
      returnPath,
    });

  /** Every download renders the PREVIEWED design, not the account default. */
  const downloadContext: DownloadSlotContext = {
    labelStyle: preview.style,
    customLabelConfig: preview.activeConfig,
  };

  /** Shared by the hero piece and the three holder compositions. */
  const artworkProps = {
    card,
    frontUrl: vm.images.front.url,
    backUrl: vm.images.back.url,
    cardName: vm.identity.displayName,
    labelData: vm.labelData,
    labelStyle: preview.style,
    activeConfig: preview.activeConfig,
    colorOverrides: preview.colorOverrides as never,
    heritageBandColors: preview.heritageBandColors,
    orgLogos: detail.orgLogos,
    subScores: labelSubScores,
    emblems: detail.emblems,
    verifyUrl,
  };

  const renderComposition = (which: CardHolderId, maxWidth: number) => (
    <HolderComposition {...artworkProps} holder={which} maxWidth={maxWidth} />
  );

  /**
   * Everything the two holder sections need, assembled once. There is no
   * holder SELECTION state: nothing in the hero depends on a holder, so each
   * card is self-contained and the mockup owns its own front/back.
   */
  const holderSectionProps = {
    labelStyle: preview.style,
    activeConfig: preview.activeConfig,
    isOwner,
    labelStudioHref,
    renderHolderDownload: renderHolderDownload
      ? (holder: CardHolderId) => renderHolderDownload(holder, downloadContext)
      : undefined,
    renderComposition,
    onEnlarge: setEnlargedHolder,
  };

  const enlargedSize = enlargedHolder
    ? resolveEffectiveLabelSize(enlargedHolder, preview.style, preview.activeConfig)
    : null;
  const enlargedSupport = enlargedHolder
    ? holderStyleSupport(enlargedHolder, preview.style, preview.activeConfig)
    : null;

  // The mobile bar must never sit on top of an open overlay — including the
  // download menu and the listing modal, which are owned by shared components.
  const anyModalOpen =
    zoom.isOpen ||
    showDeleteModal ||
    showRegradeConfirm ||
    showInsufficientCredits ||
    showEditLabelModal ||
    showFirstGradeModal ||
    showOnboardingTour ||
    enlargedHolder !== null ||
    downloadMenuOpen ||
    insta.modalOpen;
  const showMobileBar = isOwner && !anyModalOpen;

  const openZoom = (imageUrl: string, alt: string, title: string) =>
    setZoom({ isOpen: true, imageUrl, alt, title });

  // No menu item calls this, on purpose. The legacy clients keep the re-grade
  // handler and modals but removed the button, so V2 offers no re-grade entry
  // point either. Wiring one up is a product decision, not a parity fix.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRegradeClick = () => {
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

  /** One tap on "InstaList" does what the current state means. */
  const styleControls = (compact: boolean, idleNote?: string) => (
    <LabelPreviewControls
      preview={preview}
      customStyles={customStyles}
      isOwner={isOwner}
      viewerSignedIn={viewerSignedIn}
      compact={compact}
      idleNote={idleNote}
    />
  );

  return (
    <div
      className="dcm-brand dcm-card-detail"
      data-mobile-bar={showMobileBar}
      // The tour positions its targets with its own maths; the page's scroll
      // offsets are stood down while it runs so the two cannot compound.
      data-tour-active={showOnboardingTour}
    >
      {/* The tour's caption card is fixed to the top of the screen and the tour
          scrolls each target to just below it. The first targets (visibility
          row, card images) sit at the very top of the page, where there is no
          scroll distance to give, so they ended up underneath the caption.
          This spacer gives the page that distance while the tour runs. */}
      {showOnboardingTour && <div className="cd-tour-spacer" aria-hidden="true" />}
      <div className="cd-container">
        <CardDetailBreadcrumb
          categoryLabel={categoryLabel}
          displayName={vm.identity.displayName}
          serial={vm.identity.serial}
          backHref={backHref}
          isOwner={isOwner}
          viewerSignedIn={viewerSignedIn}
          visibility={detail.visibility}
          isTogglingVisibility={detail.isTogglingVisibility}
          onToggleVisibility={handleVisibilityClick}
          onStartTour={() => setShowOnboardingTour(true)}
          shareData={shareData}
          currentUrl={currentUrl}
          onEditLabel={() => setShowEditLabelModal(true)}
          onDelete={() => setShowDeleteModal(true)}
          labelStudioHref={`/labels?card=${encodeURIComponent(vm.identity.serial)}`}
        />

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
            styleControl={styleControls(false)}
            holderEntry={<HolderEntryStrip onGoToHolder={goToHolder} />}
            downloadAction={renderDownloadButton({
              ...downloadContext,
              openLabelsSignal: openDownloadsSignal,
              onMenuOpenChange: setDownloadMenuOpen,
              sheetOnMobile: true,
            })}
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
              live={live}
              marketRange={marketRange ?? null}
              isOwner={isOwner}
              onJumpToMarket={() => jumpTo('market')}
            />

            <InstaListPanel
              card={card}
              cardType={ebayCardType}
              isOwner={isOwner}
              showFounderEmblem={detail.emblems.showFounderEmblem}
              labelStyle={preview.style}
              customLabelConfig={preview.activeConfig}
              status={insta.status}
              openSignal={insta.openSignal}
              onModalOpenChange={insta.setModalOpen}
              initialDraft={insta.draft.initialDraft}
              onConnectionChange={insta.setEbayConnected}
            />
          </div>
        </div>

        {/* ── sections ───────────────────────────────────────────────── */}
        <CardDetailSectionNav
          active={routing.active}
          onSelect={(id) => jumpTo(id)}
          isOwner={isOwner}
        />

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
                    Read the front-to-back findings, or take a report away with you.
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
              styleControl={styleControls(false)}
              viewerSignedIn={viewerSignedIn}
              onEditLabelText={() => setShowEditLabelModal(true)}
            />
          }
          market={
            <MarketSection
              pricing={renderPricing()}
              marketplaceLinks={renderMarketplaceLinks()}
              proEstimates={hasProEstimates ? renderProEstimates!() : null}
              isOwner={isOwner}
            />
          }
          grade={
            <GradeDetailsSection
              card={card}
              vm={vm}
              category={category}
              focusAnchor={jumpAnchor}
              onZoom={openZoom}
              evidence={evidenceTab}
              onEvidenceChange={setEvidenceTab}
              analysisOpen={analysisOpen}
              onAnalysisOpenChange={setAnalysisOpen}
              confidenceOpen={confidenceOpen}
              onConfidenceOpenChange={setConfidenceOpen}
              userReportOpen={userReportOpen}
              onUserReportOpenChange={setUserReportOpen}
            />
          }
          reports={
            <ReportsSection
              serial={vm.identity.serial}
              isOwner={isOwner}
              viewerSignedIn={viewerSignedIn}
              renderReportDownload={
                renderReportDownload
                  ? (kind, label) => renderReportDownload(kind, downloadContext, label)
                  : undefined
              }
            />
          }
          /* Owner-only: `sectionForViewer` makes 'instalist' unreachable for a
             visitor, so this element is created but never mounted for one. */
          instalist={
            <InstaListSection
              card={card}
              cardType={ebayCardType}
              labelStyle={preview.style}
              customLabelConfig={preview.activeConfig}
              showFounderEmblem={detail.emblems.showFounderEmblem}
              insta={insta}
            />
          }
        />

        <CardDetailFooterActions
          card={card}
          cardName={vm.identity.displayName}
          isOwner={isOwner}
          loading={loading}
          balance={balance}
          creditsLoading={creditsLoading}
          retakeHref={retakeHref}
          uploadHref={uploadHref}
        />
      </div>

      {/* ── mobile bottom action bar (≤760px) ───────────────────────── */}
      {showMobileBar && (
        <CardDetailMobileBar
          onOpenDownloads={() => setOpenDownloadsSignal((n) => n + 1)}
          instaList={
            isSold
              ? null
              : {
                  state: insta.status.state,
                  listingUrl: insta.status.listing?.listing_url,
                  onAct: insta.onAct,
                }
          }
        />
      )}

      {/* ── modals ─────────────────────────────────────────────────── */}
      <ImageZoomModal
        isOpen={zoom.isOpen}
        onClose={() => setZoom({ isOpen: false, imageUrl: '', alt: '', title: '' })}
        imageUrl={zoom.imageUrl}
        alt={zoom.alt}
        title={zoom.title}
      />

      <HolderEnlargeModal
        holder={enlargedHolder}
        onClose={() => setEnlargedHolder(null)}
        renderComposition={renderComposition}
        formatLine={
          enlargedHolder && enlargedSize
            ? `${HOLDER_LABEL_STOCK[enlargedHolder]} · ${enlargedSize.formatted}`
            : undefined
        }
        note={enlargedSize?.note ?? enlargedSupport?.note ?? null}
      />

      <CardDetailModals
        showDelete={showDeleteModal}
        onCloseDelete={() => setShowDeleteModal(false)}
        onConfirmDelete={detail.deleteCard}
        isDeleting={detail.isDeleting}
        showRegradeConfirm={showRegradeConfirm}
        onCloseRegrade={() => setShowRegradeConfirm(false)}
        onConfirmRegrade={() => {
          setShowRegradeConfirm(false);
          detail.regradeCard();
        }}
        showInsufficientCredits={showInsufficientCredits}
        onCloseInsufficientCredits={() => setShowInsufficientCredits(false)}
        balance={balance}
      />

      <EditCardLabelModal
        isOpen={showEditLabelModal}
        onClose={() => setShowEditLabelModal(false)}
        cardId={card.id}
        labelData={vm.labelData}
        labelStyle={preview.style}
        activeConfig={preview.activeConfig}
        heritageBandColors={preview.heritageBandColors}
        colorOverrides={preview.colorOverrides as never}
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
    </div>
  );
}

export default CardDetailShell;
