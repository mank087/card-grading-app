import React from 'react';

/**
 * Slabby — DCM's mascot: an anthropomorphized graded card slab.
 *
 * Pure, deterministic SVG rig. All motion comes from the parent scene passing
 * per-frame props (arm angles, bob, squash) — the rig itself never animates.
 *
 * Anatomy (1000×1000 viewBox, feet on ~y=930):
 *   - acrylic slab shell with top label (DCM purple, grade badge)
 *   - gold trading card inside; the card's art window IS the face
 *   - stubby arms with mitt hands (rotate at shoulder anchors), rounded feet
 */

export type SlabbyExpression =
  | 'happy'
  | 'excited'
  | 'shocked'
  | 'thinking'
  | 'sad'
  | 'wink';

/** 'hero' = cape + black eye mask (Super Slabby). */
export type SlabbyCostume = 'none' | 'hero';

export interface SlabbyProps {
  expression?: SlabbyExpression;
  /** degrees; 0 = arms resting down-out. Negative raises the arm. */
  leftArmRotation?: number;
  rightArmRotation?: number;
  /** vertical bob in px (positive = down) */
  bob?: number;
  /** 1 = neutral. <1 squashes tall, >1 squashes wide. Applied about the feet. */
  squash?: number;
  /** text on the grade badge, e.g. "10" or "?" */
  gradeText?: string;
  /** small line under the grade, e.g. "GEM MINT" */
  gradeLabel?: string;
  /** overall scale */
  scale?: number;
  /**
   * URL for the white DCM logo. Defaults to the main app's public asset;
   * the slabby render workspace passes staticFile('dcm-logo-white.png').
   */
  logoHref?: string;
  /** 'hero' adds the cape + black eye mask. Default 'none'. */
  costume?: SlabbyCostume;
  /**
   * Cape flutter, -1…1. 0 = hanging straight down at rest; positive values
   * stream the cape out to the LEFT (i.e. behind him when flying right).
   * The scene drives this per frame — the rig itself never animates.
   */
  capeSway?: number;
}

const PURPLE = '#7c3aed';
const PURPLE_DARK = '#5b21b6';
const INK = '#1a1625';
const GOLD = '#fbbf24';
const GOLD_DARK = '#d97706';
const CREAM = '#fef3c7';

const Face: React.FC<{ expression: SlabbyExpression }> = ({ expression }) => {
  // Face lives in the card's art window: centered on (500, 555), ~230 wide.
  const eyeY = 530;
  const leftX = 435;
  const rightX = 565;

  const eyes = () => {
    switch (expression) {
      case 'shocked':
        return (
          <>
            <circle cx={leftX} cy={eyeY} r={34} fill="#fff" stroke={INK} strokeWidth={7} />
            <circle cx={rightX} cy={eyeY} r={34} fill="#fff" stroke={INK} strokeWidth={7} />
            <circle cx={leftX} cy={eyeY} r={11} fill={INK} />
            <circle cx={rightX} cy={eyeY} r={11} fill={INK} />
          </>
        );
      case 'excited':
        return (
          <>
            {/* star-struck sparkle eyes: dark iris with a clean white 4-point star */}
            {[leftX, rightX].map((x) => (
              <g key={x}>
                <circle cx={x} cy={eyeY} r={26} fill={INK} />
                <path
                  d={`M ${x} ${eyeY - 18} Q ${x + 4} ${eyeY - 4} ${x + 18} ${eyeY} Q ${x + 4} ${eyeY + 4} ${x} ${eyeY + 18} Q ${x - 4} ${eyeY + 4} ${x - 18} ${eyeY} Q ${x - 4} ${eyeY - 4} ${x} ${eyeY - 18} Z`}
                  fill="#fff"
                />
              </g>
            ))}
          </>
        );
      case 'thinking':
        return (
          <>
            <circle cx={leftX + 8} cy={eyeY - 8} r={16} fill={INK} />
            <circle cx={rightX + 8} cy={eyeY - 8} r={16} fill={INK} />
          </>
        );
      case 'sad':
        return (
          <>
            <circle cx={leftX} cy={eyeY + 4} r={20} fill={INK} />
            <circle cx={rightX} cy={eyeY + 4} r={20} fill={INK} />
            <circle cx={leftX - 6} cy={eyeY - 2} r={6} fill="#fff" />
            <circle cx={rightX - 6} cy={eyeY - 2} r={6} fill="#fff" />
            {/* tear */}
            <path d={`M ${leftX - 26} ${eyeY + 22} q -10 22 2 30 q 14 6 12 -12 q -2 -10 -14 -18 Z`} fill="#60a5fa" />
          </>
        );
      case 'wink':
        return (
          <>
            <circle cx={leftX} cy={eyeY} r={20} fill={INK} />
            <circle cx={leftX - 6} cy={eyeY - 6} r={6} fill="#fff" />
            <path d={`M ${rightX - 22} ${eyeY} q 22 14 44 0`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
          </>
        );
      case 'happy':
      default:
        return (
          <>
            <circle cx={leftX} cy={eyeY} r={20} fill={INK} />
            <circle cx={rightX} cy={eyeY} r={20} fill={INK} />
            <circle cx={leftX - 6} cy={eyeY - 6} r={6} fill="#fff" />
            <circle cx={rightX - 6} cy={eyeY - 6} r={6} fill="#fff" />
          </>
        );
    }
  };

  const brows = () => {
    switch (expression) {
      case 'shocked':
        return (
          <>
            <path d={`M ${leftX - 26} ${eyeY - 56} q 26 -16 52 -2`} stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />
            <path d={`M ${rightX - 26} ${eyeY - 58} q 26 -14 52 0`} stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />
          </>
        );
      case 'thinking':
        return (
          <>
            <path d={`M ${leftX - 22} ${eyeY - 40} q 24 -12 46 -4`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d={`M ${rightX - 20} ${eyeY - 52} q 22 -8 44 4`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
          </>
        );
      case 'sad':
        return (
          <>
            <path d={`M ${leftX - 24} ${eyeY - 34} q 26 -14 48 2`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" transform={`rotate(14 ${leftX} ${eyeY - 34})`} />
            <path d={`M ${rightX - 24} ${eyeY - 32} q 22 -16 48 0`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" transform={`rotate(-14 ${rightX} ${eyeY - 34})`} />
          </>
        );
      default:
        return null;
    }
  };

  const mouth = () => {
    switch (expression) {
      case 'excited':
        return (
          <g>
            <path d={`M 440 600 q 60 64 120 0 q -8 44 -60 44 q -52 0 -60 -44 Z`} fill={INK} />
            <path d={`M 462 632 q 38 26 76 0 q -14 18 -38 18 q -24 0 -38 -18 Z`} fill="#f472b6" />
          </g>
        );
      case 'shocked':
        return <ellipse cx={500} cy={618} rx={26} ry={34} fill={INK} />;
      case 'thinking':
        return <path d={`M 462 616 q 20 -12 38 0 q 18 12 38 0`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />;
      case 'sad':
        return <path d={`M 450 630 q 50 -34 100 0`} stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />;
      case 'wink':
        return <path d={`M 445 600 q 55 52 110 0 q -10 8 -20 10 L 465 610 q -12 -4 -20 -10 Z`} fill={INK} />;
      case 'happy':
      default:
        return <path d={`M 448 598 q 52 46 104 0`} stroke={INK} strokeWidth={11} fill="none" strokeLinecap="round" />;
    }
  };

  const blush = expression === 'happy' || expression === 'excited' || expression === 'wink';

  return (
    <g>
      {eyes()}
      {brows()}
      {mouth()}
      {blush && (
        <>
          <ellipse cx={408} cy={588} rx={17} ry={10} fill="#f9a8d4" opacity={0.75} />
          <ellipse cx={592} cy={588} rx={17} ry={10} fill="#f9a8d4" opacity={0.75} />
        </>
      )}
    </g>
  );
};

const CAPE = '#dc2626';
const CAPE_DARK = '#991b1b';

/**
 * Black domino eye mask. Drawn UNDER the eyes so every expression's pupils
 * show through the holes; evenodd fill punches the holes out of the band.
 */
const HeroMask: React.FC = () => {
  const eyeY = 530;
  const leftX = 435;
  const rightX = 565;
  const hole = 39;

  // band + two circular holes, evenodd => holes
  const band = `M 388 478 Q 500 462 612 478 L 620 540 Q 500 596 380 540 Z`;
  const holes =
    `M ${leftX + hole} ${eyeY} a ${hole} ${hole} 0 1 0 ${-hole * 2} 0 a ${hole} ${hole} 0 1 0 ${hole * 2} 0 Z` +
    `M ${rightX + hole} ${eyeY} a ${hole} ${hole} 0 1 0 ${-hole * 2} 0 a ${hole} ${hole} 0 1 0 ${hole * 2} 0 Z`;

  return (
    <g>
      {/* pointed outer flares */}
      <path d={`M 388 478 L 352 462 L 372 520 Z`} fill={INK} />
      <path d={`M 612 478 L 648 462 L 628 520 Z`} fill={INK} />
      <path d={`${band} ${holes}`} fill={INK} fillRule="evenodd" />
      {/* soft highlight along the top edge so the mask reads as fabric */}
      <path d="M 396 484 Q 500 470 604 484" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={6} fill="none" strokeLinecap="round" />
    </g>
  );
};

/**
 * Cape, drawn BEHIND the whole body.
 *
 * `sway` 0…1 morphs between two poses:
 *   0 = at rest — drapes symmetrically behind him and spills out past both
 *       sides of the slab, so it reads as a cape rather than a red sliver.
 *   1 = full flight — collapsed to one side and streaming straight out to the
 *       LEFT, i.e. trailing him as he flies right.
 *
 * The path keeps the same four control points through the whole morph, so any
 * in-between value is a valid drape (that's what the flutter rides on).
 */
const HeroCape: React.FC<{ sway: number }> = ({ sway }) => {
  const s = Math.max(0, Math.min(1, sway));
  const lerp = (a: number, b: number) => a + (b - a) * s;

  // the two lower corners of the cape: rest → full-stream
  const leftX = lerp(168, 8);
  const leftY = lerp(902, 288);
  const rightX = lerp(832, 232);
  const rightY = lerp(902, 618);

  // bow of each side seam, and the sag across the hem
  const ctrlLX = lerp(232, 196);
  const ctrlLY = lerp(596, 296);
  const hemX = lerp(500, 84);
  const hemY = lerp(986, 520);
  const ctrlRX = lerp(768, 520);
  const ctrlRY = lerp(596, 470);

  const d =
    `M 322 232 ` +
    `Q ${ctrlLX} ${ctrlLY} ${leftX} ${leftY} ` +
    `Q ${hemX} ${hemY} ${rightX} ${rightY} ` +
    `Q ${ctrlRX} ${ctrlRY} 678 232 Z`;

  return (
    <g>
      <path d={d} fill={CAPE} stroke={CAPE_DARK} strokeWidth={8} strokeLinejoin="round" />
      {/* centre fold — sells the fabric and tracks the same morph */}
      <path
        d={`M 500 244 Q ${lerp(430, 300)} ${lerp(640, 340)} ${lerp(350, 120)} ${lerp(880, 372)}`}
        stroke={CAPE_DARK}
        strokeWidth={14}
        fill="none"
        opacity={0.5}
        strokeLinecap="round"
      />
    </g>
  );
};

/**
 * Gold cape fasteners. They sit ON the shell's outer edges (x≈272/728) —
 * deliberately clear of the label block (x 300–700), which carries the grade
 * badge and must never be covered.
 */
const HeroClasp: React.FC = () => (
  <g>
    <circle cx={276} cy={252} r={19} fill={GOLD} stroke={GOLD_DARK} strokeWidth={6} />
    <circle cx={724} cy={252} r={19} fill={GOLD} stroke={GOLD_DARK} strokeWidth={6} />
    <circle cx={276} cy={252} r={6} fill={GOLD_DARK} opacity={0.6} />
    <circle cx={724} cy={252} r={6} fill={GOLD_DARK} opacity={0.6} />
  </g>
);

export const SlabbyRig: React.FC<SlabbyProps> = ({
  expression = 'happy',
  leftArmRotation = 0,
  rightArmRotation = 0,
  bob = 0,
  squash = 1,
  gradeText = '10',
  gradeLabel = 'GEM MINT',
  scale = 1,
  logoHref = '/DCM Logo white.png',
  costume = 'none',
  capeSway = 0,
}) => {
  const hero = costume === 'hero';
  // squash about the feet line (y=930): wider+shorter when squash > 1
  const squashTransform = `translate(500 930) scale(${squash} ${2 - squash}) translate(-500 -930)`;

  return (
    <svg viewBox="0 0 1000 1000" width={1000 * scale} height={1000 * scale}>
      <defs>
        <linearGradient id="slabAcrylic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#dbe4f0" />
        </linearGradient>
        {/* Matches ModernFrontLabel: linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%) */}
        <linearGradient id="labelModern" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1625" />
          <stop offset="50%" stopColor="#2d1f47" />
          <stop offset="100%" stopColor="#1a1625" />
        </linearGradient>
        <radialGradient id="labelGlow" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.16" />
          <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cardGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DARK} />
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform={`translate(0 ${bob})`}>
        <g transform={squashTransform}>
          {/* cape — behind the shadow, the arms and the shell */}
          {hero && <HeroCape sway={capeSway} />}

          {/* ground shadow */}
          <ellipse cx={500} cy={946} rx={225} ry={26} fill={INK} opacity={0.13} />

          {/* feet */}
          <g fill={PURPLE_DARK}>
            <rect x={398} y={888} width={78} height={52} rx={26} />
            <rect x={524} y={888} width={78} height={52} rx={26} />
          </g>

          {/* arms (behind slab). Shoulder anchors at slab edges, y=610 */}
          <g transform={`rotate(${leftArmRotation} 282 610)`}>
            <path d="M 282 610 Q 218 640 196 700" stroke={PURPLE_DARK} strokeWidth={40} fill="none" strokeLinecap="round" />
            <circle cx={196} cy={706} r={34} fill={PURPLE} stroke={PURPLE_DARK} strokeWidth={7} />
          </g>
          <g transform={`rotate(${rightArmRotation} 718 610)`}>
            <path d="M 718 610 Q 782 640 804 700" stroke={PURPLE_DARK} strokeWidth={40} fill="none" strokeLinecap="round" />
            <circle cx={804} cy={706} r={34} fill={PURPLE} stroke={PURPLE_DARK} strokeWidth={7} />
          </g>

          {/* slab shell */}
          <rect x={270} y={160} width={460} height={740} rx={42} fill="url(#slabAcrylic)" stroke="#c3cede" strokeWidth={7} />
          {/* inner recess line */}
          <rect x={300} y={190} width={400} height={680} rx={30} fill="none" stroke="#ffffff" strokeWidth={5} opacity={0.85} />

          {/* label — mirrors the production ModernFrontLabel (modern-dark preset):
              [white DCM logo] [name / set line / serial] [grade + condition] */}
          <g>
            <rect x={300} y={190} width={400} height={128} rx={26} fill="url(#labelModern)" />
            <rect x={300} y={190} width={400} height={128} rx={26} fill="url(#labelGlow)" />
            <image
              href={logoHref}
              x={318}
              y={218}
              width={72}
              height={72}
              preserveAspectRatio="xMidYMid meet"
            />
            {/* center: name / set line / serial (matches label line hierarchy) */}
            <text x={406} y={240} fontFamily="Arial, sans-serif" fontWeight={600} fontSize={29} fill="rgba(255,255,255,0.95)">
              SLABBY
            </text>
            <text x={406} y={267} fontFamily="Arial, sans-serif" fontWeight={400} fontSize={16} fill="rgba(255,255,255,0.7)">
              #001 · Slabby Originals
            </text>
            <text x={406} y={291} fontFamily="Consolas, Menlo, monospace" fontWeight={400} fontSize={15} fill="rgba(255,255,255,0.5)">
              000001
            </text>
            {/* right: grade + condition */}
            <text x={648} y={262} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={54} fill="#ffffff">
              {gradeText}
            </text>
            <text x={648} y={289} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={600} fontSize={13} fill="rgba(255,255,255,0.8)" letterSpacing={1.5}>
              {gradeLabel.toUpperCase()}
            </text>
          </g>

          {/* the card inside */}
          <g>
            <rect x={330} y={348} width={340} height={480} rx={18} fill="url(#cardGold)" stroke={GOLD_DARK} strokeWidth={6} />
            {/* art window (the face lives here) */}
            <rect x={358} y={396} width={284} height={300} rx={14} fill={CREAM} stroke={GOLD_DARK} strokeWidth={4} />
            {/* mask sits under the eyes so pupils show through the holes */}
            {hero && <HeroMask />}
            <Face expression={expression} />
            {/* card nameplate */}
            <rect x={370} y={726} width={260} height={56} rx={12} fill={CREAM} stroke={GOLD_DARK} strokeWidth={4} />
            <text x={500} y={764} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={32} fill={GOLD_DARK}>
              SLABBY
            </text>
            {/* holo sparkles */}
            <g fill="#ffffff" opacity={0.9}>
              <path d="M 388 372 l 6 14 l 14 6 l -14 6 l -6 14 l -6 -14 l -14 -6 l 14 -6 Z" />
              <path d="M 626 800 l 5 11 l 11 5 l -11 5 l -5 11 l -5 -11 l -11 -5 l 11 -5 Z" opacity={0.8} />
            </g>
          </g>

          {/* cape clasp over the shell, at the shoulder line */}
          {hero && <HeroClasp />}

          {/* acrylic shine streak over everything inside the shell */}
          <path d="M 306 200 L 420 200 L 330 860 L 296 860 Z" fill="url(#shine)" opacity={0.35} />
        </g>
      </g>
    </svg>
  );
};
