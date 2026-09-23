'use client';

/**
 * "Other" card detail — V2.
 *
 * This is the ADAPTER, and it is meant to stay thin. It is a SIBLING of
 * ./CardDetailClient.tsx, which is not edited for the duration of the project
 * so that `CARD_DETAIL_V2=off` is a complete rollback (plan §4).
 *
 * This route carries every card that is not one of the seven named
 * categories, INCLUDING Star Wars: `/starwars/[id]` has redirected here since
 * March 2026 (commit d41b72f8) and those rows carry
 * `category='Other', sub_category='Star Wars'`. There is no separate Star Wars
 * adapter for that reason.
 *
 * It is a copy of the Yu-Gi-Oh adapter with only the things 'Other' genuinely
 * does differently changed. Every difference is marked OTHER below.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Script from 'next/script';

import { useCardDetail } from '@/components/card-detail/useCardDetail';
import { buildCardDetailViewModel } from '@/lib/cardDetail/viewModel';
import { extractConditionSummary } from '@/lib/cardDetail/parsers';
import { buildCardInfo } from '@/lib/cardDetail/cardInfo';
import { buildCardStructuredData } from '@/lib/cardDetail/structuredData';
import CardDetailShell from '@/components/card-detail/CardDetailShell';
import OtherCardInfo from '@/components/card-detail/categories/OtherCardInfo';
import ProEstimatesPanel from '@/components/card-detail/sections/ProEstimatesPanel';

import { getStoredSession } from '@/lib/directAuth';
import { useCustomLabelStyleWithOrg } from '@/hooks/useOrgHouseStyle';
import { assessValueTrust } from '@/lib/pricing/valueGuard';
/** OTHER: the generic PriceCharting lookup, with its eBay fallback (Phase 0 §4). */
import { OtherPriceLookup } from '@/components/pricing/OtherPriceLookup';
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
/** OTHER: the generic eBay builders. There is no TCGPlayer link on this
 *  route — an uncategorised collectible has no TCGPlayer product line. */
import {
  generateOtherEbaySearchUrl,
  generateOtherEbaySoldListingsUrl,
  type CardData,
} from '@/lib/ebayUtils';
import type { CardSharingData } from '@/lib/socialUtils';

/** Legacy strips the Japanese half before it searches a marketplace. */
function extractEnglishForSearch(text: string | null | undefined): string | null {
  if (!text) return null;
  if (!/[぀-ゟ゠-ヿ一-龯]/.test(text)) return text;
  const parts = text.split(/[/()（）]/);
  const englishPart = parts.find((p) => p.trim() && !/[぀-ゟ゠-ヿ一-龯]/.test(p));
  return englishPart ? englishPart.trim() : text;
}

interface DcmPriceData {
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  productName: string | null;
  priceChartingUrl?: string;
  marketRange?: MarketRange | null;
  /** The freshness OF THIS RESULT, as the lookup reports it. */
  isCached?: boolean;
  cacheAgeDays?: number | null;
}

export function OtherCardDetailsV2() {
  const params = useParams<{ id: string }>();
  const cardId = typeof params?.id === 'string' ? params.id : '';

  const detail = useCardDetail('other', cardId);
  const card = detail.card;

  // The live PriceCharting lookup, reported by OtherPriceLookup in the
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
            category: 'other',
            sessionUserId,
            isProcessing: detail.isProcessing,
          })
        : null,
    [card, sessionUserId, detail.isProcessing]
  );

  /**
   * OTHER: the legacy `cardInfo` object (other CardDetailClient.tsx
   * 2577-2632). Naming the category matters — 'other' reads the model JSON
   * first, appends the subset with NO frame-treatment filter, reads
   * `cards.manufacturer` rather than `manufacturer_name`, and decides
   * autographed / memorabilia from the JSON ALONE, never from the
   * `autograph_type` / `memorabilia_type` columns. `buildCardInfo` switches on
   * exactly this argument.
   */
  const cardInfo = useMemo(() => buildCardInfo(card, 'other'), [card]);

  // Legacy's rule, verbatim in intent (other CardDetailClient.tsx 5155): only a
  // TRUSTED estimate is shown. A thin-identity card shows the correction
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
   * OTHER: THREE links, not four — legacy's grid is `grid-cols-3` (5205) and
   * carries no TCGPlayer tile at all. The two eBay payloads are legacy's field
   * for field (5208-5250), including `card_date` in place of a year and the
   * graded whole number, and the PriceCharting fallback is legacy's
   * character + name + number query (5260-5266).
   */
  const marketplaceLinks = () => {
    const c: any = card ?? {};

    const cardName =
      extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(c.card_name);
    const character =
      extractEnglishForSearch(cardInfo.player_or_character) || extractEnglishForSearch(c.featured);
    const cardNumber = cardInfo.card_number || c.card_number;

    const ebaySearchCard = {
      category: 'Other',
      card_name: cardName,
      manufacturer:
        extractEnglishForSearch(cardInfo.manufacturer) || extractEnglishForSearch(c.manufacturer),
      card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(c.card_set),
      card_date: cardInfo.card_date || c.card_date,
      card_number: cardNumber,
      dcm_grade_whole: c.conversational_whole_grade,
    } as CardData;

    const priceChartingUrl =
      dcmPriceData?.priceChartingUrl ||
      `https://www.pricecharting.com/search-products?q=${encodeURIComponent(
        [character, cardName, cardNumber].filter(Boolean).join(' ')
      )}&type=prices`;

    const links: Array<[string, string, string]> = [
      ['eBay', generateOtherEbaySearchUrl(ebaySearchCard), 'Active listings'],
      ['eBay sold', generateOtherEbaySoldListingsUrl(ebaySearchCard), 'Price history'],
      ['PriceCharting', priceChartingUrl, 'Market data'],
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
  // OTHER: the strings come from the legacy other generateStructuredData
  // (1409-1522). Legacy omits `brand` ENTIRELY when the card has no
  // manufacturer (1480-1484); the shared builder always emits one, so the
  // generic category name is the fallback — the same departure the sports
  // adapter records, and the only one here.
  const structuredData = card
    ? buildCardStructuredData(
        card,
        `${typeof window !== 'undefined' ? window.location.origin : 'https://dcmgrading.com'}/other/${cardId}`,
        {
          fallbackBrand: 'Trading Cards',
          productCategory: 'Collectible Trading Cards',
          breadcrumbName: 'Other Cards',
          breadcrumbUrl: 'https://dcmgrading.com/upload?category=Other',
          fallbackCardName: 'Collectible Card',
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
      category="other"
      categoryLabel="Other"
      cardId={cardId}
      backHref="/collection"
      /* OTHER: there is no /upload/other route — legacy's not-found and
         retake links are both the query-string form (2213, 6543). */
      uploadHref="/upload?category=Other"
      retakeHref="/upload?category=Other"
      ebayCardType="other"
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
            cardType="other"
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
            cardType="other"
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
          <OtherPriceLookup
            guardIdentity={card as any}
            card={{
              card_name: cardInfo.card_name || (card as any).card_name,
              featured: (extractEnglishForSearch(cardInfo.player_or_character) ||
                extractEnglishForSearch((card as any).featured)) as string | undefined,
              card_set: (extractEnglishForSearch(cardInfo.set_name) ||
                (card as any).card_set) as string | undefined,
              card_number: cardInfo.card_number || (card as any).card_number,
              release_date: cardInfo.year || (card as any).release_date,
              subset: cardInfo.subset,
              rarity_or_variant: cardInfo.rarity_or_variant,
              manufacturer: cardInfo.manufacturer || (card as any).manufacturer,
              // Legacy reads `game_type`, a key the 'other' chain never fills,
              // so this is always the literal 'other' (5178).
              game_type: (cardInfo as any).game_type || 'other',
              // Phase 2C: guard price saves against a concurrent identity fix.
              identity_revision: (card as any).identity_revision as number | null | undefined,
              pricing_selection_revision: (card as any).pricing_selection_revision as
                | number
                | null
                | undefined,
            }}
            cardId={card.id}
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
            cardType="other"
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
      renderCategoryCardInfo={(ctx) => <OtherCardInfo card={ctx.card} cardInfo={cardInfo} />}
      /* OTHER adds no badges: its Special Features list is the shared one
         exactly (other CardDetailClient.tsx 4058-4160), Variant included. */
    />
    </>
  );
}
