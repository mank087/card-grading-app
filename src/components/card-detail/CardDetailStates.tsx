'use client';

/**
 * The card detail page's non-card states: the loading skeleton, the private
 * card page, "Card not available" and "not found". Extracted verbatim from
 * `CardDetailShell` (Sept 23 mobile review, Phase 4) so the shell stays
 * composition only; the markup and the legacy order of the states are
 * unchanged — see the shell's header for why each exists.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="dcm-brand dcm-card-detail">{children}</div>;
}

export function LoadingSkeleton() {
  return (
    <PageShell>
      <div className="cd-container" style={{ paddingBlock: 48 }}>
        <p role="status" aria-live="polite" className="cd-caption">
          Loading this card…
        </p>
        <div aria-hidden="true" className="cd-hero" style={{ marginTop: 24 }}>
          <div className="cd-showcase" style={{ minHeight: 420 }} />
          <div className="cd-hero-summary">
            <div className="cd-panel" style={{ minHeight: 120 }} />
            <div className="cd-panel" style={{ minHeight: 180 }} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function PrivateCardPage() {
  return (
    <PageShell>
      <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
        <h1 style={{ fontSize: 34, fontWeight: 750, letterSpacing: '-.03em' }}>
          This card is private
        </h1>
        <p className="dcm-lead">Only the owner can view this card.</p>
        <ul className="cd-caption" style={{ marginTop: 16, paddingLeft: 20 }}>
          <li>This card has been set to private by its owner.</li>
          <li>Private cards are not visible to other collectors.</li>
          <li>Private cards cannot be searched, and shared links stop working.</li>
        </ul>
        <div className="dcm-actions" style={{ marginTop: 28 }}>
          <Link className="dcm-button dcm-button--primary" href="/login">
            Log in
          </Link>
          <Link className="dcm-button dcm-button--secondary" href="/collection">
            View your collection
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

export function CardUnavailablePage({
  viewerSignedIn,
  uploadHref,
}: {
  viewerSignedIn: boolean;
  uploadHref: string;
}) {
  return (
    <PageShell>
      <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
        <h1 style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-.03em' }}>
          Card not available
        </h1>
        <p className="dcm-lead">
          This card no longer exists or is not viewable at this moment.
        </p>
        <div className="dcm-actions" style={{ marginTop: 28 }}>
          {viewerSignedIn ? (
            <Link className="dcm-button dcm-button--primary" href="/collection">
              My collection
            </Link>
          ) : (
            <Link className="dcm-button dcm-button--primary" href="/">
              Back to DCM Grading
            </Link>
          )}
          <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
            Grade a card
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

export function CardNotFoundPage({
  categoryLabel,
  uploadHref,
}: {
  categoryLabel: string;
  uploadHref: string;
}) {
  return (
    <PageShell>
      <div className="cd-container" style={{ paddingBlock: 64, maxWidth: 680 }}>
        <h1 style={{ fontSize: 30, fontWeight: 750 }}>{categoryLabel} card not found</h1>
        <div className="dcm-actions" style={{ marginTop: 24 }}>
          <Link className="dcm-button dcm-button--secondary" href={uploadHref}>
            Back to {categoryLabel} upload
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
