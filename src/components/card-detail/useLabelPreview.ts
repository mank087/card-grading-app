'use client';

/**
 * Label style as a LOCAL PREVIEW (review findings 1 and C).
 *
 * WHAT WAS WRONG. Every style selector on the page called `switchStyle`, which
 * POSTs the ACCOUNT-WIDE default. For a logged-out visitor it returned before
 * doing anything, so the menu closed and nothing at all changed — a control
 * that looked interactive and was not. For an owner it did the opposite of
 * what "try a look on this card" implies: it silently changed what every card
 * they own prints, from a hero dropdown that said nothing about it.
 *
 * WHAT HAPPENS NOW. The selection is local to this page view. It works the
 * same way for a visitor and for an owner, and every piece of label rendering
 * on the page — the hero label, the three holder compositions, the support and
 * size notes, the downloads — reads it. Saving it as the account default is a
 * separate, explicit action that only an owner sees.
 *
 * ORG HOUSE STYLE. When the card is graded under the viewer's own store, the
 * store's Brand Setup design is the label, and a member cannot change it from
 * a card page. There is no preview state in that case at all: the selector is
 * read-only and says why.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { extractColorOverrides } from '@/lib/labelPresets';
import type { SavedCustomStyle, CustomLabelConfig, LabelColorOverrides } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';

export type SaveDefaultState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; styleName: string }
  | { kind: 'failed' };

export interface LabelPreviewInput {
  /** The account/org-resolved style — the saved default for this viewer. */
  savedStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  /** The org's house style applies: no preview, no saving, read-only. */
  orgLocked: boolean;
  /** `card.card_colors`, for the per-card Heritage band fallback. */
  cardColors: unknown;
  /**
   * `useCustomLabelStyle().switchStyle`. It now resolves to whether the POST
   * landed, which is how the "Use as my default" action can report a failure
   * instead of pretending it worked.
   */
  switchStyle: (id: LabelStyleId) => Promise<boolean>;
}

export interface LabelPreview {
  /** The style EVERY label on the page renders with. */
  style: LabelStyleId;
  /** The config behind `style`, or null for a built-in. */
  activeConfig: CustomLabelConfig | null;
  colorOverrides: LabelColorOverrides | undefined;
  heritageBandColors: string[];
  /** The viewer's saved default, unchanged by previewing. */
  savedStyle: LabelStyleId;
  /** The preview differs from the saved default. */
  isPreviewing: boolean;
  orgLocked: boolean;
  /** Preview only — never writes anything. */
  setStyle: (id: LabelStyleId) => void;
  /** Owner action: write the previewed style as the account default. */
  saveAsDefault: () => Promise<void>;
  /** Drop the preview and go back to the saved default. */
  reset: () => void;
  saveState: SaveDefaultState;
}

export function displayStyleName(id: LabelStyleId, customStyles: SavedCustomStyle[]): string {
  if (id === 'modern') return 'Modern';
  if (id === 'traditional') return 'Traditional';
  if (id === 'heritage') return 'Heritage';
  return customStyles.find((s) => s.id === id)?.name ?? String(id);
}

export function useLabelPreview({
  savedStyle,
  customStyles,
  orgLocked,
  cardColors,
  switchStyle,
}: LabelPreviewInput): LabelPreview {
  const [previewStyle, setPreviewStyle] = useState<LabelStyleId>(savedStyle);
  const [saveState, setSaveState] = useState<SaveDefaultState>({ kind: 'idle' });

  // The saved style arrives asynchronously (the hook fetches it), and an org
  // house style can replace it a tick later. Follow it while the reader has
  // not chosen anything of their own; once they have, their choice stands.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setPreviewStyle(savedStyle);
  }, [savedStyle, touched]);

  // The org house style is not previewable; it IS the label.
  const style = orgLocked ? savedStyle : previewStyle;

  const activeConfig = useMemo(
    () => customStyles.find((s) => s.id === style)?.config ?? null,
    [customStyles, style],
  );

  const colorOverrides = useMemo(() => extractColorOverrides(activeConfig), [activeConfig]);

  const heritageBandColors = useMemo(() => {
    const sel = resolveHeritageSelection(style, activeConfig);
    if (!sel.active) return [];
    return sel.bandColors ?? resolveHeritageBandColors(cardColors as never);
  }, [style, activeConfig, cardColors]);

  const setStyle = useCallback((id: LabelStyleId) => {
    setTouched(true);
    setPreviewStyle(id);
    setSaveState({ kind: 'idle' });
  }, []);

  const reset = useCallback(() => {
    setTouched(false);
    setPreviewStyle(savedStyle);
    setSaveState({ kind: 'idle' });
  }, [savedStyle]);

  const saveAsDefault = useCallback(async () => {
    setSaveState({ kind: 'saving' });
    const ok = await switchStyle(previewStyle);
    setSaveState(
      ok
        ? { kind: 'saved', styleName: displayStyleName(previewStyle, customStyles) }
        : { kind: 'failed' },
    );
    // `switchStyle` set the account style optimistically, so the saved style
    // prop follows on the next render and `isPreviewing` goes false by itself.
    if (ok) setTouched(false);
  }, [previewStyle, switchStyle, customStyles]);

  return {
    style,
    activeConfig,
    colorOverrides,
    heritageBandColors,
    savedStyle,
    isPreviewing: !orgLocked && style !== savedStyle,
    orgLocked,
    setStyle,
    saveAsDefault,
    reset,
    saveState,
  };
}
