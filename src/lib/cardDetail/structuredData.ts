/**
 * JSON-LD (Product + BreadcrumbList) for a card detail page.
 *
 * Extracted from the legacy clients so fixes there can be mirrored:
 *   generateStructuredData   pokemon 1391-1514
 *   dvgGrading merge rules   pokemon 2488-2527 (only the three fields read here)
 *
 * Output parity with legacy is the point: same names, same description
 * wording, same fallbacks. The category-specific strings legacy hard-codes
 * ('Pokemon', 'Pokemon Trading Cards', breadcrumb label and href) are
 * parameters so the other seven categories can reuse this.
 */

export interface StructuredDataCategoryConfig {
  /** Brand name used when the card has no manufacturer. Legacy pokemon: 'Pokemon'. */
  fallbackBrand: string;
  /** schema.org Product.category. Legacy pokemon: 'Pokemon Trading Cards'. */
  productCategory: string;
  /** Second breadcrumb. Legacy pokemon: 'Pokemon Cards' → /upload/pokemon. */
  breadcrumbName: string;
  breadcrumbUrl: string;
  /** Third breadcrumb name when the card has no name. Legacy pokemon: 'Pokemon Card'. */
  fallbackCardName: string;
}

export function buildCardStructuredData(
  card: any,
  cardUrl: string,
  config: StructuredDataCategoryConfig,
): object[] {
  const dvg = card?.dvg_grading && Object.keys(card.dvg_grading).length > 0 ? card.dvg_grading : {};
  // Legacy overrides recommended_grade with the conversational grade when truthy.
  const grade = card?.conversational_decimal_grade
    ? card.conversational_decimal_grade
    : dvg?.recommended_grade?.recommended_decimal_grade;

  const playerName = dvg?.card_info?.player_or_character || card.featured || '';
  const year = dvg?.card_info?.year || card.release_date || '';
  const manufacturer = dvg?.card_info?.manufacturer || '';
  const setName = dvg?.card_info?.set_name || card.card_set || '';
  const cardName = dvg?.card_info?.card_name || card.card_name || '';
  const subset = dvg?.card_info?.subset || '';

  const fullCardName = [playerName, year, manufacturer, setName, subset]
    .filter(p => p)
    .join(' ') || cardName;

  const hasGrade = grade !== null && grade !== undefined;
  const gradeText = hasGrade ? `${grade}/10` : 'N/A';
  const description = `${fullCardName} - DCM graded ${gradeText}. Professional sports card grading with DCM-powered analysis.`;

  const isRookie = dvg?.rarity_features?.rookie_or_first === 'true' ||
                   dvg?.rarity_features?.feature_tags?.includes('rookie_card');
  const hasAuto = dvg?.rarity_features?.autograph?.present;

  const additionalProperty: object[] = [];
  const push = (name: string, value: unknown) =>
    additionalProperty.push({ '@type': 'PropertyValue', name, value });

  if (year) push('Year', year);
  if (manufacturer) push('Manufacturer', manufacturer);
  if (setName) push('Set', setName);
  if (hasGrade) push('DCM Grade', gradeText);
  if (isRookie) push('Card Type', 'Rookie Card');
  if (hasAuto) push('Autograph', 'Yes');

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: fullCardName,
    description,
    image: card.front_url,
    brand: { '@type': 'Brand', name: manufacturer || config.fallbackBrand },
    category: config.productCategory,
    aggregateRating: hasGrade ? {
      '@type': 'AggregateRating',
      ratingValue: grade,
      bestRating: 10,
      worstRating: 1,
      ratingCount: 1,
    } : undefined,
    additionalProperty,
    url: cardUrl,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
      { '@type': 'ListItem', position: 2, name: config.breadcrumbName, item: config.breadcrumbUrl },
      { '@type': 'ListItem', position: 3, name: fullCardName || config.fallbackCardName, item: cardUrl },
    ],
  };

  return [productSchema, breadcrumbSchema];
}
