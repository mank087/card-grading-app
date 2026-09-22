import { describe, it, expect } from 'vitest';
import type { ItemSpecific } from './itemSpecifics';
import {
  changedDraftFields,
  createListingDraftState,
  dirtyDraftValues,
  isListingDraftDirty,
  listingEditGate,
  listingLockFor,
  rebaseListingDraftDefaults,
  resetListingDraftField,
  resetListingDraftTitle,
  setListingDraftField,
  setListingDraftTitle,
  type ListingDraftValues,
} from './listingDraftState';

const specifics: ItemSpecific[] = [
  { name: 'Brand', value: 'Topps', required: true, editable: true },
  { name: 'Year', value: '1999', required: false, editable: true },
];

const defaults: ListingDraftValues = {
  title: 'Default title',
  descriptionHtml: '<p>default</p>',
  itemSpecifics: specifics,
  price: '10.00',
};

describe('listing draft state', () => {
  it('starts clean, on its defaults', () => {
    const s = createListingDraftState(defaults);
    expect(s.values).toBe(defaults);
    expect(isListingDraftDirty(s)).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({});
  });

  it('marks a changed field dirty and carries only that field', () => {
    const s = setListingDraftField(createListingDraftState(defaults), 'title', 'Mine');
    expect(s.dirty.title).toBe(true);
    expect(s.dirty.price).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({ title: 'Mine' });
  });

  it('is clean again when a field is typed back to its default', () => {
    let s = createListingDraftState(defaults);
    s = setListingDraftField(s, 'price', '11.00');
    expect(s.dirty.price).toBe(true);
    s = setListingDraftField(s, 'price', '10.00');
    expect(s.dirty.price).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({});
  });

  it('compares specifics by content, not by identity', () => {
    const copy = specifics.map((x) => ({ ...x }));
    const s = setListingDraftField(createListingDraftState(defaults), 'itemSpecifics', copy);
    expect(s.dirty.itemSpecifics).toBe(false);

    const edited = specifics.map((x, i) => (i === 0 ? { ...x, value: 'Panini' } : x));
    const s2 = setListingDraftField(createListingDraftState(defaults), 'itemSpecifics', edited);
    expect(s2.dirty.itemSpecifics).toBe(true);
    expect(dirtyDraftValues(s2).itemSpecifics).toBe(edited);
  });

  it('resets one field without touching the others', () => {
    let s = createListingDraftState(defaults);
    s = setListingDraftField(s, 'title', 'Mine');
    s = setListingDraftField(s, 'price', '99.00');
    s = resetListingDraftField(s, 'title');
    expect(s.values.title).toBe(defaults.title);
    expect(s.dirty.title).toBe(false);
    expect(s.values.price).toBe('99.00');
    expect(s.dirty.price).toBe(true);
  });

  describe('rebase, when the saved account defaults arrive late', () => {
    const later: ListingDraftValues = {
      ...defaults,
      title: 'KINGS 9 title',
      descriptionHtml: '<p>store template</p>',
    };

    it('moves an untouched field to the new default', () => {
      const s = rebaseListingDraftDefaults(createListingDraftState(defaults), later);
      expect(s.values.title).toBe('KINGS 9 title');
      expect(s.values.descriptionHtml).toBe('<p>store template</p>');
      expect(isListingDraftDirty(s)).toBe(false);
    });

    it('never clobbers what the owner typed', () => {
      let s = setListingDraftField(createListingDraftState(defaults), 'title', 'Mine');
      s = rebaseListingDraftDefaults(s, later);
      expect(s.values.title).toBe('Mine');
      expect(s.dirty.title).toBe(true);
      // ...while the field they did not touch still follows.
      expect(s.values.descriptionHtml).toBe('<p>store template</p>');
      expect(dirtyDraftValues(s)).toEqual({ title: 'Mine' });
    });

    it('drops the dirty flag when the new default happens to match their text', () => {
      let s = setListingDraftField(createListingDraftState(defaults), 'title', 'KINGS 9 title');
      s = rebaseListingDraftDefaults(s, later);
      expect(s.dirty.title).toBe(false);
      expect(dirtyDraftValues(s)).toEqual({});
    });
  });
});

/**
 * The description's opening line repeats the listing title. These tests use a
 * stand-in builder rather than the real one so the rule is what is under test,
 * not the HTML — `listingSeed.test.ts` covers the real headline swap.
 */
describe('title ↔ description headline', () => {
  const HEAD = (t: string) => `<p class="head">${t}</p>`;
  const sync = {
    render: (title: string) => `${HEAD(title)}<div>body</div>`,
    retitle: (html: string, prev: string, next: string) =>
      html.includes(HEAD(prev)) ? html.replace(HEAD(prev), HEAD(next)) : html,
  };
  const start: ListingDraftValues = {
    title: 'Default title',
    descriptionHtml: sync.render('Default title'),
    itemSpecifics: specifics,
    price: '10.00',
  };

  it('rebuilds an untouched description so the heading matches the new title', () => {
    const s = setListingDraftTitle(createListingDraftState(start), 'New title', sync);
    expect(s.values.descriptionHtml).toBe(sync.render('New title'));
    expect(s.values.descriptionHtml).toContain(HEAD('New title'));
    expect(s.dirty.title).toBe(true);
  });

  /* ── finding 4, 2026-09-22 ─────────────────────────────────────────────
     A title-only edit must NOT hand the modal an HTML body. Doing so made the
     modal treat the description as hand-authored and freeze it: no shipping
     summary, no later title changes, no `{shippingSummary}` in a template. */
  it('carries the TITLE ONLY when the owner never touched the body', () => {
    const s = setListingDraftTitle(createListingDraftState(start), 'New title', sync);
    expect(s.bodyEdited).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({ title: 'New title' });
    expect(dirtyDraftValues(s).descriptionHtml).toBeUndefined();
  });

  it('carries both when the body IS hand-edited, with the headline swapped', () => {
    let s = createListingDraftState(start);
    s = setListingDraftField(s, 'descriptionHtml', `${HEAD('Default title')}<div>MINE</div>`);
    s = setListingDraftTitle(s, 'New title', sync);
    expect(s.bodyEdited).toBe(true);
    const carried = dirtyDraftValues(s);
    expect(carried.title).toBe('New title');
    expect(carried.descriptionHtml).toBe(`${HEAD('New title')}<div>MINE</div>`);
  });

  it('gives up authorship when the body is reset, and stops carrying it', () => {
    let s = createListingDraftState(start);
    s = setListingDraftField(s, 'descriptionHtml', '<div>MINE</div>');
    s = setListingDraftField(s, 'title', 'New title');
    expect(s.bodyEdited).toBe(true);
    s = resetListingDraftField(s, 'descriptionHtml');
    expect(s.bodyEdited).toBe(false);
    expect(dirtyDraftValues(s).descriptionHtml).toBeUndefined();
  });

  it('gives up authorship when the body is typed back to its default', () => {
    let s = createListingDraftState(start);
    s = setListingDraftField(s, 'descriptionHtml', '<div>MINE</div>');
    s = setListingDraftField(s, 'descriptionHtml', start.descriptionHtml);
    expect(s.bodyEdited).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({});
  });

  it('re-renders a clean description for an edited title when late defaults land', () => {
    const later: ListingDraftValues = { ...start, descriptionHtml: '<p>store template</p>' };
    let s = setListingDraftTitle(createListingDraftState(start), 'New title', sync);
    s = rebaseListingDraftDefaults(s, later, sync);
    // The template arrived; the headline is still the owner's title, not the
    // default one the template was rendered with.
    expect(s.values.title).toBe('New title');
    expect(s.values.descriptionHtml).toBe(sync.render('New title'));
    expect(s.bodyEdited).toBe(false);
    expect(dirtyDraftValues(s)).toEqual({ title: 'New title' });
  });

  it('keeps a hand-edited description and still updates its heading', () => {
    let s = createListingDraftState(start);
    s = setListingDraftTitle(s, 'Second title', sync);
    // The owner now rewrites the body, keeping the heading we rendered.
    const handEdited = `${HEAD('Second title')}<div>MY OWN WORDS</div>`;
    s = setListingDraftField(s, 'descriptionHtml', handEdited);
    expect(s.dirty.descriptionHtml).toBe(true);

    // ...and then edits the title again.
    s = setListingDraftTitle(s, 'Third title', sync);
    expect(s.values.descriptionHtml).toContain(HEAD('Third title'));
    expect(s.values.descriptionHtml).toContain('MY OWN WORDS');
    expect(s.values.descriptionHtml).not.toContain(HEAD('Second title'));
    expect(s.values.title).toBe('Third title');
  });

  it('leaves a description whose heading the owner removed entirely alone', () => {
    let s = createListingDraftState(start);
    s = setListingDraftField(s, 'descriptionHtml', '<div>no heading at all</div>');
    s = setListingDraftTitle(s, 'New title', sync);
    expect(s.values.descriptionHtml).toBe('<div>no heading at all</div>');
    expect(s.values.title).toBe('New title');
  });

  it('puts both back when the title is reset and the description was untouched', () => {
    let s = setListingDraftTitle(createListingDraftState(start), 'New title', sync);
    s = resetListingDraftTitle(s, sync);
    expect(s.values.title).toBe(start.title);
    expect(s.values.descriptionHtml).toBe(start.descriptionHtml);
    expect(isListingDraftDirty(s)).toBe(false);
  });

  it('restores the heading on reset without discarding a hand-edited body', () => {
    let s = setListingDraftTitle(createListingDraftState(start), 'New title', sync);
    s = setListingDraftField(s, 'descriptionHtml', `${HEAD('New title')}<div>MINE</div>`);
    s = resetListingDraftTitle(s, sync);
    expect(s.values.title).toBe(start.title);
    expect(s.values.descriptionHtml).toBe(`${HEAD('Default title')}<div>MINE</div>`);
    expect(s.dirty.title).toBe(false);
    expect(s.dirty.descriptionHtml).toBe(true);
  });

  it('does nothing at all when the title did not change', () => {
    const s = createListingDraftState(start);
    expect(setListingDraftTitle(s, start.title, sync)).toBe(s);
  });
});

describe('listingLockFor — one rule for the whole tab', () => {
  it('locks a live listing and offers the link instead of the flow', () => {
    expect(listingLockFor('listed')).toEqual({
      locked: true,
      note: 'This listing is live on eBay — details are locked here. Edit it on eBay.',
      canBegin: false,
    });
  });

  it('locks a sold record', () => {
    const lock = listingLockFor('sold');
    expect(lock.locked).toBe(true);
    expect(lock.canBegin).toBe(false);
    expect(lock.note).toContain('sold');
  });

  it('leaves the fields editable while the check is in flight, but offers nothing yet', () => {
    expect(listingLockFor('checking')).toEqual({ locked: false, note: null, canBegin: false });
  });

  it('opens everything for an unlisted card', () => {
    expect(listingLockFor('unlisted')).toEqual({ locked: false, note: null, canBegin: true });
  });

  it('still offers the flow when the check failed — the modal re-checks itself', () => {
    expect(listingLockFor('unverified')).toEqual({ locked: false, note: null, canBegin: true });
  });

  it('gives a non-owner nothing', () => {
    expect(listingLockFor('not-owner')).toEqual({ locked: true, note: null, canBegin: false });
  });
});

describe('listingEditGate — connect before editing (finding 2)', () => {
  it('locks the fields for a disconnected owner and asks them to connect first', () => {
    const gate = listingEditGate('unlisted', false);
    expect(gate.needsConnect).toBe(true);
    expect(gate.locked).toBe(true);
    // The flow itself is still offered — pressing it is what starts the connect.
    expect(gate.canBegin).toBe(true);
  });

  it('does not lock while the connection status is still unknown', () => {
    const gate = listingEditGate('unlisted', null);
    expect(gate.needsConnect).toBe(false);
    expect(gate.locked).toBe(false);
  });

  it('is exactly listingLockFor once connected', () => {
    for (const state of ['unlisted', 'unverified', 'checking', 'listed', 'sold'] as const) {
      expect(listingEditGate(state, true)).toEqual({
        ...listingLockFor(state),
        needsConnect: false,
      });
    }
  });

  it('keeps the listed/sold note rather than replacing it with a connect prompt', () => {
    const gate = listingEditGate('listed', false);
    expect(gate.needsConnect).toBe(false);
    expect(gate.note).toContain('live on eBay');
  });
});

describe('changedDraftFields', () => {
  it('names only the fields that actually differ', () => {
    expect(changedDraftFields(defaults, defaults)).toEqual([]);
    expect(changedDraftFields(defaults, { ...defaults, title: 'Other' })).toEqual(['title']);
    expect(
      changedDraftFields(defaults, { ...defaults, title: 'Other', price: '12.00' }),
    ).toEqual(['title', 'price']);
  });

  it('compares specifics by content', () => {
    expect(changedDraftFields(defaults, { ...defaults, itemSpecifics: specifics.map((x) => ({ ...x })) })).toEqual([]);
  });
});
