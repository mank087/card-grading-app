import { describe, it, expect } from 'vitest';
import { buildEbayConnectHref, connectReturnPath } from './connectRedirect';

describe('connectReturnPath', () => {
  it('is unchanged for a legacy page with no search and no hash', () => {
    expect(connectReturnPath({ pathname: '/collection' })).toBe('/collection');
    expect(connectReturnPath({ pathname: '/collection', search: '', hash: '' })).toBe('/collection');
  });

  it('keeps the query, as it always did', () => {
    expect(connectReturnPath({ pathname: '/pokemon/abc', search: '?v=1' })).toBe('/pokemon/abc?v=1');
  });

  it('keeps the fragment — the InstaList tab', () => {
    expect(
      connectReturnPath({ pathname: '/pokemon/abc', search: '', hash: '#instalist' }),
    ).toBe('/pokemon/abc#instalist');
  });

  it('keeps both, in URL order', () => {
    expect(
      connectReturnPath({ pathname: '/pokemon/abc', search: '?v=1', hash: '#instalist' }),
    ).toBe('/pokemon/abc?v=1#instalist');
  });
});

describe('buildEbayConnectHref', () => {
  it('encodes the fragment into the query value so it is not read as this URL’s own', () => {
    const href = buildEbayConnectHref({ pathname: '/pokemon/abc', hash: '#instalist' });
    expect(href).toBe('/ebay/connect?redirect=%2Fpokemon%2Fabc%23instalist');
    expect(href).not.toContain('#');
  });

  it('round-trips through the connect page’s own decode', () => {
    const href = buildEbayConnectHref({ pathname: '/pokemon/abc', hash: '#instalist' });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('redirect')).toBe('/pokemon/abc#instalist');
  });

  it('survives the callback’s URL build, which appends its params before the fragment', () => {
    const returnUrl = connectReturnPath({ pathname: '/pokemon/abc', hash: '#instalist' });
    const url = new URL(returnUrl, 'https://dcmgrading.com');
    url.searchParams.set('ebay_connected', 'true');
    expect(url.toString()).toBe(
      'https://dcmgrading.com/pokemon/abc?ebay_connected=true#instalist',
    );
  });

  it('is byte-for-byte the old behaviour when there is no fragment', () => {
    expect(buildEbayConnectHref({ pathname: '/mtg/xyz', search: '?a=b' })).toBe(
      `/ebay/connect?redirect=${encodeURIComponent('/mtg/xyz?a=b')}`,
    );
  });
});
