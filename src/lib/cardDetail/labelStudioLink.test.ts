import { describe, it, expect } from 'vitest';
import {
  isValidCardReturnPath,
  readCardReturnPath,
  readHolderParam,
  buildLabelStudioHref,
} from './labelStudioLink';

const ID = 'eb811bce-60b9-4f3d-bea3-a968d7b40850';

describe('isValidCardReturnPath', () => {
  it('accepts every category with a uuid-shaped id', () => {
    for (const c of ['pokemon', 'sports', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other']) {
      expect(isValidCardReturnPath(`/${c}/${ID}`)).toBe(true);
    }
  });

  it('rejects anything that leaves the app or the card route', () => {
    const bad = [
      null,
      undefined,
      '',
      'pokemon/' + ID,
      `https://evil.example/pokemon/${ID}`,
      `//evil.example/pokemon/${ID}`,
      `/\\evil.example/pokemon/${ID}`,
      `/admin/${ID}`,
      `/pokemon/${ID}/edit`,
      `/pokemon/${ID}?x=1`,
      `/pokemon/${ID}#hash`,
      '/pokemon/not-a-uuid',
      `/pokemon/${ID}${ID}`,
      'javascript:alert(1)',
      `/POKEMON/${ID}`,
    ];
    for (const v of bad) expect(isValidCardReturnPath(v as never)).toBe(false);
  });

  it('readCardReturnPath returns the path or null', () => {
    expect(readCardReturnPath(`/mtg/${ID}`)).toBe(`/mtg/${ID}`);
    expect(readCardReturnPath('/shop')).toBeNull();
  });
});

describe('readHolderParam', () => {
  it('accepts the three holder ids only', () => {
    expect(readHolderParam('slab')).toBe('slab');
    expect(readHolderParam('toploader')).toBe('toploader');
    expect(readHolderParam('onetouch')).toBe('onetouch');
    expect(readHolderParam('digital')).toBeNull();
    expect(readHolderParam(null)).toBeNull();
  });
});

describe('buildLabelStudioHref', () => {
  it('keeps the existing serial-only contract when given no options', () => {
    expect(buildLabelStudioHref('DCM-123')).toBe('/labels?card=DCM-123');
  });

  it('falls back to /labels with no serial', () => {
    expect(buildLabelStudioHref(null)).toBe('/labels');
    expect(buildLabelStudioHref('')).toBe('/labels');
  });

  it('encodes the serial', () => {
    expect(buildLabelStudioHref('DCM 1/2')).toBe('/labels?card=DCM+1%2F2');
  });

  it('adds holder, style and a valid return', () => {
    const href = buildLabelStudioHref('DCM-1', {
      holder: 'onetouch',
      style: 'heritage',
      returnPath: `/pokemon/${ID}`,
    });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('card')).toBe('DCM-1');
    expect(params.get('holder')).toBe('onetouch');
    expect(params.get('style')).toBe('heritage');
    expect(params.get('return')).toBe(`/pokemon/${ID}`);
  });

  it('drops an off-site return target', () => {
    const href = buildLabelStudioHref('DCM-1', { returnPath: 'https://evil.example/' });
    expect(href).toBe('/labels?card=DCM-1');
  });

  it('drops an unknown holder', () => {
    const href = buildLabelStudioHref('DCM-1', { holder: 'binder' as never });
    expect(href).toBe('/labels?card=DCM-1');
  });
});
