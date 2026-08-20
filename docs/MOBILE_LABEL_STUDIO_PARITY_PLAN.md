# Mobile Label Studio — parity with the web wizard

**Date:** August 20, 2026
**Web reference:** commit `f565dfb` (six-step wizard + Heritage Compact)
**Mobile reference:** `dcm-mobile/app/pages/label-studio.tsx` (2,414 lines)

---

## 1. The finding that shapes everything else

**The mobile apps do not render or generate labels. The web app does.**

Both mobile screens drive hidden WebViews pointed at web routes:

| Mobile module | Loads | Gets back |
|---|---|---|
| `components/labels/LabelWebRenderer.tsx` | `/label-preview/[cardId]` | Preview PNG via `postMessage` |
| `components/exports/ExportRunner.tsx` | `/label-export/[cardId]`, `/label-export/batch` | PDF/PNG files as base64 |

`LabelWebRenderer`'s own docstring states the intent plainly: it loads the web page "which uses the SAME canvas generators that drive the download PDFs. This eliminates drift between the on-device preview and the downloaded label."

This is worth stating clearly because it changes the cost of everything below: **there is no canvas engine to port.** Heritage Compact, Zion sizing, and the fold-over geometry all live in web code the phones already call. Most of the parity gap closes by teaching *one web route* about the new formats — no native code, no store review.

The remaining gap is genuinely the mobile **UI shell**, which is a different and much smaller problem than it looks.

---

## 2. Where the two stand today

### Web (current)

Six steps, one reducer as the source of truth. Cards → Holder → Style → Customize → Finish → Supplies (optional).

- Up to **20 cards** per run (two slab sheets)
- Holders: Slab (+ Zion MagPro 2.51 × 0.76), One-Touch, Toploader (front+back **or** fold-over)
- Styles: Heritage, Modern, Traditional, plus **12** saved designs
- **Heritage Compact** on One-Touch and Toploader
- Previews composite into real holder photos, rendered by the same canvas functions as the print sheets
- Per-card label text editing that saves back to the card
- Old single-screen studio preserved at `/labels/classic`

### Mobile (current)

One long screen. A fixed gallery of 9 label types, then a customize section, then export.

- **One card at a time** in Label Studio (`params.cardId` → `selectedCard`)
- Gallery entries are style-locked combinations: `slab-modern`, `slab-traditional`, `slab-heritage`, `onetouch`, `toploader`, `foldover`, two `card-image-*`, `custom`
- `DIMENSION_PRESETS` has no Zion size
- `MAX_SAVED_LABEL_STYLES = 12` — **already updated in the source, not yet shipped** (needs an OTA)
- Multi-card batch printing *does* exist on mobile, but on the **Collection** tab, not in Label Studio

### The gaps

| # | Gap | Where it must be fixed |
|---|---|---|
| 1 | No Heritage Compact on One-Touch/Toploader | **Web** — `/label-export/batch` and `/label-export/[cardId]` |
| 2 | No Zion MagPro size | Web route + mobile presets |
| 3 | Label Studio is single-card; no 20-card run | Mobile |
| 4 | Style and holder are fused into 9 gallery tiles | Mobile |
| 5 | Toploader fold-over vs front+back not selectable as a format | Mobile (web route already accepts it) |
| 6 | 12 saved slots written but not shipped | Mobile — OTA only |
| 7 | Fold-over preview geometry is landscape (web was corrected to portrait) | Mobile `LabelMockup.tsx` |
| 8 | No supplies/affiliate step | Mobile |

---

## 3. The critical gap, in detail

`src/app/label-export/batch/page.tsx` accepts `type=onetouch | toploader | toploader-foldover` and generates them with the **Modern-only** builders:

- `generateAveryLabelSheetMultiPage`
- `generateToploaderLabelSheetMultiPage`
- `generateFoldOverLabelSheet`

It has no knowledge of `heritageCompactSheets.ts`. Confirmed by grep — `heritageCompact` is currently imported only by the wizard, the two batch modals, and the dev proof page.

**Consequence:** Heritage Compact today reaches the web wizard and the web Collection batch, but **not** the mobile apps, because mobile goes through `/label-export/*` rather than through the modal components I wired.

**Audit result (corrected):** no web UI links to `/label-export/*` at all — the only references are the fullscreen-route lists in `Navigation.tsx`, `Footer.tsx`, and `ConsentManager.tsx`, plus comments. The route is **mobile-only**. My earlier note that web flows were "equally in the dark" was wrong; web's Collection and wizard both go through the modals. That makes Phase 1 purely additive for mobile, with no web behaviour to preserve beyond the existing Modern output.

---

## 4. Plan

Ordered by value per unit of effort. Each phase ships independently.

### Phase 1 — Teach the export routes about Heritage Compact ✅ DONE
**Web only. No app release. Both platforms benefit the moment it deploys.**

Both routes now accept Heritage on the compact holders, two equivalent ways:

- `&style=heritage` alongside the existing type, or
- a `-heritage` type suffix (`onetouch-heritage`, `toploader-heritage`, `foldover-heritage`), matching how the slab types already name their style.

Neither is implied. A bare `type=onetouch` still prints Modern, so **every existing mobile caller keeps its current output** until the app opts in.

Pattern and band colours resolve with the same precedence the slab Heritage path uses — inline `?customConfig`, then the slot named by `?labelStyle`, then the account's saved style — so a design saved in the wizard prints identically from either path. `heritagePattern` still overrides.

`loadWordmarkDataUrl()` and `compactQrDataUrl()` moved into `heritageCompactInputs.ts`; both batch modals now import them instead of keeping private copies. The wordmark is cached after first fetch — a 20-card batch was re-reading and re-encoding the same PNG per label.

**Verified against a live signed-in session, 3 real cards:**

| Request | Output |
|---|---|
| `type=onetouch&style=heritage` | `DCM-OneTouch-Heritage-Avery6871-3cards.pdf` |
| `type=toploader&style=heritage` | `DCM-Toploader-Heritage-Avery8167-3cards.pdf` |
| `type=toploader-foldover&style=heritage` | `DCM-FoldOver-Heritage-Avery8167-3cards.pdf` |
| `type=onetouch` (no style) | `DCM-OneTouch-Avery6871-3cards.pdf` — Modern, unchanged |
| `/label-export/[cardId]?type=toploader-heritage` | `DCM-Toploader-Heritage-Donald-Duck.pdf` |

*Not done:* item 4 from the original plan (Zion `width`/`height` on the round trip). Zion is a **slab** size and does not apply to the compact holders, and `slab-custom` already carries width/height inside `customConfig`. The real remaining gap is that `slab-heritage` calls the vector generator without passing `dims`, so a Zion Heritage slab still prints at 2.8 × 0.8 from this route. Small, separate, and worth folding into Phase 2.

*Risk:* low, as expected. Additive branches; the generators were already proven by the wizard.

### Phase 2 — Ship what is already written ✅ CODE DONE, OTA PENDING
**Mobile OTA at runtime 1.0.2 (plus the 1.0.1 / 1.0.0 legacy lanes; never omit `--platform`).**

- **12 saved slots** — `MAX_SAVED_LABEL_STYLES = 12` was already in `hooks/useLabelStyle.ts`; nothing else in the app still caps at 4 (checked). It only needs the OTA to reach devices.
- **Fold-over geometry corrected** in `dcm-mobile/components/labels/LabelMockup.tsx`: the visible half is now the portrait 0.5 × 0.875 (16.7% of holder width, centred at 41.65%) instead of the landscape 0.875 × 0.5, matching the web fix and the 90° rotation the print sheet applies. Grade and QR rescaled for the taller half. Both purple fold-crease bars removed — One-Touch and Toploader — since nothing prints on the fold. Unused `foldCrease` style deleted.
- **Zion `dims` gap closed** (carried over from Phase 1): both `/label-export/batch` and `/label-export/[cardId]` now pass `dims` into the Heritage slab and fold-over vector generators, derived from the design's own width/height and omitted when it is the standard 2.8 × 0.8. Previously a Zion Heritage design printed at full slab size from these routes.

Web typecheck, mobile typecheck, and a clean production build all pass.

*Still to do:* the OTA publish itself, and a look at the mobile fold-over preview on a real device — the geometry change is unverified on hardware.

*Why second:* smallest possible change, removes an active web/mobile disagreement.

### Phase 3 — Split holder from style
**Mobile OTA. The first real UX change, and the prerequisite for the wizard.**

Today's 9 gallery tiles fuse two independent decisions. `slab-modern`, `slab-traditional`, and `slab-heritage` are one holder with three styles; `onetouch`, `toploader`, and `foldover` are two holders with a format option.

Restructure to the web's model: pick a **holder** (Slab / One-Touch / Toploader), then a **style** (Heritage / Modern / Traditional / saved designs), with Toploader offering **Front + Back pair** or **Fold-over**. Add the Zion size option under Slab.

This can ship inside the existing single-screen layout — it does not require the wizard yet, and it is what unlocks Heritage on the small holders in the mobile UI once Phase 1 lands.

*Risk:* medium. Touches the busiest part of a 2,400-line screen and changes the `type` values sent to the export route. Keep the old gallery IDs working as an alias layer so in-flight sessions and any deep links do not break.

### Phase 4 — Multi-card selection in Label Studio
**Mobile OTA.**

Raise Label Studio from one card to the web's 20. The Collection tab already does multi-select and already calls `/label-export/batch` with a `cardIds` list, so both the selection UI pattern and the export contract exist in the app — this is largely wiring them together rather than new invention.

Include the web's sheet-count hint ("12 labels — 2 printed sheets") so the count means something before printing.

*Risk:* medium. Watch memory: 20 cards means 40 QR codes and 40 label renders through a WebView bridge. Consider rendering previews lazily for the visible card only, rather than all 20 up front.

### Phase 5 — The wizard proper
**Mobile OTA.**

Port the step structure and the single-reducer state model. `wizardTypes.ts` is deliberately platform-agnostic — the reducer, `HOLDERS`, `SLAB_SIZES`, `styleOptionsForHolder()`, `stepBlocker()`, and `sheetsNeeded()` contain no DOM or React-DOM references and can move to a shared module or be copied nearly verbatim.

Steps map cleanly to a native stack: a card picker, a holder picker, a style picker with a swipeable preview, a customize screen, a finish screen, and the optional supplies step.

*Risk:* highest of the set, but mostly mechanical once Phases 3 and 4 have already split holder from style and taught the screen to hold multiple cards. Consider keeping today's screen reachable as mobile's own "classic mode", mirroring what web did.

### Phase 6 — Supplies step
**Mobile OTA.**

`src/lib/shopProducts.ts` (shipped in `8b52721`) already holds the catalogue, the affiliate tag, and `productsForHolder()`. Mobile has a Shop tab that can share the same data. Small once Phase 5 exists.

---

## 5. Sequencing and shipping

```
Phase 1 (web)        ──► deploys immediately, helps both apps
Phase 2 (OTA)        ──► ships the same day
Phase 3 (OTA)  ──┐
Phase 4 (OTA)  ──┼──► can ship together as one release
Phase 5 (OTA)  ──┘
Phase 6 (OTA)
```

Every mobile phase is JavaScript only. **No new native dependency is required for any of this**, which means the whole sequence is OTA-able and none of it needs App Store or Play review. That is a direct consequence of the WebView architecture: the heavy rendering already lives on the web side.

The one caveat from prior releases: never OTA master to Android blind, and always publish with `--platform` specified across the 1.0.2 primary and 1.0.1 / 1.0.0 legacy lanes.

---

## 6. Decisions I need from you

1. **How far do you want to go?** Phases 1–3 close the correctness gaps and get Heritage onto the small holders in both apps. Phases 4–6 are the full wizard. Phase 1–3 is meaningfully cheaper and delivers most of the user-visible value.
2. **Keep a mobile "classic mode"?** Web kept the old studio at `/labels/classic`. Doing the same on mobile is cheap insurance but means maintaining two screens.
3. **Shared module or copy?** `wizardTypes.ts` could move to a package both projects import, or be copied into `dcm-mobile`. The monorepo does not currently share code between web and mobile, so a copy is lower friction but will drift.

---

## 7. What I have not verified

- Whether `/label-preview/[cardId]` (the mobile preview path) needs the same Heritage Compact treatment as `/label-export/*`. It renders slab previews today; the compact formats may need it added.
- Real-device memory behaviour at 20 cards. Worth measuring before committing to Phase 4's cap rather than assuming web's number transfers.
- Whether any web flow other than the modals depends on `/label-export/batch`, which affects how much of Phase 1's step 5 is needed.
