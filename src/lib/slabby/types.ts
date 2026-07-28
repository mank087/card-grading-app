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
  | 'celebrate'  // both arms up
  | 'point';     // right arm pointing up toward the image/page

/** 'static' = no entrance — image sits in place (use to hold one image across beats) */
export type BgAnimation = 'fade' | 'slide-left' | 'slide-right' | 'pop' | 'static';

/** A real graded card rendered as a slab mockup (label data + image inline). */
export interface SlabCardData {
  image: string;
  name: string;
  contextLine: string;
  featuresLine?: string | null;
  serial: string;
  gradeFormatted: string;
  condition: string;
  /** extras used by the scrolling details-page background */
  category?: string;
  subgrades?: { centering?: number | null; corners?: number | null; edges?: number | null; surface?: number | null } | null;
  summary?: string | null;
}

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
  /** real graded-card slab mockup (takes the background slot when set) */
  slabCard?: SlabCardData;
  /** full mobile-style card details page scrolling behind Slabby */
  detailsPage?: SlabCardData;
  /** scroll position (0-1) at the start/end of this beat (defaults 0→1).
      Chain across beats for one continuous scroll: 0→0.5, then 0.5→1. */
  scrollFrom?: number;
  scrollTo?: number;
  /** scroll speed multiplier (1 = spread across the whole beat; 2/4 =
      finish the scroll in 1/2 / 1/4 of the beat, then hold) */
  scrollSpeed?: 1 | 2 | 4;
  /** voiceover script for this beat (generate audio in the Lab) */
  voiceover?: string;
  /** generated TTS audio as a data URL — plays from the beat's start */
  voiceoverAudio?: string;
  /** measured seconds of the generated audio (drives "fit beat to audio") */
  voiceoverDuration?: number;
  /** karaoke captions: animate the voiceover script word by word (TikTok style) */
  karaoke?: boolean;
  /**
   * Real word timings (seconds from the start of this beat's audio), from
   * transcribing the voiceover. When present, karaoke syncs to the actual
   * speech instead of spreading words evenly across the beat — which only
   * ever approximated, and drifts badly on lines with pauses.
   */
  voiceoverWords?: { word: string; start: number; end: number }[];
  /** motion-matched sound effect at beat start (default true) */
  sfx?: boolean;
  /** comic-style speech bubble anchored to Slabby */
  speechBubble?: string;
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

/**
 * Strip MIME parameters from a data URL so Remotion can parse it.
 *
 * MediaRecorder produces `data:audio/webm;codecs=opus;base64,…`. Remotion
 * expects exactly `data:[mime];[encoding],[data]` and reads `;codecs=opus`
 * as the encoding, so the render dies with "A data URL was passed but did
 * not have the correct format". Only the label changes — the bytes and the
 * container are untouched, and Chrome still decodes it.
 */
export function sanitizeDataUrl<T extends string | undefined | null>(url: T): T {
  if (typeof url !== 'string' || !url.startsWith('data:')) return url;
  const comma = url.indexOf(',');
  if (comma < 0) return url;
  const header = url.slice(5, comma);
  const parts = header.split(';');
  const mime = parts[0];
  const encoding = parts[parts.length - 1];
  const clean = encoding && encoding !== mime ? `${mime};${encoding}` : mime;
  return (`data:${clean},${url.slice(comma + 1)}`) as T;
}

/** Repair every embedded asset in a scene (safe to run repeatedly). */
export function sanitizeScene(scene: SlabbyScene): SlabbyScene {
  return {
    ...scene,
    beats: scene.beats.map((b) => ({
      ...b,
      voiceoverAudio: sanitizeDataUrl(b.voiceoverAudio),
      backgroundImage: sanitizeDataUrl(b.backgroundImage),
      ...(b.slabCard ? { slabCard: { ...b.slabCard, image: sanitizeDataUrl(b.slabCard.image) } } : {}),
      ...(b.detailsPage ? { detailsPage: { ...b.detailsPage, image: sanitizeDataUrl(b.detailsPage.image) } } : {}),
    })),
  };
}

export const EXPRESSIONS: SlabbyExpression[] = ['happy', 'excited', 'shocked', 'thinking', 'sad', 'wink'];
export const MOTIONS: SlabbyMotion[] = ['enter', 'idle', 'wave', 'jump', 'shake', 'celebrate', 'point'];
export const BG_ANIMATIONS: BgAnimation[] = ['fade', 'slide-left', 'slide-right', 'pop', 'static'];
