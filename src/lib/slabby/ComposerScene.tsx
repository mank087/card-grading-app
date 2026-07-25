import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlabbyRig } from './SlabbyRig';
import { SlabbyBeat, SlabbyScene } from './types';

/**
 * Beat-driven Slabby scene. Shared by the admin Slabby Lab (live
 * @remotion/player preview) and the slabby/ workspace (MP4 render), so
 * what you preview is exactly what renders.
 *
 * Each beat: expression + motion preset + optional headline/caption +
 * optional background image (a graded card, a news screenshot, …) that
 * animates in. When a beat has a background image, Slabby shrinks and
 * anchors bottom-left like a commentator; otherwise he takes center stage.
 */

export interface ComposerProps {
  scene: SlabbyScene;
  logoHref?: string;
}

interface ActiveBeat {
  beat: SlabbyBeat;
  index: number;
  /** frames since this beat started */
  localFrame: number;
  /** frames this beat lasts */
  beatFrames: number;
}

const findActiveBeat = (beats: SlabbyBeat[], frame: number, fps: number): ActiveBeat => {
  let start = 0;
  for (let i = 0; i < beats.length; i++) {
    const beatFrames = Math.max(1, Math.round(beats[i].duration * fps));
    if (frame < start + beatFrames || i === beats.length - 1) {
      return { beat: beats[i], index: i, localFrame: frame - start, beatFrames };
    }
    start += beatFrames;
  }
  return { beat: beats[0], index: 0, localFrame: frame, beatFrames: Math.round(beats[0].duration * fps) };
};

export const sceneDurationInFrames = (scene: SlabbyScene, fps: number): number =>
  Math.max(1, scene.beats.reduce((sum, b) => sum + Math.max(1, Math.round(b.duration * fps)), 0));

export const ComposerScene: React.FC<ComposerProps> = ({ scene, logoHref }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (!scene.beats.length) {
    return <AbsoluteFill style={{ background: '#1a1625' }} />;
  }

  const { beat, index, localFrame } = findActiveBeat(scene.beats, frame, fps);
  const hasBg = Boolean(beat.backgroundImage);

  // ---- motion presets (beat-local springs) ----
  let bob = Math.sin(frame / 14) * 8; // continuous idle breathing across beats
  let squash = 1;
  let leftArm = Math.sin(frame / 16) * 4;
  let rightArm = -Math.sin(frame / 16) * 4;
  let shiftX = 0;
  let shiftY = 0;

  switch (beat.motion) {
    case 'enter': {
      const s = spring({ frame: localFrame, fps, config: { damping: 11, mass: 0.9 } });
      shiftY = interpolate(s, [0, 1], [height * 0.5, 0]);
      squash = 1 + Math.sin(Math.min(s, 1) * Math.PI) * 0.12;
      break;
    }
    case 'wave': {
      const raise = spring({ frame: localFrame, fps, config: { damping: 10 } });
      rightArm = interpolate(raise, [0, 1], [0, -100]) + (localFrame > 8 ? Math.sin(localFrame / 3.2) * 20 : 0);
      break;
    }
    case 'jump': {
      const s = spring({ frame: localFrame, fps, config: { damping: 9, mass: 0.8 } });
      shiftY = -Math.sin(Math.min(s, 1) * Math.PI) * height * 0.07;
      squash = 1 - Math.sin(Math.min(s, 1) * Math.PI) * 0.1;
      break;
    }
    case 'shake': {
      shiftX = Math.sin(frame * 2.3) * 7;
      break;
    }
    case 'celebrate': {
      const s = spring({ frame: localFrame, fps, config: { damping: 9 } });
      const up = interpolate(s, [0, 1], [0, -110]);
      leftArm = -up;
      rightArm = up;
      shiftY = -Math.sin(Math.min(s * 1.2, 1) * Math.PI) * height * 0.04;
      break;
    }
    case 'idle':
    default:
      break;
  }

  // ---- layout: full-stage vs commentator mode ----
  // Commentator zones (vertical): headline 0-16%, image 17-67%, Slabby +
  // caption share the bottom third (Slabby left ~third, caption right).
  const short = Math.min(width, height);
  const slabbyScale = (short * (hasBg ? 0.5 : 0.92)) / 1000;

  // ---- background image entrance ----
  const bgIn = spring({ frame: localFrame, fps, config: { damping: 13 } });
  const anim = beat.bgAnimation || 'fade';
  const bgStyle: React.CSSProperties = {
    opacity: anim === 'fade' || anim === 'pop' ? bgIn : 1,
    transform:
      anim === 'slide-left'
        ? `translateX(${interpolate(bgIn, [0, 1], [width * 0.6, 0])}px)`
        : anim === 'slide-right'
          ? `translateX(${interpolate(bgIn, [0, 1], [-width * 0.6, 0])}px)`
          : anim === 'pop'
            ? `scale(${interpolate(bgIn, [0, 1], [0.6, 1])})`
            : undefined,
  };

  // ---- text entrances ----
  const textIn = spring({ frame: localFrame - 4, fps, config: { damping: 13 } });
  const headlineSize = short * 0.06;
  const captionSize = short * 0.052;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #1a1625 0%, #2d1f47 60%, #1a1625 100%)',
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill
        style={{ background: 'radial-gradient(circle at 50% 42%, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0) 55%)' }}
      />

      {/* background image (framed like a displayed card / screenshot) */}
      {hasBg && (
        <div
          style={{
            position: 'absolute',
            top: height * (beat.headline ? 0.17 : 0.09),
            left: '50%',
            marginLeft: -(short * 0.62) / 2,
            width: short * 0.62,
            height: height * 0.5,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            ...bgStyle,
          }}
        >
          <Img
            src={beat.backgroundImage!}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.08)',
            }}
          />
        </div>
      )}

      {/* Slabby */}
      <div
        style={{
          position: 'absolute',
          ...(hasBg
            ? { left: -(1000 * slabbyScale) * 0.12, bottom: -(1000 * slabbyScale) * 0.04 }
            : { left: '50%', top: '50%', marginLeft: -(1000 * slabbyScale) / 2, marginTop: -(1000 * slabbyScale) / 2 }),
          transform: `translate(${shiftX}px, ${shiftY}px)`,
        }}
      >
        <SlabbyRig
          key={index /* re-mount per beat so SVG props settle cleanly */}
          expression={beat.expression}
          gradeText={beat.gradeText || '10'}
          gradeLabel={beat.gradeLabel || 'GEM MINT'}
          leftArmRotation={leftArm}
          rightArmRotation={rightArm}
          bob={bob}
          squash={squash}
          scale={slabbyScale}
          logoHref={logoHref}
        />
      </div>

      {/* headline (top) */}
      {beat.headline && (
        <div
          style={{
            position: 'absolute',
            top: height * 0.03,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontWeight: 900,
            fontSize: headlineSize,
            color: '#ffffff',
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            opacity: textIn,
            transform: `translateY(${interpolate(textIn, [0, 1], [-30, 0])}px)`,
            padding: '0 4%',
          }}
        >
          {beat.headline}
        </div>
      )}

      {/* caption (bottom) */}
      {beat.caption && (
        <div
          style={{
            position: 'absolute',
            bottom: height * 0.05,
            ...(hasBg ? { left: '36%', width: '61%', textAlign: 'left' as const } : { width: '100%', textAlign: 'center' as const }),
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontWeight: 900,
            fontSize: captionSize,
            color: '#ffffff',
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            opacity: textIn,
            transform: `translateY(${interpolate(textIn, [0, 1], [30, 0])}px)`,
            padding: hasBg ? 0 : '0 4%',
          }}
        >
          {beat.caption}
        </div>
      )}

      {/* beat progress dots (subtle, useful in preview and harmless in renders) */}
      {scene.beats.length > 1 && (
        <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 6 }}>
          {scene.beats.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: i === index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
