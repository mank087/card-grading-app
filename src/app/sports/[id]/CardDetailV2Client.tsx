'use client';

/**
 * Sports card detail — V2.
 *
 * This is the ADAPTER, and it is meant to stay thin. It is a SIBLING of
 * ./CardDetailClient.tsx, which is not edited for the duration of the project
 * so that `CARD_DETAIL_V2=off` is a complete rollback (plan §4).
 *
 * It is a copy of the Pokemon adapter with only the things sports genuinely
 * does differently changed — the pricing component, the marketplace links, the
 * structured-data strings, the upload/retake routes and the card-info slot.
 * Every difference is marked SPORTS below so the next category can see at a
 * glance which lines are the adapter axis and which are boilerplate.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Script from 'next/script';

import { useCardDetail } from '@/components/card-detail/useCardDetail';
import { buildCardDetailViewModel } from '@/lib/cardDetail/viewModel';
import { extractConditionSummary } from '@/lib/cardDetail/parsers';
import { buildCardInfo } from '@/lib/cardDetail/cardInfo';
import { readDvgGrading } from '@/lib/cardDetail/gradeDetails';
import { buildCardStructuredData } from '@/lib/cardDetail/structuredData';
import CardDetailShell from '@/components/card-detail/CardDetailShell';
import SportsCardInfo, {
  SportsFeatureBadges,
  SportsParallelBadge,
  hasSportsFeatures,
} from '@/components/card-detail/categories/SportsCardInfo';
import ProEstimatesPanel from '@/components/card-detail/sections/ProEstimatesPanel';

import { getStoredSession } from '@/lib/directAuth';
import { useCustomLabelStyleWithOrg } from '@/hooks/useOrgHouseStyle';
import { assessValueTrust } from '@/lib/pricing/valueGuard';
/** SPORTS: PriceCharting/SportsCardsPro, not the Pokemon lookup (Phase 0 §4). */
import { PriceChartingLookup } from '@/components/pricing/PriceChartingLookup';
import type { MarketRange } from '@/lib/pricing/marketRange';

/**
 * ITEM H. `DownloadReportButton` statically imports `@react-pdf/renderer` and
 * the whole export stack. Loading it with `next/dynamic` keeps that out of the
 * page's first chunk; the placeholder reserves the trigger's height so the
 * hero does not jump when it lands. `ssr: false` because everything it does is
 * browser-only anyway.
 *
 * The eight legacy clients keep their static import and are untouched.
 */
const DownloadReportButton = dynamic(
  () => import('@/components/reports/DownloadReportButton').then((m) => m.DownloadReportButton),
  { ssr: false, loading: () => <div className="cd-download-placeholder" aria-hidden="true" /> },
);
/** SPORTS: the generic eBay builders, not the Pokemon-specific pair. */
import {
  generateEbaySearchUrl,
  generateEbaySoldListingsUrl,
  type CardData,
} from '@/lib/ebayUtils';
import type { CardSharingData } from '@/lib/socialUtils';

interface DcmPriceData {
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  productName: string | null;
  /** SPORTS: the lookup reports a SportsCardsPro product page, not PriceCharting. */
  sportsCardsProUrl?: string;
  marketRange?: MarketRange | null;
  /** The freshness OF THIS RESULT, as the lookup reports it. */
  isCached?: boolean;
  cacheAgeDays?: number | null;
}

export function SportsCardDetailsV2() {
  const params = useParams<{ id: string }>();
  const cardId = typeof params?.id === 'string' ? params.id : '';

  const detail = useCardDetail('sports', cardId);
  const card = detail.card;

  // The live SportsCardsPro lookup, reported by PriceChartingLookup in the
  // Market section. It only reaches the hero after assessValueTrust agrees.
  const [dcmPriceData, setDcmPriceData] = useState<DcmPriceData | null>(null);

  // Org-graded cards render the store's house design; otherwise the viewer's
  // own Label Studio style. This is the SAVED default: the shell previews on
  // top of it and only writes it through the explicit owner action.
  const { labelStyle, customStyles, switchStyle, isOrgHouseStyle } =
    useCustomLabelStyleWithOrg((card as any)?.org_id);

  const sessionUserId = getStoredSession()?.user?.id ?? null;

  const vm = useMemo(
    () =>
      card
        ? buildCardDetailViewModel({
            card: card as any,
            category: 'sports',
            sessionUserId,
            isProcessing: detail.isProcessing,
          })
        : null,
    [card, sessionUserId, detail.isProcessing]
  );

  /**
   * SPORTS: the legacy `cardInfo` object (sports CardDetailClient.tsx
   * 2561-2652). Naming the category matters here — sports reads the model JSON
   * BEFORE the database columns, the opposite of Pokemon, and `buildCardInfo`
   * switches on exactly this argument.
   */
  const cardInfo = useMemo(() => buildCardInfo(card, 'sports'), [card]);
  const dvgGrading = useMemo(() => readDvgGrading(card), [card]);

  // Legacy's rule, verbatim in intent (sports CardDetailClient.tsx 3490-3520):
  // only a TRUSTED estimate is shown. A thin-identity card shows the correction
  // callout instead, and never the number.
  const liveEstimate = useMemo(() => {
    const value = dcmPriceData?.estimatedValue;
    if (!card || typeof value !== 'number' || !Number.isFinite(value)) return null;
    return assessValueTrust(card as any, value).trusted ? value : null;
  }, [card, dcmPriceData]);

  // The range belongs to the matched listing, so it is shown only when the
  // estimate from that same match was trusted — the lookup applies the same rule.
  const marketRange = liveEstimate !== null ? dcmPriceData?.marketRange ?? null : null;

  // One object: the trusted amount and the freshness that belongs to it.
  const live = useMemo(
    () =>
      liveEstimate === null
        ? null
        : {
            amount: liveEstimate,
            isCached: dcmPriceData?.isCached ?? false,
            cacheAgeDays: dcmPriceData?.cacheAgeDays ?? null,
          },
    [liveEstimate, dcmPriceData],
  );

  const conditionSummary = useMemo(
    () => extractConditionSummary((card as any)?.conversational_grading),
    [card]
  );

  const shareData: CardSharingData = useMemo(() => {
    const c: any = card ?? {};
    const dvg = c.dvg_grading || {};
    return {
      cardName: dvg.card_info?.card_name || c.card_name,
      playerName: dvg.card_info?.player_or_character || c.featured,
      setName: dvg.card_info?.set_name || c.card_set,
      year: dvg.card_info?.year || c.release_date,
      manufacturer: dvg.card_info?.manufacturer,
      grade: c.conversational_decimal_grade ?? undefined,
      gradeUncertainty:
        c.conversational_image_confidence || c.dvg_image_quality || c.ai_confidence_score || 'B',
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
  }, [card]);

  /**
   * SPORTS: three links, not four — there is no TCGPlayer for sports. The two
   * eBay payloads are legacy's field for field (5155-5205), including the rule
   * that `autographed` is taken from the analysis alone and never from the
   * older column. The third is the SportsCardsPro product page the lookup
   * reported, or a search when it found none (5213-5220).
   */
  const marketplaceLinks = () => {
    const c: any = card ?? {};

    const ebaySearchCard = {
      card_name: cardInfo.card_name || c.card_name,
      card_set: cardInfo.set_name || c.card_set,
      featured: cardInfo.player_or_character || c.featured,
      release_date: cardInfo.year || c.release_date,
      manufacturer_name: cardInfo.manufacturer || c.manufacturer_name,
      card_number: cardInfo.card_number || c.card_number,
      subset: cardInfo.subset || c.subset,
      serial_numbering:
        cardInfo.serial_number ||
        dvgGrading?.rarity_features?.serial_number ||
        c.serial_numbering,
      rookie_or_first_print:
        cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true'
          ? 'Yes'
          : dvgGrading?.rarity_features?.rookie_or_first === 'true'
            ? 'Yes'
            : c.rookie_or_first_print,
      autographed: cardInfo.autographed ? 'Yes' : 'No',
      dcm_grade_whole: c.dvg_whole_grade || c.dcm_grade_whole,
    } as CardData;

    const sportsCardsProUrl =
      dcmPriceData?.sportsCardsProUrl ||
      `https://www.sportscardspro.com/search?q=${encodeURIComponent(
        [
          cardInfo.player_or_character || c.featured,
          cardInfo.set_name || c.card_set,
          cardInfo.year || c.release_date,
        ]
          .filter(Boolean)
          .join(' ')
      )}`;

    const links: Array<[string, string, string]> = [
      ['eBay', generateEbaySearchUrl(ebaySearchCard), 'Active listings'],
      ['eBay sold', generateEbaySoldListingsUrl(ebaySearchCard), 'Recent sold prices'],
      ['SportsCardsPro', sportsCardsProUrl, 'Market data'],
    ];

    return (
      <>
        {links.map(([title, href, note]) => (
          <a
            key={title}
            className="cd-quiet"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
          >
            <strong>{title}</strong>
            <span className="cd-caption">{note}</span>
          </a>
        ))}
      </>
    );
  };

  // JSON-LD, built and mounted as the legacy client does (once the card has
  // loaded). It only renders after the client fetch, so window is available.
  // SPORTS: the four strings come from the legacy sports generateStructuredData
  // (1400-1520). Legacy omits `brand` entirely when the card has no
  // manufacturer; the shared builder always emits one, so the category name is
  // the fallback — the one deliberate departure, recorded in the parity doc.
  const structuredData = card
    ? buildCardStructuredData(
        card,
        `${typeof window !== 'undefined' ? window.location.origin : 'https://dcmgrading.com'}/sports/${cardId}`,
        {
          fallbackBrand: 'Sports Cards',
          productCategory: 'Sports Trading Cards',
          breadcrumbName: 'Sports Cards',
          breadcrumbUrl: 'https://dcmgrading.com/upload/sports',
          fallbackCardName: 'Sports Card',
        },
      )
    : null;

  return (
    <>
    {structuredData && (
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    )}
    <CardDetailShell
      category="sports"
      categoryLabel="Sports"
      cardId={cardId}
      backHref="/collection"
      uploadHref="/upload/sports"
      retakeHref="/upload?category=Sports"
      ebayCardType="sports"
      detail={detail}
      vm={vm}
      labelStyle={labelStyle}
      customStyles={customStyles}
      orgHouseStyleLocked={isOrgHouseStyle}
      onSwitchStyle={switchStyle}
      live={live}
      marketRange={marketRange}
      // Phone Market tab: "Matched: <product> · <confidence>" (Phase 4 M).
      priceMatch={
        dcmPriceData?.productName
          ? { productName: dcmPriceData.productName, matchConfidence: dcmPriceData.matchConfidence }
          : null
      }
      conditionSummary={conditionSummary}
      shareData={shareData}
      renderDownloadButton={(ctx) =>
        card ? (
          <DownloadReportButton
            card={card}
            cardType="sports"
            showFounderEmblem={detail.emblems.showFounderEmblem}
            showVipEmblem={detail.emblems.showVipEmblem}
            showCardLoversEmblem={detail.emblems.showCardLoversEmblem}
            // The PREVIEWED design, so a download is the label on screen.
            labelStyle={ctx.labelStyle}
            customLabelConfig={ctx.customLabelConfig}
            openLabelsSignal={ctx.openLabelsSignal}
            onMenuOpenChange={ctx.onMenuOpenChange}
            sheetOnMobile={ctx.sheetOnMobile}
            menuLayout={ctx.menuLayout}
            holderMenu={ctx.holderMenu}
          />
        ) : null
      }
      renderHolderDownload={(holder, ctx) =>
        card ? (
          <DownloadReportButton
            card={card}
            cardType="sports"
            showFounderEmblem={detail.emblems.showFounderEmblem}
            showVipEmblem={detail.emblems.showVipEmblem}
            showCardLoversEmblem={detail.emblems.showCardLoversEmblem}
            labelStyle={ctx.labelStyle}
            customLabelConfig={ctx.customLabelConfig}
            holderDownload={holder}
          />
        ) : null
      }
      renderPricing={() =>
        card ? (
          <PriceChartingLookup
            guardIdentity={card as any}
            card={{
              id: card.id,
              player_or_character: cardInfo.player_or_character || (card as any).featured,
              year: cardInfo.year || (card as any).release_date,
              set_name: cardInfo.set_name || (card as any).card_set,
              card_number: cardInfo.card_number || (card as any).card_number,
              rarity_or_variant: cardInfo.rarity_or_variant,
              // Insert/subset name (e.g. "Downtown") — NOT used for variant.
              subset: cardInfo.subset,
              subset_insert_name: cardInfo.subset_insert_name ?? undefined,
              // The actual parallel colour (e.g. "Green", "Gold").
              parallel_type: cardInfo.parallel_type ?? undefined,
              rookie_or_first:
                cardInfo.rookie_or_first === true || (card as any).rookie_card === true,
              // e.g. "Hockey", "Baseball", "Basketball", "Football".
              category: (card as any).category,
              serial_numbering: cardInfo.serial_number || (card as any).serial_numbering,
              dcm_selected_product_id: (card as any).dcm_selected_product_id ?? undefined,
              dcm_selected_product_name: (card as any).dcm_selected_product_name ?? undefined,
              // Phase 2C: guard price saves against a concurrent identity fix.
              identity_revision: (card as any).identity_revision as number | null | undefined,
              pricing_selection_revision: (card as any).pricing_selection_revision as
                | number
                | null
                | undefined,
            }}
            dcmGrade={(card as any).conversational_decimal_grade ?? undefined}
            isOwner={detail.isOwner}
            onPriceLoad={setDcmPriceData}
          />
        ) : null
      }
      renderMarketplaceLinks={marketplaceLinks}
      renderProEstimates={() => (
        <ProEstimatesPanel estimates={(card as any)?.estimated_professional_grades ?? null} />
      )}
      // The panel draws nothing when the column is null, so the shell drops the
      // heading instead of leaving one over an empty block.
      hasProEstimates={!!(card as any)?.estimated_professional_grades}
      renderReportDownload={(kind, ctx, label) =>
        card ? (
          <DownloadReportButton
            card={card}
            cardType="sports"
            showFounderEmblem={detail.emblems.showFounderEmblem}
            showVipEmblem={detail.emblems.showVipEmblem}
            showCardLoversEmblem={detail.emblems.showCardLoversEmblem}
            labelStyle={ctx.labelStyle}
            customLabelConfig={ctx.customLabelConfig}
            reportDownload={kind}
            reportDownloadLabel={label}
            reportDownloadClassName="cd-quiet"
          />
        ) : null
      }
      renderCategoryCardInfo={() => <SportsCardInfo cardInfo={cardInfo} />}
      /* SPORTS: memorabilia plus the eleven relic/parallel flags. */
      renderCategoryBadges={() => (
        <SportsFeatureBadges cardInfo={cardInfo} dvgGrading={dvgGrading} />
      )}
      /* SPORTS: the shared "Variant" badge is replaced by the PARALLEL badge,
         which picks a real parallel name instead of the classification tier. */
      renderCategoryVariantBadge={() => <SportsParallelBadge cardInfo={cardInfo} />}
      hasCategoryFeatures={hasSportsFeatures(cardInfo)}
    />
    </>
  );
}
