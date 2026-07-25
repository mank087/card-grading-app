import React from 'react';
import { staticFile } from 'remotion';
import { ComposerScene } from '../../../src/lib/slabby/ComposerScene';
import type { SlabbyScene } from '../../../src/lib/slabby/types';

/**
 * Render target for scenes designed in the admin Slabby Lab.
 *
 * Workflow: design in /admin/slabby-lab → "Download scene JSON" (or the
 * one-click Render button with the render server running) → render:
 *   npx remotion render src/index.ts composer-shorts out/my-scene.mp4 --props=scenes/my-scene.json
 */
export const Composer: React.FC<{ scene: SlabbyScene }> = ({ scene }) => (
  <ComposerScene
    scene={scene}
    logoHref={staticFile('dcm-logo-white.png')}
    sfxPop={staticFile('sfx/pop.wav')}
    sfxWhoosh={staticFile('sfx/whoosh.wav')}
    sfxDing={staticFile('sfx/ding.wav')}
  />
);
