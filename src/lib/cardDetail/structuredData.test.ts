import { describe, it, expect } from 'vitest';
import { buildCardStructuredData, type StructuredDataCategoryConfig } from './structuredData';

const pokemon: StructuredDataCategoryConfig = {
  fallbackBrand: 'Pokemon',
  productCategory: 'Pokemon Trading Cards',
  breadcrumbName: 'Pokemon Cards',
  breadcrumbUrl: 'https://dcmgrading.com/upload/pokemon',
  fallbackCardName: 'Pokemon Card',
};
const url = 'https://dcmgrading.com/pokemon/abc';

describe('buildCardStructuredData', () => {
  it('builds the product and breadcrumb schemas for a graded card', () => {
    const [product, crumbs]: any[] = buildCardStructuredData({
      featured: 'Lugia', release_date: '2000', card_set: 'Neo Genesis',
      front_url: 'https://img/front.jpg', conversational_decimal_grade: 7,
    }, url, pokemon);

    expect(product.name).toBe('Lugia 2000 Neo Genesis');
    expect(product.description).toContain('DCM graded 7/10');
    expect(product.brand.name).toBe('Pokemon');
    expect(product.category).toBe('Pokemon Trading Cards');
    expect(product.aggregateRating.ratingValue).toBe(7);
    expect(product.url).toBe(url);
    expect(crumbs.itemListElement[1]).toMatchObject({ name: 'Pokemon Cards', item: pokemon.breadcrumbUrl });
    expect(crumbs.itemListElement[2].name).toBe('Lugia 2000 Neo Genesis');
  });

  it('prefers dvg_grading card_info and the manufacturer brand', () => {
    const [product]: any[] = buildCardStructuredData({
      featured: 'ignored', card_set: 'ignored',
      dvg_grading: { card_info: { player_or_character: 'Pikachu', manufacturer: 'Wizards', set_name: 'Base' },
        rarity_features: { rookie_or_first: 'true', autograph: { present: true } } },
    }, url, pokemon);

    expect(product.name).toBe('Pikachu Wizards Base');
    expect(product.brand.name).toBe('Wizards');
    const names = product.additionalProperty.map((p: any) => p.name);
    expect(names).toEqual(['Manufacturer', 'Set', 'Card Type', 'Autograph']);
  });

  it('omits the rating and says N/A when there is no grade', () => {
    const [product, crumbs]: any[] = buildCardStructuredData({}, url, pokemon);
    expect(product.aggregateRating).toBeUndefined();
    expect(product.description).toContain('DCM graded N/A');
    expect(crumbs.itemListElement[2].name).toBe('Pokemon Card');
  });

  it('falls back to the dvg recommended grade when the conversational grade is absent', () => {
    const [product]: any[] = buildCardStructuredData({
      dvg_grading: { recommended_grade: { recommended_decimal_grade: 8 } },
    }, url, pokemon);
    expect(product.aggregateRating.ratingValue).toBe(8);
  });
});
