import React from 'react';
import { Img } from 'remotion';
import { assetSrc } from './assetSrc';
import { SlabCardData } from './types';

/**
 * A real graded card rendered as a DCM slab mockup: acrylic shell + the
 * production modern label (dark gradient, white DCM logo, name/context/serial,
 * grade + condition) over the card's actual photo. Label data comes from the
 * same generator the Label Studio uses, via /api/admin/slabby/card-lookup.
 */
export const SlabCard: React.FC<{ card: SlabCardData; width: number; logoHref?: string }> = ({
  card,
  width,
  logoHref = '/DCM Logo white.png',
}) => {
  const pad = width * 0.045;
  const inner = width - pad * 2;
  const labelH = inner * 0.34;
  const cardImgH = inner * 1.4; // standard 2.5:3.5 card ratio
  const r = width * 0.055;

  return (
    <div
      style={{
        width,
        borderRadius: r,
        background: 'linear-gradient(135deg, #ffffff 0%, #eef2ff 55%, #dbe4f0 100%)',
        border: `${Math.max(2, width * 0.012)}px solid #c3cede`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(255,255,255,0.85)',
        padding: pad,
        boxSizing: 'border-box',
      }}
    >
      {/* modern label */}
      <div
        style={{
          height: labelH,
          borderRadius: r * 0.5,
          background: 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${inner * 0.05}px`,
          gap: inner * 0.04,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.14) 0%, transparent 70%)',
          }}
        />
        <Img src={logoHref} style={{ height: labelH * 0.52, width: 'auto', position: 'relative' }} />
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            style={{
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              fontSize: labelH * 0.2,
              color: 'rgba(255,255,255,0.95)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.name}
          </div>
          <div
            style={{
              fontFamily: 'Arial, sans-serif',
              fontSize: labelH * 0.135,
              color: 'rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: labelH * 0.03,
            }}
          >
            {card.contextLine}
          </div>
          {card.featuresLine && (
            <div
              style={{
                fontFamily: 'Arial, sans-serif',
                fontWeight: 500,
                fontSize: labelH * 0.12,
                color: 'rgba(34,197,94,0.9)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: labelH * 0.02,
              }}
            >
              {card.featuresLine}
            </div>
          )}
          <div
            style={{
              fontFamily: 'Consolas, Menlo, monospace',
              fontSize: labelH * 0.115,
              color: 'rgba(255,255,255,0.5)',
              marginTop: labelH * 0.02,
            }}
          >
            {card.serial}
          </div>
        </div>
        <div style={{ textAlign: 'center', position: 'relative', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: labelH * 0.42, color: '#ffffff', lineHeight: 1 }}>
            {card.gradeFormatted}
          </div>
          <div
            style={{
              fontFamily: 'Arial, sans-serif',
              fontWeight: 600,
              fontSize: labelH * 0.115,
              color: 'rgba(255,255,255,0.8)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginTop: labelH * 0.04,
            }}
          >
            {card.condition}
          </div>
        </div>
      </div>

      {/* card image */}
      <div
        style={{
          marginTop: pad * 0.8,
          height: cardImgH,
          borderRadius: r * 0.45,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.06)',
        }}
      >
        <Img src={assetSrc(card.image)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    </div>
  );
};
