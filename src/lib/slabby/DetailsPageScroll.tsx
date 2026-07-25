import React from 'react';
import { SlabCard } from './SlabCard';
import { SlabCardData } from './types';

/**
 * The mobile app's card-details screen, recreated as a tall page that scrolls
 * behind Slabby. Reconstructed (not screenshotted) because the mobile screen
 * is native — this stays crisp at video resolution, carries the card's real
 * data, and never breaks on expired image URLs.
 *
 * Layout mirrors dcm-mobile/app/card/[id]: light background, slab display,
 * big grade + condition, 2×2 subgrade grid, DCM Optic summary prose.
 */

const PURPLE = '#7c3aed';
const PURPLE_DARK = '#5b21b6';

export const DETAILS_PAGE_ASPECT = 2.6; // pageHeight = width * this

export const DetailsPageScroll: React.FC<{
  card: SlabCardData;
  width: number;
  viewportHeight: number;
  /** 0-1 scroll position */
  progress: number;
  logoHref?: string;
}> = ({ card, width, viewportHeight, progress, logoHref }) => {
  const pageH = width * DETAILS_PAGE_ASPECT;
  const scrollY = Math.max(0, pageH - viewportHeight) * Math.min(1, Math.max(0, progress));
  const pad = width * 0.05;
  const f = (n: number) => width * n; // proportional font sizing

  const subs = [
    { label: 'Centering', value: card.subgrades?.centering },
    { label: 'Corners', value: card.subgrades?.corners },
    { label: 'Edges', value: card.subgrades?.edges },
    { label: 'Surface', value: card.subgrades?.surface },
  ];

  const sectionCard: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: f(0.03),
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    padding: pad,
    margin: `${pad * 0.7}px ${pad}px 0`,
  };

  return (
    <div style={{ width, height: viewportHeight, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width, height: pageH, background: '#f9fafb', transform: `translateY(${-scrollY}px)` }}>
        {/* app header bar */}
        <div
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            padding: `${pad * 0.8}px ${pad}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: f(0.045), color: PURPLE_DARK }}>
            DCM
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: f(0.03), color: '#6b7280' }}>#{card.serial}</div>
        </div>

        {/* slab display */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: pad }}>
          <SlabCard card={card} width={width * 0.62} logoHref={logoHref} />
        </div>

        {/* grade + condition */}
        <div style={{ textAlign: 'center', marginTop: pad }}>
          <div
            style={{
              display: 'inline-block',
              background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
              color: '#fff',
              borderRadius: '50%',
              width: f(0.2),
              height: f(0.2),
              lineHeight: `${f(0.2)}px`,
              fontFamily: 'Arial Black, Arial, sans-serif',
              fontWeight: 900,
              fontSize: f(0.09),
              boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            }}
          >
            {card.gradeFormatted}
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: f(0.042), color: '#111827', marginTop: pad * 0.5 }}>
            {card.condition}
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: f(0.03), color: '#6b7280', marginTop: pad * 0.15 }}>
            {card.name} · {card.contextLine}
          </div>
        </div>

        {/* subgrade grid */}
        <div style={{ ...sectionCard, padding: pad * 0.7 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: f(0.036), color: '#111827', marginBottom: pad * 0.5 }}>
            Sub-Grade Scores
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: pad * 0.5 }}>
            {subs.map((sg) => (
              <div
                key={sg.label}
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #ede9fe',
                  borderRadius: f(0.02),
                  padding: pad * 0.55,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: f(0.065), color: PURPLE_DARK }}>
                  {sg.value ?? '—'}
                </div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: f(0.026), color: '#6b7280', marginTop: 2 }}>{sg.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Optic summary */}
        {card.summary && (
          <div style={sectionCard}>
            <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: f(0.036), color: '#111827', marginBottom: pad * 0.4 }}>
              DCM Optic™ Summary
            </div>
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: f(0.031), lineHeight: 1.55, color: '#374151' }}>
              {card.summary}
            </div>
          </div>
        )}

        {/* footer */}
        <div style={{ textAlign: 'center', padding: pad * 1.2, fontFamily: 'Arial, sans-serif', fontSize: f(0.027), color: '#9ca3af' }}>
          Graded by DCM Optic™ · dcmgrading.com
        </div>
      </div>

      {/* subtle top/bottom fade so the crop reads as a phone screen */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.18)' }} />
    </div>
  );
};
