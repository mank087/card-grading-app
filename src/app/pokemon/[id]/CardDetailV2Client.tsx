'use client';

/**
 * Pokemon card detail — V2 (redesign pilot).
 *
 * This is the Phase 1 build site for the card-detail redesign described in
 * docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md. It is a SIBLING of
 * ./CardDetailClient.tsx, which is not edited for the duration of the project
 * so that `CARD_DETAIL_V2=off` is a complete rollback.
 *
 * Right now it is a scaffold. Phase 0's job was to prove the switch and the
 * rollback path end to end before any UI exists, so this renders an explicit
 * placeholder rather than a half-built page that could be mistaken for the
 * real thing. It is unreachable unless someone deliberately sets
 * CARD_DETAIL_V2, which defaults to off.
 *
 * Phase 1 replaces the body below with CardDetailShell + the Pokemon adapter.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';

export function PokemonCardDetailsV2() {
  const params = useParams();
  const cardId = typeof params?.id === 'string' ? params.id : '';

  return (
    <main className="dcm-brand" style={{ minHeight: '100vh' }}>
      <div className="dcm-container" style={{ paddingBlock: 64, maxWidth: 720 }}>
        <p className="dcm-eyebrow">Card details · V2 pilot</p>
        <h1 style={{ fontSize: 32, fontWeight: 750, letterSpacing: '-.03em' }}>
          Phase 1 has not landed yet.
        </h1>
        <p className="dcm-lead">
          The redesigned card detail page is still being built. What is working
          today is the switch that chose to render this page instead of the
          current one, and the flag that sends you back.
        </p>
        <p className="dcm-lead">
          Set <code>CARD_DETAIL_V2=off</code> to restore the current page for
          everyone, or append <code>?v=1</code> to this URL to see it right now.
        </p>
        <div className="dcm-actions" style={{ marginTop: 32 }}>
          <Link className="dcm-button dcm-button--primary" href={`/pokemon/${cardId}?v=1`}>
            Open the current page
          </Link>
          <Link className="dcm-button dcm-button--secondary" href="/collection">
            Back to my collection
          </Link>
        </div>
      </div>
    </main>
  );
}
