'use client';

/**
 * The editable half of the InstaList tab, in two parts (Phase 2, O1):
 *
 *   InstaListFields       — title and price, open, above the Continue button;
 *   InstaListMoreFields   — description and item specifics, each inside a
 *                           collapsed <details> BELOW the button.
 *
 * COLLAPSING IS DISPLAY ONLY. Every value lives in the page's draft
 * (../useListingDraft), not in these components, and a closed <details> keeps
 * its content mounted — so an edit made and then collapsed still carries into
 * the modal through `initialDraft`, and the title → description-headline sync
 * (done inside the draft's `setField('title')`) runs whether or not the
 * Description section is open. A collapsed section the owner has edited says
 * so in its summary ("Edited", from the draft's own `dirty` flags), so an edit
 * is never out of sight AND out of mind.
 *
 * EVERY EDIT IS SESSION-ONLY. Nothing here writes to the database; the state
 * lives in the page (see ../useListingDraft) and is gone on reload. What it is
 * FOR is the hand-off: when the owner presses "Continue to eBay", the fields they
 * actually changed are carried into `EbayListingModal` and everything else is
 * seeded by the modal as usual.
 *
 * THE DESCRIPTION is shown RENDERED, through the same `sanitizeListingHtml` the
 * modal's own preview uses — so the in-app preview cannot execute a script or a
 * handler that a store's saved template carried in, while the HTML that
 * actually goes to eBay stays untouched. "Source" swaps the rendered block for
 * a textarea over the raw HTML. There is no rich-text editor and there should
 * not be one: eBay descriptions are hand-authored HTML templates.
 */

import { useId, useState } from 'react';
import { sanitizeListingHtml } from '@/lib/ebay/listingDescription';
import { EBAY_TITLE_MAX_LENGTH } from '@/lib/ebay/listingSeed';
import type { ItemSpecific } from '@/lib/ebay/itemSpecifics';
import type { ListingDraftField } from '@/lib/ebay/listingDraftState';
import type { UseListingDraftResult } from '../useListingDraft';

export interface InstaListFieldsProps {
  draft: UseListingDraftResult;
  /** Listed, sold, or not connected yet: everything is greyed and read-only. */
  locked: boolean;
  /**
   * Why the fields are read-only, when the reason is something the owner can
   * act on — today, only "connect eBay first" (review 2026-09-22, finding 2).
   * Null for the listed/sold locks, which carry their own note above.
   */
  readOnlyNote?: string | null;
}

function specificValueText(value: ItemSpecific['value']): string {
  return Array.isArray(value) ? value.join(', ') : String(value ?? '');
}

/** A "Reset" that appears only once a field differs from its default. */
function ResetLink({
  field,
  draft,
  locked,
  label,
}: {
  field: ListingDraftField;
  draft: UseListingDraftResult;
  locked: boolean;
  label: string;
}) {
  if (locked || !draft.dirty[field]) return null;
  return (
    <button
      type="button"
      className="cd-quiet cd-instalist-reset"
      onClick={() => draft.resetField(field)}
    >
      Reset {label}
    </button>
  );
}

/**
 * Shown in a section's summary when the owner has changed something inside it,
 * so a collapsed section never hides an edit.
 */
function EditedPill() {
  return <span className="cd-instalist-edited">Edited</span>;
}

export function InstaListFields({ draft, locked, readOnlyNote = null }: InstaListFieldsProps) {
  const ids = useId();
  const titleId = `cd-il-title-${ids}`;
  const priceId = `cd-il-price-${ids}`;

  const { values, setField } = draft;

  return (
    <div className="cd-instalist-fields" aria-disabled={locked || undefined}>
      {readOnlyNote && (
        <p className="cd-caption cd-instalist-readonly-note" role="note">
          {readOnlyNote}
        </p>
      )}

      {/* A correction to the card itself moved the fields nobody had edited. */}
      {draft.rebasedFromCard && !locked && (
        <p className="cd-instalist-rebase-note" role="status">
          <span>Updated from card details.</span>
          <button type="button" className="cd-quiet" onClick={draft.dismissRebaseNote}>
            Dismiss
          </button>
        </p>
      )}
      {/* ── title ─────────────────────────────────────────────────────── */}
      <section className="cd-panel" aria-labelledby={`${titleId}-h`}>
        <p className="cd-eyebrow">What buyers search</p>
        <h3 id={`${titleId}-h`} className="cd-instalist-h3">
          Listing title
        </h3>
        <label className="cd-instalist-label" htmlFor={titleId}>
          Title
        </label>
        <input
          id={titleId}
          type="text"
          className="cd-instalist-input"
          value={values.title}
          maxLength={EBAY_TITLE_MAX_LENGTH}
          disabled={locked}
          aria-describedby={`${titleId}-count`}
          onChange={(e) => setField('title', e.target.value.substring(0, EBAY_TITLE_MAX_LENGTH))}
        />
        <p className="cd-caption" id={`${titleId}-count`}>
          {values.title.length}/{EBAY_TITLE_MAX_LENGTH} characters — eBay&rsquo;s limit. The
          description&rsquo;s opening line repeats this title and follows it as you type.
        </p>
        <ResetLink field="title" draft={draft} locked={locked} label="title" />
      </section>

      {/* ── price ─────────────────────────────────────────────────────── */}
      <section className="cd-panel" aria-labelledby={`${priceId}-h`}>
        <p className="cd-eyebrow">What you are asking</p>
        <h3 id={`${priceId}-h`} className="cd-instalist-h3">
          Price
        </h3>
        <label className="cd-instalist-label" htmlFor={priceId}>
          Price (USD)
        </label>
        <input
          id={priceId}
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          className="cd-instalist-input cd-instalist-input--price"
          value={values.price}
          disabled={locked}
          onChange={(e) => setField('price', e.target.value)}
        />
        {!draft.dirty.price && draft.priceLabel && <p className="cd-caption">{draft.priceLabel}</p>}
        <ResetLink field="price" draft={draft} locked={locked} label="price" />
      </section>
    </div>
  );
}

/**
 * Description and item specifics, each collapsed by default (O1). Rendered
 * BELOW the Continue button: they are the long part of the listing, and the
 * price and the next step used to sit after all of the item specifics.
 *
 * Uncontrolled <details>: the open state is the reader's, per visit to the
 * tab. The values are not held here — see the file header.
 */
export function InstaListMoreFields({
  draft,
  locked,
}: Omit<InstaListFieldsProps, 'readOnlyNote'>) {
  const [showSource, setShowSource] = useState(false);
  const ids = useId();
  const descId = `cd-il-desc-${ids}`;

  const { values, setField } = draft;
  const specifics = values.itemSpecifics;

  const updateSpecific = (index: number, patch: Partial<ItemSpecific>) => {
    setField(
      'itemSpecifics',
      specifics.map((spec, i) => (i === index ? { ...spec, ...patch } : spec)),
    );
  };

  return (
    <div className="cd-instalist-fields" aria-disabled={locked || undefined}>
      {/* ── description ───────────────────────────────────────────────── */}
      <details className="cd-panel cd-instalist-more">
        <summary className="cd-instalist-summary">
          <span className="cd-instalist-summary-text">
            <span className="cd-eyebrow">The listing page</span>
            <span id={`${descId}-h`} className="cd-instalist-h3">
              Description
            </span>
          </span>
          {/* Hand edits only: a title change rewrites the headline but is not
              the owner editing the description. */}
          {draft.bodyEdited && <EditedPill />}
        </summary>
        <div className="cd-instalist-more-body" role="group" aria-labelledby={`${descId}-h`}>
          <div className="cd-instalist-row">
            <p className="cd-caption" style={{ margin: 0 }}>
              {showSource
                ? 'Raw HTML, exactly what eBay receives.'
                : 'This is how the description appears on eBay.'}
            </p>
            <button
              type="button"
              className="cd-quiet"
              aria-pressed={showSource}
              onClick={() => setShowSource((v) => !v)}
            >
              {showSource ? 'Preview' : 'Source'}
            </button>
          </div>

          {showSource ? (
            <>
              <label className="cd-instalist-label" htmlFor={descId}>
                Description HTML
              </label>
              <textarea
                id={descId}
                className="cd-instalist-textarea"
                rows={12}
                spellCheck={false}
                value={values.descriptionHtml}
                disabled={locked}
                onChange={(e) => setField('descriptionHtml', e.target.value)}
              />
            </>
          ) : (
            <div
              className="cd-instalist-preview"
              // Sanitized at render only, the same call the modal's review
              // preview makes. The HTML submitted to eBay is untouched; a saved
              // store template must not be able to run script in this page.
              dangerouslySetInnerHTML={{ __html: sanitizeListingHtml(values.descriptionHtml) }}
            />
          )}
          <ResetLink field="descriptionHtml" draft={draft} locked={locked} label="description" />
        </div>
      </details>

      {/* ── item specifics ────────────────────────────────────────────── */}
      <details className="cd-panel cd-instalist-more">
        <summary className="cd-instalist-summary">
          <span className="cd-instalist-summary-text">
            <span className="cd-eyebrow">What eBay files it under</span>
            <span id="cd-il-specifics-h" className="cd-instalist-h3">
              Item specifics
              {specifics.length > 0 && (
                <span className="cd-instalist-summary-count"> · {specifics.length}</span>
              )}
            </span>
          </span>
          {draft.dirty.itemSpecifics && <EditedPill />}
        </summary>
        <div className="cd-instalist-more-body" role="group" aria-labelledby="cd-il-specifics-h">
          <p className="cd-caption" style={{ margin: 0 }}>
            These are the specifics prefilled from your card. eBay&rsquo;s own extra
            category fields are fetched and merged on the listing flow&rsquo;s specifics step, so a
            few more may appear there.
          </p>

          <ul className="cd-instalist-specifics">
            {specifics.map((spec, index) => (
              <li key={`${spec.name}-${index}`} className="cd-instalist-specific">
                <label className="cd-instalist-label" htmlFor={`cd-il-spec-${index}`}>
                  {spec.name || 'Field'}
                  {/* Spelled out rather than a bare asterisk: a screen reader
                      announcing "Brand star" does not say what the star means. */}
                  {spec.required && (
                    <span className="cd-instalist-required"> (required by eBay)</span>
                  )}
                </label>
                <input
                  id={`cd-il-spec-${index}`}
                  type="text"
                  className="cd-instalist-input"
                  value={specificValueText(spec.value)}
                  disabled={locked || spec.editable === false}
                  onChange={(e) => updateSpecific(index, { value: e.target.value })}
                />
              </li>
            ))}
          </ul>
          {specifics.length === 0 && (
            <p className="cd-caption">No specifics were prefilled for this card.</p>
          )}
          <ResetLink field="itemSpecifics" draft={draft} locked={locked} label="specifics" />
        </div>
      </details>
    </div>
  );
}

export default InstaListFields;
