'use client';

/**
 * The one style selector the whole page uses, plus the explicit "save this as
 * my default" action (review findings 1 and C).
 *
 * The selector previews. Nothing it does reaches the account until the owner
 * presses "Use as my default", and the result of that press — saved, or not
 * saved — is announced, because `switchStyle` can fail and used to do so
 * silently.
 */

import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';
import type { SavedCustomStyle } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import { displayStyleName, type LabelPreview } from './useLabelPreview';

export interface LabelPreviewControlsProps {
  preview: LabelPreview;
  customStyles: SavedCustomStyle[];
  isOwner: boolean;
  /** No session: there are no saved slots and no Label Studio to reach. */
  viewerSignedIn: boolean;
  compact?: boolean;
  /** Shown under the control when the reader is not previewing anything. */
  idleNote?: string;
}

export function LabelPreviewControls({
  preview,
  customStyles,
  isOwner,
  viewerSignedIn,
  compact = false,
  idleNote,
}: LabelPreviewControlsProps) {
  const { orgLocked, isPreviewing, saveState } = preview;

  return (
    <div className="cd-label-preview">
      <LabelStyleDropdown
        labelStyle={preview.style}
        customStyles={customStyles}
        onSwitch={(id: LabelStyleId) => preview.setStyle(id)}
        compact={compact}
        readOnly={orgLocked}
        builtInsOnly={!viewerSignedIn}
        triggerLabel={orgLocked ? 'Store design:' : 'Label design:'}
      />

      {orgLocked ? (
        <p className="cd-caption">
          This card was graded by a store, so it carries the store&rsquo;s own label design.
        </p>
      ) : (
        <>
          {isPreviewing && (
            <p className="cd-caption cd-preview-note">
              {viewerSignedIn
                ? 'Previewing — your default label is unchanged.'
                : 'Previewing this label design.'}
            </p>
          )}

          {isOwner && isPreviewing && (
            <div className="dcm-actions cd-preview-actions">
              <button
                type="button"
                className="cd-quiet"
                onClick={() => void preview.saveAsDefault()}
                disabled={saveState.kind === 'saving'}
              >
                {saveState.kind === 'saving' ? 'Saving…' : 'Use as my default'}
              </button>
              <button type="button" className="cd-quiet" onClick={preview.reset}>
                Reset
              </button>
            </div>
          )}

          {/* The outcome of the save, announced rather than left to be noticed. */}
          <p className="cd-caption cd-save-state" role="status" aria-live="polite">
            {saveState.kind === 'saved'
              ? `Saved. ${saveState.styleName} is now your default label design.`
              : saveState.kind === 'failed'
                ? 'That could not be saved. Your default label is unchanged — please try again.'
                : ''}
          </p>

          {!isPreviewing && saveState.kind === 'idle' && idleNote && (
            <p className="cd-caption">{idleNote}</p>
          )}

          {!viewerSignedIn && (
            <p className="cd-caption">
              Previewing only. <a href="/login">Log in</a> to save a default design or create your
              own in Label Studio.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export { displayStyleName };
export default LabelPreviewControls;
