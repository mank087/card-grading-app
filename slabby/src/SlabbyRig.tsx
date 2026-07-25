import React from 'react';
import { staticFile } from 'remotion';
import { SlabbyRig as SharedRig } from '../../src/lib/slabby/SlabbyRig';
import type { SlabbyProps, SlabbyExpression } from '../../src/lib/slabby/SlabbyRig';

/**
 * Workspace wrapper around the shared rig (single source of truth lives in
 * src/lib/slabby/SlabbyRig.tsx so the admin Slabby Lab previews the exact
 * same character). Only difference: the logo resolves via Remotion's
 * staticFile against slabby/public/.
 */
export type { SlabbyExpression, SlabbyProps };

export const SlabbyRig: React.FC<SlabbyProps> = (props) => (
  <SharedRig logoHref={staticFile('dcm-logo-white.png')} {...props} />
);
