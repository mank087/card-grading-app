'use client';

/**
 * Pokemon card detail — V2 (redesign pilot).
 *
 * This is the ADAPTER, and it is meant to stay thin. It is a SIBLING of
 * ./CardDetailClient.tsx, which is not edited for the duration of the project
 * so that `CARD_DETAIL_V2=off` is a complete rollback (plan §4).
 *
 * Its whole job:
 *   1. call `useCardDetail('pokemon', id)` for the data,
 *   2. build the normalised view model,
 *   3. supply the four genuinely Pokemon-specific things — the pricing
 *      component, the eBay/TCGPlayer search links, the download button's
 *      `cardType`, and the share payload,
 *   4. hand all of it to `CardDetailShell`.
 *
 * Everything else lives in src/components/card-detail/ and is shared with the
 * seven categories still to come. The adapter axis the Phase 0 inventory
 * identified — "identity fields + which pricing component + which anchors
 * exist" — is exactly what is below and nothing more.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Script from 'next/script';

import { useCardDetail } from '@/components/card-detail/useCardDetail';
import { buildCardDetailViewModel } from '@/lib/cardDetail/viewModel';
import { extractConditionSummary } from '@/lib/cardDetail/parsers';
import { buildCardInfo } from '@/lib/cardDetail/cardInfo';
import { buildCardStructuredData } from '@/lib/cardDetail/structuredData';
import CardDetailShell from '@/components/card-detail/CardDetailShell';
import PokemonCardInfo from '@/components/card-detail/categories/PokemonCardInfo';
import ProEstimatesPanel from '@/components/card-detail/sections/ProEstimatesPanel';

import { getStoredSession } from '@/lib/directAuth';
import { useCustomLabelStyleWithOrg } from '@/hooks/useOrgHouseStyle';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { assessValueTrust } from '@/lib/pricing/valueGuard';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { PokemonPriceLookup } from '@/components/pricing/PokemonPriceLookup';
import {
  generatePokemonEbaySearchUrl,
  generatePokemonEbaySoldListingsUrl,
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
  const englishPart = parts.find(
    (p) => p.trim() && !/[぀-ゟ゠-ヿ一-龯]/.test(p)
  );
  return englishPart ? englishPart.trim() : text;
}

interface DcmPriceData {
  estimatedValue: number | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  productName: string | null;
  priceChartingUrl?: string;
  marketRange?: { low: number; median: number; high: number } | null;
}

export function PokemonCardDetailsV2() {
  const params = useParams<{ id: string }>();
  const cardId = typeof params?.id === 'string' ? params.id : '';

  const detail = useCardDetail('pokemon', cardId);
  const card = detail.card;

  // The live PriceCharting lookup, reported by PokemonPriceLookup in the
  // Market section. It only reaches the hero after assessValueTrust agrees.
  const [dcmPriceData, setDcmPriceData] = useState<DcmPriceData | null>(null);

  // Org-graded cards render the store's house design; otherwise the viewer's
  // own Label Studio style. Same hook, same account-wide persistence as legacy.
  const { labelStyle, customStyles, colorOverrides, activeConfig, switchStyle } =
    useCustomLabelStyleWithOrg((card as any)?.org_id);
  const heritageSel = resolveHeritageSelection(labelStyle, activeConfig);
  const heritageBandColors = heritageSel.active
    ? (heritageSel.bandColors ?? resolveHeritageBandColors((card as any)?.card_colors))
    : [];

  const sessionUserId = getStoredSession()?.user?.id ?? null;

  const vm = useMemo(
    () =>
      card
        ? buildCardDetailViewModel({
            card: card as any,
            category: 'pokemon',
            sessionUserId,
            isProcessing: detail.isProcessing,
          })
        : null,
    [card, sessionUserId, detail.isProcessing]
  );

  /**
   * The legacy `cardInfo` object (CardDetailClient.tsx 2568-2626), now built
   * by the shared `buildCardInfo` so the Card Information block, the price
   * lookup and the marketplace links all read one copy of the precedence.
   */
  const cardInfo = useMemo(() => buildCardInfo(card), [card]);

  // Legacy's rule, verbatim in intent (CardDetailClient.tsx 3498-3520): only a
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

  const marketplaceLinks = () => {
    const c: any = card ?? {};
    const pokemonName =
      extractEnglishForSearch(cardInfo.player_or_character) ||
      extractEnglishForSearch(c.featured) ||
      c.pokemon_featured;
    const setName =
      extractEnglishForSearch(cardInfo.set_name) ||
      extractEnglishForSearch(cardInfo.set_era) ||
      c.card_set;

    const searchCard = {
      featured: pokemonName,
      card_set: setName,
      card_number: cardInfo.card_number || c.card_number,
      subset: cardInfo.rarity_tier || cardInfo.subset || c.subset,
    } as CardData;

    // Direct tcgplayer.com links only — the prices.pokemontcg.io redirects
    // time out, which is why legacy filters on the hostname.
    const storedUrl =
      c.tcgplayer_url ||
      c.conversational_card_info?.tcgplayer_url ||
      c.pokemon_api_data?.tcgplayer?.url;
    const tcgplayerUrl =
      storedUrl && String(storedUrl).includes('tcgplayer.com')
        ? storedUrl
        : generateTCGPlayerSetSearchUrl(searchCard) || generateTCGPlayerSearchUrl(searchCard);

    const ebaySearchCard = {
      featured: pokemonName,
      card_number: cardInfo.card_number || c.card_number,
    } as CardData;

    // Legacy 5592-5613: the PriceCharting product page when the lookup found
    // one, otherwise a search on the name and number.
    const priceChartingUrl =
      dcmPriceData?.priceChartingUrl ||
      `https://www.pricecharting.com/search-products?q=${encodeURIComponent(
        [pokemonName, cardInfo.card_number || c.card_number].filter(Boolean).join(' ')
      )}&type=prices`;

    const links: Array<[string, string, string]> = [
      ['TCGPlayer', tcgplayerUrl, setName && setName !== 'Unknown' ? setName : 'Search listings'],
      ['eBay', generatePokemonEbaySearchUrl(ebaySearchCard), 'Active listings'],
      ['eBay sold', generatePokemonEbaySoldListingsUrl(ebaySearchCard), 'Recent sold prices'],
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
  const structuredData = card
    ? buildCardStructuredData(
        card,
        `${typeof window !== 'undefined' ? window.location.origin : 'https://dcmgrading.com'}/pokemon/${cardId}`,
        {
          fallbackBrand: 'Pokemon',
          productCategory: 'Pokemon Trading Cards',
          breadcrumbName: 'Pokemon Cards',
          breadcrumbUrl: 'https://dcmgrading.com/upload/pokemon',
          fallbackCardName: 'Pokemon Card',
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
      category="pokemon"
      categoryLabel="Pokémon"
      cardId={cardId}
      backHref="/collection"
      uploadHref="/upload/pokemon"
      retakeHref="/upload?category=Pokemon"
      ebayCardType="pokemon"
      detail={detail}
      vm={vm}
      labelStyle={labelStyle}
      customStyles={customStyles}
      activeConfig={activeConfig ?? null}
      colorOverrides={colorOverrides}
      heritageBandColors={heritageBandColors}
      onSwitchStyle={switchStyle}
      liveEstimate={liveEstimate}
      marketRange={marketRange}
      conditionSummary={conditionSummary}
      shareData={shareData}
      renderDownloadButton={() =>
        card ? (
          <DownloadReportButton
            card={card}
            cardType="pokemon"
            showFounderEmblem={detail.emblems.showFounderEmblem}
            showVipEmblem={detail.emblems.showVipEmblem}
            showCardLoversEmblem={detail.emblems.showCardLoversEmblem}
            labelStyle={labelStyle}
            customLabelConfig={activeConfig}
          />
        ) : null
      }
      renderHolderDownload={(holder) =>
        card ? (
          <DownloadReportButton
            card={card}
            cardType="pokemon"
            showFounderEmblem={detail.emblems.showFounderEmblem}
            showVipEmblem={detail.emblems.showVipEmblem}
            showCardLoversEmblem={detail.emblems.showCardLoversEmblem}
            labelStyle={labelStyle}
            customLabelConfig={activeConfig}
            holderDownload={holder}
          />
        ) : null
      }
      renderPricing={() =>
        card ? (
          <PokemonPriceLookup
            guardIdentity={card as any}
            card={{
              id: card.id,
              player_or_character: cardInfo.player_or_character,
              card_name: cardInfo.card_name,
              year: cardInfo.year,
              set_name: cardInfo.set_name,
              card_number: cardInfo.card_number,
              rarity_or_variant: cardInfo.rarity_or_variant,
              holofoil: cardInfo.holofoil,
              first_edition: cardInfo.first_edition,
              reverse_holo: cardInfo.reverse_holo,
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
      renderCategoryCardInfo={(ctx) => (
        <PokemonCardInfo
          card={ctx.card}
          cardInfo={cardInfo}
          currentUserId={ctx.currentUserId}
          isOwner={ctx.isOwner}
          onEdited={ctx.onEdited}
        />
      )}
    />
    </>
  );
}
