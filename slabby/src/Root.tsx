import React from 'react';
import { Composition, Still } from 'remotion';
import { Wave } from './scenes/Wave';
import { GradeReveal } from './scenes/GradeReveal';
import { Shocked } from './scenes/Shocked';
import { Composer } from './scenes/Composer';
import { sceneDurationInFrames } from '../../src/lib/slabby/ComposerScene';
import type { SlabbyScene } from '../../src/lib/slabby/types';
import exampleScene from '../scenes/example-grade-reveal.json';
import { SlabbyRig, SlabbyExpression } from './SlabbyRig';
import { Backdrop } from './scenes/shared';

/**
 * Composition registry. Naming: <scene>-<preset>.
 *   shorts  = 1080×1920 (TikTok / Reels / YT Shorts)
 *   square  = 1080×1080 (feed posts)
 *   wide    = 1920×1080 (YouTube)
 *   overlay = 1080×1920 transparent background — render with
 *             `--codec=vp8 --image-format=png` (or prores) for alpha, then
 *             drop Slabby over any footage in an editor.
 *
 * Render examples (from slabby/):
 *   npx remotion render wave-shorts out/wave-shorts.mp4
 *   npx remotion render grade-reveal-overlay out/grade-reveal-overlay.webm --codec=vp8 --image-format=png
 *   npx remotion still expressions out/expressions.png
 */

const FPS = 30;

const PRESETS = [
  { key: 'shorts', width: 1080, height: 1920, transparent: false },
  { key: 'square', width: 1080, height: 1080, transparent: false },
  { key: 'wide', width: 1920, height: 1080, transparent: false },
  { key: 'overlay', width: 1080, height: 1920, transparent: true },
] as const;

const SCENES = [
  { key: 'wave', component: Wave, seconds: 5 },
  { key: 'grade-reveal', component: GradeReveal, seconds: 6 },
  { key: 'shocked', component: Shocked, seconds: 4 },
] as const;

/** Contact sheet of every expression — for design review, not for posting. */
const ExpressionSheet: React.FC = () => {
  const expressions: SlabbyExpression[] = ['happy', 'excited', 'shocked', 'thinking', 'sad', 'wink'];
  return (
    <Backdrop>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
        {expressions.map((e) => (
          <div key={e} style={{ textAlign: 'center' }}>
            <SlabbyRig expression={e} scale={0.58} gradeText={e === 'sad' ? '6' : '10'} gradeLabel={e === 'sad' ? 'EX-MINT' : 'GEM MINT'} />
            <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 30, color: '#e9d5ff', marginTop: -30 }}>
              {e}
            </div>
          </div>
        ))}
      </div>
    </Backdrop>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {SCENES.flatMap((scene) =>
        PRESETS.map((preset) => (
          <Composition
            key={`${scene.key}-${preset.key}`}
            id={`${scene.key}-${preset.key}`}
            component={scene.component as React.FC<{ transparent?: boolean }>}
            durationInFrames={scene.seconds * FPS}
            fps={FPS}
            width={preset.width}
            height={preset.height}
            defaultProps={{ transparent: preset.transparent }}
          />
        ))
      )}
      <Still id="expressions" component={ExpressionSheet} width={1860} height={1500} />

      {/* Composer: renders scenes designed in the admin Slabby Lab.
          Pass a scene file: --props=scenes/<name>.json
          Duration derives automatically from the scene's beats. */}
      {PRESETS.map((preset) => (
        <Composition
          key={`composer-${preset.key}`}
          id={`composer-${preset.key}`}
          component={Composer as React.FC<{ scene: SlabbyScene }>}
          durationInFrames={sceneDurationInFrames(exampleScene.scene as SlabbyScene, FPS)}
          fps={FPS}
          width={preset.width}
          height={preset.height}
          defaultProps={{ scene: exampleScene.scene as SlabbyScene }}
          calculateMetadata={({ props }) => ({
            durationInFrames: sceneDurationInFrames(props.scene, FPS),
          })}
        />
      ))}
    </>
  );
};
