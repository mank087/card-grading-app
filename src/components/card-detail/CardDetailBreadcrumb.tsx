'use client';

/**
 * The breadcrumb and the record-actions row (visibility, style, tour, share,
 * more). Extracted from `CardDetailShell` so the shell stays composition.
 *
 * COPY (review finding 1): the back link used to read "← My collection" for
 * everyone, including a visitor who has no collection behind it. A signed-out
 * reader gets a neutral destination instead.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { CardSharingData } from '@/lib/socialUtils';
import {
  generateFacebookShareUrl,
  generateTwitterShareUrl,
  openSocialShare,
  copyToClipboard,
} from '@/lib/socialUtils';

export interface CardDetailBreadcrumbProps {
  categoryLabel: string;
  displayName: string;
  serial: string;
  backHref: string;
  isOwner: boolean;
  viewerSignedIn: boolean;

  visibility: string;
  isTogglingVisibility: boolean;
  onToggleVisibility: () => void;

  /** The compact style selector legacy keeps in this row. */
  styleControl?: ReactNode;

  onStartTour: () => void;
  shareData: CardSharingData;
  currentUrl: string;

  onEditLabel: () => void;
  onDelete: () => void;
  labelStudioHref: string;
}

export function CardDetailBreadcrumb({
  categoryLabel,
  displayName,
  serial,
  backHref,
  isOwner,
  viewerSignedIn,
  visibility,
  isTogglingVisibility,
  onToggleVisibility,
  styleControl,
  onStartTour,
  shareData,
  currentUrl,
  onEditLabel,
  onDelete,
  labelStudioHref,
}: CardDetailBreadcrumbProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="cd-breadcrumb">
      {viewerSignedIn ? (
        <Link className="dcm-button dcm-button--text" href={backHref}>
          ← My collection
        </Link>
      ) : (
        <Link className="dcm-button dcm-button--text" href="/">
          ← DCM Grading
        </Link>
      )}
      <span aria-hidden="true">/</span>
      <span>{categoryLabel}</span>
      <span aria-hidden="true">/</span>
      <span className="cd-crumb-name">{displayName}</span>

      <div className="cd-record-actions" id="tour-visibility-toggle">
        {isOwner ? (
          <button
            type="button"
            className="cd-quiet"
            onClick={onToggleVisibility}
            disabled={isTogglingVisibility}
            title={
              visibility === 'public'
                ? 'This card is public (click to make private)'
                : 'This card is private (click to make public)'
            }
          >
            <span
              className="cd-status-dot"
              data-private={visibility !== 'public'}
              aria-hidden="true"
            />
            {isTogglingVisibility
              ? 'Updating…'
              : visibility === 'public'
                ? 'Public card'
                : 'Private card'}
          </button>
        ) : (
          <span className="cd-caption">
            {visibility === 'public' ? 'Public card' : 'Private card'}
          </span>
        )}

        {styleControl}

        {/* Legacy keeps this in the page header; it is not owner-gated. */}
        <button
          type="button"
          className="cd-quiet"
          title="Take a guided tour of this page"
          onClick={() => {
            try {
              localStorage.removeItem('dcm_onboarding_tour_completed');
              localStorage.removeItem('dcm_onboarding_tour_started');
            } catch {
              /* Private mode: the tour still runs, it just re-offers later. */
            }
            onStartTour();
          }}
        >
          Page tour
        </button>

        <div className="cd-menu-wrap">
          <button
            type="button"
            className="cd-quiet"
            aria-expanded={shareOpen}
            aria-haspopup="menu"
            onClick={() => {
              setShareOpen((v) => !v);
              setMenuOpen(false);
            }}
          >
            Share
          </button>
          {shareOpen && (
            <div className="cd-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="cd-menu-item"
                onClick={() => {
                  openSocialShare(generateFacebookShareUrl(shareData, isOwner));
                  setShareOpen(false);
                }}
              >
                Share on Facebook
              </button>
              <button
                type="button"
                role="menuitem"
                className="cd-menu-item"
                onClick={() => {
                  openSocialShare(generateTwitterShareUrl(shareData, isOwner));
                  setShareOpen(false);
                }}
              >
                Share on X
              </button>
              <button
                type="button"
                role="menuitem"
                className="cd-menu-item"
                onClick={async () => {
                  const ok = await copyToClipboard(currentUrl);
                  window.alert(ok ? '✅ Link copied to clipboard!' : '❌ Failed to copy link. Please try again.');
                  setShareOpen(false);
                }}
              >
                Copy link
              </button>
              <p className="cd-menu-note">DCM serial {serial}</p>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="cd-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="cd-quiet"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="More card actions"
              onClick={() => {
                setMenuOpen((v) => !v);
                setShareOpen(false);
              }}
            >
              •••
            </button>
            {menuOpen && (
              <div className="cd-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="cd-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditLabel();
                  }}
                >
                  Edit card label
                </button>
                <a role="menuitem" className="cd-menu-item" href={labelStudioHref}>
                  Customize in Label Studio
                </a>
                <button
                  type="button"
                  role="menuitem"
                  className="cd-menu-item cd-menu-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  Delete card from collection
                </button>
                <p className="cd-menu-note">
                  Mark as sold and binder actions sit at the foot of the page.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardDetailBreadcrumb;
