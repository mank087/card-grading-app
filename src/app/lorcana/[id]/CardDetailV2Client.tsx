'use client';

/**
 * Lorcana card detail — V2.
 *
 * This is the ADAPTER, and it is meant to stay thin. It is a SIBLING of
 * ./CardDetailClient.tsx, which is not edited for the duration of the project
 * so that `CARD_DETAIL_V2=off` is a complete rollback (plan §4).
 *
 * It is a copy of the MTG adapter with only the things Lorcana genuinely does
 * differently changed — the pricing component, the marketplace links, the
 * structured-data strings, the upload/retake routes and the card-info slot.
 * Every difference is marked LORCANA below so the next category can see at a
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
import { buildCardStructuredData } from '@/lib/cardDetail/structuredData';
import CardDetailShell from '@/components/card-detail/CardDetailShell';
import LorcanaCardInfo from '@/components/card-detail/categories/LorcanaCardInfo';
import ProEstimatesPanel from '@/components/card-detail/sections/ProEstimatesPanel';

import { getStoredSession } from '@/lib/directAuth';
import { useCustomLabelStyleWithOrg } from '@/hooks/useOrgHouseStyle';
import { assessValueTrust } from '@/lib/pricing/valueGuard';
/** LORCANA: the Lorcana PriceCharting lookup (Phase 0 §4). */
import { LorcanaPriceLookup } from '@/components/pricing/LorcanaPriceLookup';
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
/** LORCANA: the Lorcana-specific eBay builders. */
import {
  generateLorcanaEbaySearchUrl,
  generateLorcanaEbaySoldListingsUrl,
  type CardData,
} from '@/lib/ebayUtils';
import {
  generateTCGPlayerSearchUrl,
  generateTCGPlayerSetSearchUrl,
} from '@/lib/tcgplayerUtils';
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

export function LorcanaCardDetailsV2() {
  const params = useParams<{ id: string }>();
  const cardId = typeof params?.id === 'string' ? params.id : '';

  const detail = useCardDetail('lorcana', cardId);
  const card = detail.card;

  // The live PriceCharting lookup, reported by LorcanaPriceLookup in the Market
  // section. It only reaches the hero after assessValueTrust agrees.
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
            category: 'lorcana',
            sessionUserId,
            isProcessing: detail.isProcessing,
          })
        : null,
    [card, sessionUserId, detail.isProcessing]
  );

  /**
   * LORCANA: the legacy `cardInfo` object (lorcana CardDetailClient.tsx
   * 2606-2680). Naming the category matters — Lorcana reads the DATABASE
   * COLUMNS FIRST (the grading route writes verified catalogue values into
   * them), takes the set name only when it passes the client's own validity
   * test, and appends a subset only when the set name does not already contain
   * it. `buildCardInfo` switches on exactly this argument.
   */
  const cardInfo = useMemo(() => buildCardInfo(card, 'lorcana'), [card]);

  // Legacy's rule, verbatim in intent (lorcana CardDetailClient.tsx 5247): only a
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
   * LORCANA: four links. The TCGPlayer and the two eBay payloads are legacy's
   * field for field (5300-5395) — `category: 'Lorcana'`, the character
   * version, the expansion code, `is_enchanted` and `is_foil` — and the
   * PriceCharting fallback search is legacy's own three-part query
   * (character, version, number), not the card name (5424-5432).
   *
   * Legacy also prints a Scryfall link (5400-5420). It is DROPPED: the
   * condition is `card.scryfall_id`, a Magic column a Lorcana row never
   * carries, and the URL would be a Magic card page. See the parity doc.
   */
  const marketplaceLinks = () => {
    const c: any = card ?? {};

    const cardName =
      extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(c.card_name);
    const setName =
      extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(c.card_set);
    const characterVersion =
      extractEnglishForSearch(cardInfo.character_version) ||
      extractEnglishForSearch(c.character_version);

    const searchCard = {
      category: 'Lorcana',
      card_name: cardName,
      featured:
        extractEnglishForSearch(cardInfo.player_or_character) ||
        extractEnglishForSearch(c.featured),
      character_version: characterVersion,
      card_set: setName,
      card_number: cardInfo.card_number || c.card_number,
      expansion_code: cardInfo.expansion_code || c.expansion_code,
      is_enchanted: cardInfo.is_enchanted || c.is_enchanted || false,
      is_foil: cardInfo.is_foil || c.is_foil || false,
    } as CardData;

    // Legacy 5359/5388 adds the graded whole number to the eBay payloads only.
    const ebaySearchCard = {
      ...searchCard,
      dcm_grade_whole:
        c.conversational_whole_grade ||
        c.dvg_grading?.recommended_grade?.recommended_whole_grade,
    } as CardData;

    const tcgplayerUrl =
      generateTCGPlayerSetSearchUrl(searchCard) || generateTCGPlayerSearchUrl(searchCard);

    const priceChartingUrl =
      dcmPriceData?.priceChartingUrl ||
      `https://www.pricecharting.com/search-products?q=${encodeURIComponent(
        [
          extractEnglishForSearch(cardInfo.player_or_character) ||
            extractEnglishForSearch(c.featured),
          characterVersion,
          cardInfo.card_number || c.card_number,
        ]
          .filter(Boolean)
          .join(' ')
      )}&type=prices`;

    const links: Array<[string, string, string]> = [
      ['TCGPlayer', tcgplayerUrl, setName && setName !== 'Unknown' ? setName : 'Search listings'],
      ['eBay', generateLorcanaEbaySearchUrl(ebaySearchCard), 'Active listings'],
      ['eBay sold', generateLorcanaEbaySoldListingsUrl(ebaySearchCard), 'Price history'],
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
  // LORCANA: the four strings come from the legacy lorcana
  // generateStructuredData (1429-1550). Note the breadcrumb href is the
  // QUERY-STRING upload route, which is legacy's (1543) and differs from the
  // /upload/<category> shape the other categories use.
  const structuredData = card
    ? buildCardStructuredData(
        card,
        `${typeof window !== 'undefined' ? window.location.origin : 'https://dcmgrading.com'}/lorcana/${cardId}`,
        {
          fallbackBrand: 'Disney Lorcana',
          productCategory: 'Disney Lorcana Trading Cards',
          breadcrumbName: 'Lorcana Cards',
          breadcrumbUrl: 'https://dcmgrading.com/upload?category=Lorcana',
          fallbackCardName: 'Lorcana Card',
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
      category="lorcana"
      categoryLabel="Disney Lorcana"
      cardId={cardId}
      backHref="/collection"
      /* LORCANA: legacy's not-found link is /lorcana/upload, not /upload/lorcana. */
      uploadHref="/lorcana/upload"
      retakeHref="/upload?category=Lorcana"
      ebayCardType="lorcana"
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
            cardType="lorcana"
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
            cardType="lorcana"
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
          <LorcanaPriceLookup
            guardIdentity={card as any}
            card={{
              id: card.id,
              card_name: cardInfo.card_name || (card as any).card_name,
              set_name: cardInfo.set_name || (card as any).card_set,
              collector_number: cardInfo.card_number || (card as any).card_number,
              year: cardInfo.year || (card as any).release_date,
              // Legacy reads `rarity` first and only then `rarity_tier`; the
              // first key does not exist on the object, so `rarity_tier` wins.
              rarity_or_variant: (cardInfo as any).rarity || cardInfo.rarity_tier,
              // Foil-aware: a foil copy is a different product on PriceCharting.
              is_foil: cardInfo.is_foil || (card as any).is_foil || false,
              dcm_selected_product_id: (card as any).dcm_selected_product_id ?? undefined,
              dcm_selected_product_name: (card as any).dcm_selected_product_name ?? undefined,
              // Phase 2C: guard price saves against a concurrent identity fix.
              identity_revision: (card as any).identity_revision as number | null | undefined,
              pricing_selection_revision: (card as any).pricing_selection_revision as
                | number
                | null
                | undefined,
            }}
            dcmGrade={
              (card as any).conversational_decimal_grade ??
              (card as any).dvg_grading?.recommended_grade?.recommended_decimal_grade ??
              undefined
            }
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
            cardType="lorcana"
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
      renderCategoryCardInfo={(ctx) => <LorcanaCardInfo card={ctx.card} cardInfo={cardInfo} />}
      /* LORCANA adds no badges: its Special Features list is the shared one
         exactly (lorcana CardDetailClient.tsx 4162-4256), Variant included. */
    />
    </>
  );
}
