# Slabby — DCM's animated mascot

Slabby is an anthropomorphized graded card slab (gold "SLABBY" card inside,
DCM purple label) built as a parameterized SVG rig and animated with
[Remotion](https://remotion.dev). Everything renders to social-ready video
from the command line — no design software.

## Quick start

```bash
cd slabby
npm install          # first time only
npm run studio       # live preview UI — pick a composition, scrub, tweak
```

## Rendering for social

Composition ids are `<scene>-<preset>`:

| Scene | What happens |
|---|---|
| `wave` | Slabby hops in, waves, winks ("Hi, I'm Slabby!") |
| `grade-reveal` | badge shows "?", rumble builds, flips to GEM MINT 10, confetti |
| `shocked` | calm → camera punch + jump + huge shocked eyes ("WAIT… WHAT?!") |

| Preset | Size | For |
|---|---|---|
| `shorts` | 1080×1920 | TikTok / Reels / YouTube Shorts |
| `square` | 1080×1080 | Feed posts |
| `wide` | 1920×1080 | YouTube |
| `overlay` | 1080×1920, transparent | Drop Slabby over any footage in CapCut/Premiere |

```bash
npx remotion render src/index.ts grade-reveal-shorts out/grade-reveal-shorts.mp4
npx remotion render src/index.ts wave-square out/wave-square.mp4

# transparent overlay (alpha channel) — use vp8+png:
npx remotion render src/index.ts shocked-overlay out/shocked-overlay.webm --codec=vp8 --image-format=png

# expression contact sheet (design review):
npx remotion still src/index.ts expressions out/expressions.png
```

Upload the MP4s directly to the platforms. Add music/VO/captions in CapCut —
keep Remotion for the animation itself.

## Scene Composer + Admin Slabby Lab

The **admin console → Slabby Lab** (`/admin/slabby-lab`) is a visual scene
composer: build a sequence of beats (expression + motion + headline/caption +
background image with entrance animation + per-beat grade badge), preview it
live in the browser at any aspect ratio, then click **Download scene JSON**.

Background images turn Slabby into a commentator — he shrinks to the bottom
corner while the image (a graded card, a comparison, a news screenshot) takes
the stage. Use any public image URL, e.g. a card photo from its detail page.

**One-click rendering:** keep the local render server running and use the
Lab's green **Render MP4** button:

```bash
cd slabby && npm run serve
```

The Lab also supports: 🎙️ per-beat **voiceover** (OpenAI TTS, audio embeds
into the scene and bakes into the MP4; "Fit beat to audio" paces the beat to
the spoken line), **karaoke captions** (word-by-word from the script),
motion-matched **sound effects** (whoosh/pop/ding — regenerate assets with
`node scripts/generate-slabby-sfx.mjs`), a **card picker** (browse/search
your graded cards), and **scene templates** (built-ins + save your own).

To render a designed scene to MP4 manually:

1. Save the downloaded JSON into `slabby/scenes/`
2. ```bash
   npx remotion render src/index.ts composer-shorts out/my-scene.mp4 --props=scenes/my-scene.json
   ```
   (also `composer-square`, `composer-wide`, `composer-overlay`; duration is
   derived automatically from the beats)
3. Add voiceover/music over the MP4 in CapCut/Premiere.

Example scenes live in `slabby/scenes/example-*.json`.

The character + composer source of truth lives in the main app at
`src/lib/slabby/` (shared with the admin Player preview); this workspace
wraps it for rendering.

## Extending Slabby

- **New expression**: add a case to `Face` in `src/SlabbyRig.tsx` (eyes,
  brows, mouth) and register it in the `SlabbyExpression` type. ~20 lines.
- **New scene**: copy a file in `src/scenes/`, animate with
  `useCurrentFrame()` + `spring()`/`interpolate()`, register it in
  `src/Root.tsx` `SCENES`. It automatically gets all four presets.
- The rig is deliberately dumb: scenes pass per-frame props (arm rotations,
  bob, squash, expression, grade text) — all motion lives in the scene.
- `gradeText`/`gradeLabel` props let any scene show any grade ("?", "10",
  "6"…) — useful for reaction snippets about specific grades.

## Notes

- Remotion license: free for individuals and companies up to 3 people;
  larger teams need a paid company license.
- Fonts are system Arial/Arial Black for zero-dependency rendering. If we
  want the site's exact typefaces, add them via `@remotion/fonts`.
