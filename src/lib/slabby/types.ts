/**
 * Slabby scene composer types — shared between the admin Slabby Lab
 * (live @remotion/player preview) and the slabby/ render workspace.
 */

export type SlabbyExpression = 'happy' | 'excited' | 'shocked' | 'thinking' | 'sad' | 'wink';

export type SlabbyMotion =
  | 'enter'      // hop in from below with landing squash
  | 'idle'       // gentle bob
  | 'wave'       // right arm raised + waving
  | 'jump'       // single hop with squash
  | 'shake'      // anticipation/nervous rumble
  | 'celebrate'; // both arms up

export type BgAnimation = 'fade' | 'slide-left' | 'slide-right' | 'pop';

export interface SlabbyBeat {
  /** seconds this beat lasts */
  duration: number;
  expression: SlabbyExpression;
  motion: SlabbyMotion;
  /** big text at the top */
  headline?: string;
  /** caption at the bottom */
  caption?: string;
  /** grade badge contents on Slabby's label */
  gradeText?: string;
  gradeLabel?: string;
  /** image shown behind/beside Slabby (card photo, news screenshot, …) */
  backgroundImage?: string;
  bgAnimation?: BgAnimation;
}

export interface SlabbyScene {
  name: string;
  beats: SlabbyBeat[];
}

export const DEFAULT_BEAT: SlabbyBeat = {
  duration: 3,
  expression: 'happy',
  motion: 'idle',
  gradeText: '10',
  gradeLabel: 'GEM MINT',
};

export const EXPRESSIONS: SlabbyExpression[] = ['happy', 'excited', 'shocked', 'thinking', 'sad', 'wink'];
export const MOTIONS: SlabbyMotion[] = ['enter', 'idle', 'wave', 'jump', 'shake', 'celebrate'];
export const BG_ANIMATIONS: BgAnimation[] = ['fade', 'slide-left', 'slide-right', 'pop'];
