import { describe, expect, it } from 'vitest';
import { DESCRIPTION_TEMPLATE_PRESETS, generateHtmlDescription, templateMergeFieldError, type ListingDescriptionFields } from './listingDescription';

const fields: ListingDescriptionFields = {
  primaryName: 'Dale Murphy', setName: 'Topps Rookie Catchers', cardNumber: '476', grade: 8, conditionLabel: 'Near Mint-Mint',
  overview: 'A strong, well-kept card.', subgrades: { centering: 9, corners: 8, edges: 8, surface: 9 }, serial: '409780',
  title: '1977 Topps Rookie Catchers Dale Murphy #476 DCM 8', fields: null as any, details: [], keywords: '', designation: null as any, shippingSummary: 'Ships fast.',
};

describe('templateMergeFieldError', () => {
  it('refuses a rendered description (one card, no merge fields)', () => {
    const rendered = generateHtmlDescription(fields);
    expect(rendered).not.toContain('{cardName}');
    expect(templateMergeFieldError(rendered)).toMatch(/finished description for one card/);
  });
  it('accepts every starter preset', () => {
    for (const p of DESCRIPTION_TEMPLATE_PRESETS) expect(templateMergeFieldError(p.template)).toBeNull();
  });
  it('accepts a minimal template that names the card', () => {
    expect(templateMergeFieldError('<p>{cardName} graded {grade}</p>')).toBeNull();
    expect(templateMergeFieldError('<p>Serial {serial}</p>')).toBeNull();
  });
  it('refuses a rendered description even after a merge field is typed into it', () => {
    const rendered = generateHtmlDescription(fields).replace('Dale Murphy', '{cardName}');
    expect(rendered).toContain('{cardName}');
    expect(templateMergeFieldError(rendered)).toMatch(/specific card.s serial number/);
    expect(templateMergeFieldError('<p>{cardName}</p><p>Serial: <b>409780</b></p>')).toMatch(/serial number/);
    expect(templateMergeFieldError('<p>{cardName}</p><p>Serial: {serial}</p>')).toBeNull();
  });
  it('refuses a template whose only merge fields do not identify the card', () => {
    expect(templateMergeFieldError('<p>Graded {grade} by {brandName}</p>')).toMatch(/identifies the card/);
  });
});
