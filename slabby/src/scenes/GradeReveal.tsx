import React from 'react';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlabbyRig } from '../SlabbyRig';
import { Backdrop, Caption, useSlabbyScale } from './shared';

/**
 * Grade reveal — 6s. Slabby thinks with a "?" grade badge and rumbles with
 * anticipation; the badge flips to a 10, Slabby throws both arms up in
 * excitement, confetti bursts. Caption: "GEM MINT 10!"
 */

const CONFETTI_COLORS = ['#7c3aed', '#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#ffffff'];
const CONFETTI_COUNT = 90;

const Confetti: React.FC<{ progress: number; width: number; height: number }> = ({ progress, width, height }) => {
  if (progress <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = random(`a${i}`) * Math.PI * 2;
        const speed = 0.35 + random(`s${i}`) * 0.65;
        const originX = width / 2;
        const originY = height * 0.45;
        const dist = progress * speed * Math.min(width, height) * 0.85;
        const x = originX + Math.cos(angle) * dist;
        const y = originY + Math.sin(angle) * dist * 0.8 + progress * progress * height * 0.5;
        const rot = random(`r${i}`) * 720 * progress;
        const size = 10 + random(`z${i}`) * 14;
        const color = CONFETTI_COLORS[Math.floor(random(`c${i}`) * CONFETTI_COLORS.length)];
        const opacity = interpolate(progress, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size * 0.6,
              background: color,
              transform: `rotate(${rot}deg)`,
              borderRadius: 2,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

export const GradeReveal: React.FC<{ transparent?: boolean }> = ({ transparent }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = useSlabbyScale();

  const revealAt = Math.round(fps * 2.6);
  const revealed = frame >= revealAt;

  // Anticipation rumble that builds until the reveal.
  const rumbleAmp = revealed ? 0 : interpolate(frame, [0, revealAt], [0, 7]);
  const rumbleX = Math.sin(frame * 2.1) * rumbleAmp;

  // Reveal pop: jump + squash, arms up.
  const pop = spring({ frame: frame - revealAt, fps, config: { damping: 9, mass: 0.8 } });
  const jump = revealed ? -Math.sin(Math.min(pop, 1) * Math.PI) * 120 : 0;
  // -110°, not -165: arms render behind the slab, so past ~-115° the mitts
  // vanish behind the shell instead of celebrating beside it.
  const armsUp = interpolate(pop, [0, 1], [0, -110]);
  const popSquash = revealed ? 1 - Math.sin(Math.min(pop, 1) * Math.PI) * 0.1 : 1;

  const bob = Math.sin(frame / 14) * 6;
  const confettiProgress = revealed ? interpolate(frame, [revealAt, revealAt + fps * 2.6], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  const captionIn = spring({ frame: frame - revealAt - 6, fps, config: { damping: 12 } });

  return (
    <Backdrop transparent={transparent}>
      <div style={{ transform: `translate(${rumbleX}px, ${jump}px)` }}>
        <SlabbyRig
          expression={revealed ? 'excited' : 'thinking'}
          gradeText={revealed ? '10' : '?'}
          gradeLabel={revealed ? 'GEM MINT' : 'GRADING…'}
          leftArmRotation={revealed ? -armsUp : Math.sin(frame / 10) * 6}
          rightArmRotation={revealed ? armsUp : -Math.sin(frame / 10) * 6}
          bob={bob}
          squash={popSquash}
          scale={scale}
        />
      </div>
      <Confetti progress={confettiProgress} width={width} height={height} />
      {!transparent && revealed && (
        <Caption text="GEM MINT 10!" opacity={captionIn} y={interpolate(captionIn, [0, 1], [-40, 0])} />
      )}
    </Backdrop>
  );
};
