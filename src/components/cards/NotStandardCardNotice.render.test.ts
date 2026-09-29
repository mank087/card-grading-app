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
    expect(html(React.createElement(NotStandardCardTag, { card: { item_type: 'oversized_or_jumbo' } }))).toBe('Not a standard card');
  });
  it('does not label a licensed sticker or say it has no value (1987 Fleer Basketball Stickers)', () => {
    const sticker = { item_type: 'sticker_or_decal' };
    expect(html(React.createElement(NotStandardCardNotice, { card: sticker }))).toBe('');
    expect(html(React.createElement(NotStandardCardTag, { card: sticker }))).toBe('');
  });
  it('keeps the label but drops "no market value" once the owner confirms the item', () => {
    const text = html(React.createElement(NotStandardCardNotice, { card: { item_type: 'custom_or_fan_made', dcm_selected_product_id: 'pc-2' } }));
    expect(text).toContain('Not a standard trading card');
    expect(text).not.toContain('no market value');
    expect(text).toContain('owner chose the pricing product');
  });
  it('renders nothing for a standard card, an unknown read, or before the column exists', () => {
    for (const card of [{ item_type: 'trading_card' }, { item_type: null }, {}, null, { item_type: 'already_graded_slab' }]) {
      expect(html(React.createElement(NotStandardCardNotice, { card: card as any }))).toBe('');
      expect(html(React.createElement(NotStandardCardTag, { card: card as any }))).toBe('');
    }
  });
});
