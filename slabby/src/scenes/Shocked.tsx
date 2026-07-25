import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlabbyRig } from '../SlabbyRig';
import { Backdrop, Caption, useSlabbyScale } from './shared';

/**
 * Shocked reaction — 4s. Slabby is chill, then something off-screen stuns
 * him: camera punches in, he jumps with a shake, holds huge shocked eyes.
 * Great as a reaction snippet ("when the raw card comes back a 10…").
 */
export const Shocked: React.FC<{ transparent?: boolean }> = ({ transparent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = useSlabbyScale();

  const hitAt = Math.round(fps * 1.4);
  const hit = frame >= hitAt;

  const punch = spring({ frame: frame - hitAt, fps, config: { damping: 12, mass: 0.7 } });
  const zoom = hit ? 1 + interpolate(punch, [0, 1], [0.16, 0.08]) : 1;
  const jump = hit ? -Math.sin(Math.min(punch * 1.4, 1) * Math.PI) * 90 : 0;
  const shakeAmp = hit ? Math.max(0, 10 - (frame - hitAt) * 0.5) : 0;
  const shakeX = Math.sin(frame * 3.7) * shakeAmp;

  const bob = hit ? 0 : Math.sin(frame / 14) * 8;
  const armsFlail = hit ? interpolate(punch, [0, 1], [0, -120]) : Math.sin(frame / 16) * 4;

  const captionIn = spring({ frame: frame - hitAt - 4, fps, config: { damping: 12 } });

  return (
    <Backdrop transparent={transparent}>
      <div style={{ transform: `translate(${shakeX}px, ${jump}px) scale(${zoom})` }}>
        <SlabbyRig
          expression={hit ? 'shocked' : 'happy'}
          leftArmRotation={hit ? -armsFlail : armsFlail}
          rightArmRotation={armsFlail}
          bob={bob}
          scale={scale}
        />
      </div>
      {!transparent && hit && <Caption text="WAIT… WHAT?!" opacity={captionIn} y={interpolate(captionIn, [0, 1], [-40, 0])} />}
    </Backdrop>
  );
};
