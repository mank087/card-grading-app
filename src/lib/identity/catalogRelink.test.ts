import { describe, expect, it } from 'vitest';
import { namesCompatible, setsAgree } from './catalogRelink';
import { buildIdentityPatch } from './saveCardIdentity';

describe('catalog relink name guard', () => {
  it('accepts the same card and crossover names, rejects a different card', () => {
    expect(namesCompatible('Lotus Petal', 'Lotus Petal')).toBe(true);
    expect(namesCompatible('Jackal Pup', 'Jackal Pup')).toBe(true);
    expect(namesCompatible('Throw from the Saddle', 'Throw from the Saddle')).toBe(true);
    // Production: "Astral Titan" came back from a number search as Primeval Titan.
    expect(namesCompatible('Astral Titan', 'Primeval Titan')).toBe(false);
    expect(namesCompatible('Doctor Doom', 'Some Other Name', 'Doctor Doom')).toBe(true);
    expect(namesCompatible(null, 'Lotus Petal')).toBe(false);
  });
});

describe('catalog relink set guard', () => {
  it('respects the owner-saved set, tolerating spelling and containment', () => {
    expect(setsAgree('Judgement ', 'Judgment')).toBe(true);
    expect(setsAgree('Final Fantasy', 'Final Fantasy Commander')).toBe(true);
    expect(setsAgree('Tempest ', 'Tempest')).toBe(true);
    expect(setsAgree(null, 'Dissension')).toBe(true);
    expect(setsAgree('Teenage Mutant Ninja Turtles', 'Dissension')).toBe(false);
  });
});

describe('featured name fill is not an identity change', () => {
  const mtgCard = () => ({ id: 'c', category: 'MTG', card_name: 'Lotus Petal', featured: null, card_set: 'Tempest', card_number: '294', conversational_card_info: {} });

  it('filling a blank featured with the card name is not material (Sept 23: it wiped correct MTG links)', () => {
    const patch = buildIdentityPatch({ featured: 'Lotus Petal' }, mtgCard());
    expect(patch.changedFields).toContain('featured');
    expect(patch.material).toBe(false);
  });

  it('a different featured name, or changing the card name too, still is', () => {
    expect(buildIdentityPatch({ featured: 'Black Lotus' }, mtgCard()).material).toBe(true);
    expect(buildIdentityPatch({ featured: 'Lotus Bloom', card_name: 'Lotus Bloom' }, mtgCard()).material).toBe(true);
    expect(buildIdentityPatch({ card_number: '295' }, mtgCard()).material).toBe(true);
  });
});

describe('first look identity for catalog linking', () => {
  it('reads title/subject, set and number values from a first-look record', async () => {
    const { firstLookIdentity } = await import('./catalogRelink');
    const rec = { result: { identity: { card_title: { value: 'Lotus Petal', source: 'printed' }, subject: { value: null }, set_name: { value: 'Tempest' }, card_number: { value: '294' } } } };
    expect(firstLookIdentity(rec)).toEqual({ name: 'Lotus Petal', set: 'Tempest', number: '294' });
    expect(firstLookIdentity(JSON.stringify(rec))).toEqual({ name: 'Lotus Petal', set: 'Tempest', number: '294' });
    expect(firstLookIdentity({ result: { identity: { card_title: { value: '  ' } } } })).toBeNull();
    expect(firstLookIdentity(null)).toBeNull();
  });
});
