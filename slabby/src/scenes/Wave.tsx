import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlabbyRig } from '../SlabbyRig';
import { Backdrop, Caption, useSlabbyScale } from './shared';

/**
 * Wave / intro — 5s. Slabby hops in, waves with the right arm, winks at the
 * end. Caption: "Hi, I'm Slabby!"
 */
export const Wave: React.FC<{ transparent?: boolean }> = ({ transparent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scale = useSlabbyScale();

  // Entrance: springs up from below with a landing squash.
  const enter = spring({ frame, fps, config: { damping: 11, mass: 0.9 } });
  const entryOffset = interpolate(enter, [0, 1], [500, 0]);
  const landSquash = 1 + Math.max(0, Math.sin(Math.min(enter, 1) * Math.PI)) * 0.12;

  // Idle bob (gentle breathing)
  const bob = Math.sin(frame / 14) * 8;

  // Right arm: raise at ~0.8s then oscillate a wave, drop at the end.
  const raiseStart = Math.round(fps * 0.8);
  const raise = spring({ frame: frame - raiseStart, fps, config: { damping: 10 } });
  const waving = frame > raiseStart + 8 && frame < durationInFrames - fps * 1.1;
  const waveOsc = waving ? Math.sin((frame - raiseStart) / 3.2) * 20 : 0;
  const drop = spring({ frame: frame - (durationInFrames - Math.round(fps * 1.1)), fps, config: { damping: 12 } });
  // Cap the raise at -100°: the arms render behind the slab shell, and past
  // ~-115° the mitt disappears behind the acrylic instead of waving beside it.
  const rightArm = interpolate(raise, [0, 1], [0, -100]) + waveOsc + interpolate(drop, [0, 1], [0, 100]);

  // Wink for the last second.
  const expression = frame > durationInFrames - fps ? 'wink' : 'happy';

  const captionIn = spring({ frame: frame - Math.round(fps * 1.1), fps, config: { damping: 13 } });

  return (
    <Backdrop transparent={transparent}>
      <div style={{ transform: `translateY(${entryOffset}px)` }}>
        <SlabbyRig
          expression={expression}
          rightArmRotation={rightArm}
          leftArmRotation={Math.sin(frame / 16) * 4}
          bob={bob}
          squash={landSquash}
          scale={scale}
        />
      </div>
      {!transparent && <Caption text="Hi, I'm Slabby!" opacity={captionIn} y={interpolate(captionIn, [0, 1], [-40, 0])} />}
    </Backdrop>
  );
};
