import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NotStandardCardNotice, { NotStandardCardTag } from './NotStandardCardNotice';

(globalThis as any).React = React; // vitest's esbuild uses the classic JSX runtime

const html = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('"Not a standard trading card" label', () => {
  it('labels the Elite Trainer Box divider production priced as a card', () => {
    const text = html(React.createElement(NotStandardCardNotice, { card: { item_type: 'accessory_not_a_card' } }));
    expect(text).toContain('Not a standard trading card');
    expect(text).toContain('graded for condition but has no market value');
    expect(text).not.toContain('—');
    expect(html(React.createElement(NotStandardCardTag, { card: { item_type: 'sticker_or_decal' } }))).toBe('Not a standard card');
  });
  it('renders nothing for a standard card, an unknown read, or before the column exists', () => {
    for (const card of [{ item_type: 'trading_card' }, { item_type: null }, {}, null, { item_type: 'already_graded_slab' }]) {
      expect(html(React.createElement(NotStandardCardNotice, { card: card as any }))).toBe('');
      expect(html(React.createElement(NotStandardCardTag, { card: card as any }))).toBe('');
    }
  });
});
