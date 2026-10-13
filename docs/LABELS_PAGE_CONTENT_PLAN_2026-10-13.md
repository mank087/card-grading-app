# /labels — Guide Content Below the Label Wizard (Plan, 2026-10-13)

> **Status: BUILT 2026-10-13, uncommitted.** Files: `src/app/labels/page.tsx` (now a server shell),
> `src/app/labels/LabelsPageClient.tsx` (the old page body), `src/components/labelWizard/LabelsGuide.tsx`,
> `LabelsGuideFrame.tsx`, `STEPS` moved to `wizardTypes.ts`, metadata in `labels/layout.tsx`, `public/llms.txt`.
> Decisions applied: collapse for signed-in users, draft copy, emblem tile included, CTA → /get-started.
> Structured data: BreadcrumbList, WebApplication (free), HowTo, FAQPage.

## Goal

`/labels` is one of the most visited pages, but a signed-out visitor sees a heading, a
one-line subtitle and the wizard. Nothing explains what DCM labels are, what the five
steps do, or how far a label can be customized, and search engines get almost no text.

We'll add a guide section **below the wizard**. It explains:
1. what DCM does for labels,
2. a summary of each wizard step,
3. how labels can be customized,

plus holder/size specs, print tips, an FAQ and a call to action for guests.

## What's there today (findings)

| Thing | Where | Note |
|---|---|---|
| Route | `src/app/labels/page.tsx` | Whole page is `'use client'`. During SSR it renders `LabelStudioLoading` (a short intro + "Loading…"), so the copy crawlers see is just that intro. |
| Metadata | `src/app/labels/layout.tsx` | Server component; also wraps `/labels/classic`. |
| Wizard | `src/components/labelWizard/LabelWizard.tsx` | Normal document flow (no sticky or fixed elements); `window.scrollTo(0)` on every step change; the step nav sits under the step content. |
| Steps | `STEPS` in LabelWizard.tsx | 1 Cards, 2 Holder, 3 Style, 4 Customize, 5 Finish, 6 Supplies (optional) |
| Holders / sizes | `HOLDERS`, `SLAB_SIZES` in `wizardTypes.ts` | Slab 2.8"×0.8" (plus Zion Mag Pro 2.51"×0.76"); One-Touch 1.25"×2.375" on Avery 6871; Toploader 1.75"×0.5" on Avery 8167, fold-over option |
| Styles | `wizardTypes.ts` | Heritage, Modern, Traditional (plus saved custom styles) |
| Customization | `StepCustomize.tsx` | Heritage: band colors and band pattern. Modern: color theme, custom colors, pattern style, gradient angle, text color, grade color, border. Text edits per card (`StepConfirm`). Saving a design and setting an account default need sign-in. |
| Guests | `StepCards`, `StepConfirm` | Guests use sample cards and can go through the whole flow; saving a design needs sign-in. |
| Related page | `/reports-and-labels` | An overview of formats. `/labels` should be the "make and print your own" page, and the two should link to each other rather than repeat each other. |

## Key design decisions

### 1. Render on the server, outside the client tool
Make `src/app/labels/page.tsx` a **server component** that renders:

```tsx
<>
  <LabelStudioClient />   {/* the current page body, moved as-is into a 'use client' file */}
  <LabelsGuide />         {/* new server component: static copy + FAQ JSON-LD */}
</>
```

- The copy is in the first HTML response, so it doesn't wait on auth or the card fetch. That's the SEO win.
- `/labels/classic` is untouched. Putting the guide in `layout.tsx` would have leaked it onto classic.
- No extra client JS for the copy.

### 2. "Moves down as users go through the wizard"
This comes almost free, because the wizard is in normal flow:
- The guide sits after the wizard's step nav (Back/Continue), so it **never sits between the tool and its controls**.
- As steps get taller (Style and Customize previews, Finish), the guide is pushed further down.
- The existing scroll-to-top on step change keeps users on the tool, not in the copy.
- Guardrails: no sticky/fixed elements in the guide; a clear visual divider ("About Label Studio") so it reads as separate from the tool; nothing in the guide steals focus.
- Loading state: `LabelStudioLoading` gets a `min-height` close to step 1's height, so the guide doesn't jump when the wizard mounts (keeps CLS down).

### 3. Who sees it
Auth lives in local storage on the client, so the server can't tell who is signed in. That means:
- **Server-render the guide for everyone** (crawlers and guests get the full copy).
- **Signed-in users (decided: collapse):** a small client wrapper collapses it to a single "How Label Studio works" disclosure, closed by default. It stays in the DOM, so SSR is unchanged.
- **Org-scope members** (Brand Setup redirect card): hide the guide, because it describes a flow they can't use.

### 4. One source of truth for facts
Export `STEPS` from LabelWizard (or move it into `wizardTypes.ts`). The guide then imports `STEPS`, `HOLDERS`, `SLAB_SIZES` and `MAX_WIZARD_CARDS` and builds its step list, dimensions and Avery numbers from them. If a holder or size changes, the copy can't go out of date. Step descriptions stay hand-written, keyed by step number.

## Content outline (draft copy for owner edit)

**A. What DCM does for labels** (short intro, about 80 words)
Every DCM-graded card comes with a label built from its grading report: card name, set,
year and number, the DCM grade, and a serial that links to the card's verifiable report
page through the QR code on the back. Label Studio lets you design and print those labels
yourself for graded slabs, magnetic one-touch holders and toploaders, on plain paper or
standard Avery sheets. *(Confirm what goes on the label against `labelDataGenerator.ts`
before publishing.)*

**B. How the Label Wizard works** (6-item numbered list; built from `STEPS`)
1. **Cards**: pick up to 20 graded cards from your collection (guests use sample cards).
2. **Holder**: slab, one-touch or toploader. The holder sets label size and print sheet.
3. **Style**: Heritage (ivory field, patterned color band), Modern (dark gradient, bold type) or Traditional (classic layout, DCM purple frame).
4. **Customize**: colors, patterns, text and grade color, with a live preview across every card you picked.
5. **Finish**: optional text edits per card, then download a print-ready PDF. Signed-in users can save the design and make it their default.
6. **Supplies** (optional): which cases, sheets and cutting tools go with your labels.

**C. Holders and label sizes** (3-card grid or table; built from `HOLDERS`/`SLAB_SIZES`)
Holder · label size · paper stock · notes (duplex/fold-over, Zion Mag Pro size).

**D. Ways to customize your labels** (feature grid, 6–8 tiles)
Heritage band colors and patterns · Modern color themes and custom palettes · gradient angle
and pattern styles · text, grade and border color · per-card text edits that apply wherever
the label appears · saved designs and an account-wide default · membership emblems (Founder /
VIP / Card Lovers) · Classic design mode for full manual control (link `/labels/classic`).

**E. Printing tips** (4–5 bullets)
Print at 100% / "actual size" · paper or cardstock suggestions per holder · duplex vs.
fold-over for slab backs · Avery sheet numbers · test-print one sheet first.

**F. FAQ** (5–6 Q&As, visible on the page, with `FAQPage` JSON-LD from `faqPage()` in `src/lib/seo/blogSchema.ts`)
- Do I need a DCM-graded card to make a label?
- Can I try Label Studio without an account?
- What paper or label sheets do I need?
- Will my label fit a PSA/BGS-style slab or a Zion Mag Pro?
- Can I change the text on a label?
- Are labels free? *(owner to confirm wording)*

**G. Guest CTA band** (guests only, or for everyone with wording that adapts)
"Grade your first card, 2 free grades" → `/get-started`; secondary link → `/reports-and-labels`.

Target length: about 600–900 words in total. Long enough to rank, short enough not to bury the page.

## Implementation steps

1. Move the current `page.tsx` body into `LabelStudioClient` (a new client file; the name is taken by the old studio, so call it `LabelsPageClient.tsx`). `page.tsx` becomes a server component.
2. Export `STEPS` (move it to `wizardTypes.ts`).
3. Build `src/components/labelWizard/LabelsGuide.tsx` (server) with sections A–G, using the existing `dcm-*` design-system classes (`dcm-section`, `dcm-container`, `dcm-eyebrow`, `dcm-lead`).
4. Add `LabelsGuideCollapse` (client) for the signed-in collapse and org-scope hide.
5. Add `FAQPage` JSON-LD with `faqPage()`.
6. Give `LabelStudioLoading` a min-height and remove its duplicated intro text where the guide now covers it.
7. Optionally trim `layout.tsx` metadata so the description matches the new copy.
8. Link to `/labels` from `/reports-and-labels` with "Design your own in Label Studio", and back from the guide.

Estimated effort: about half a day of build plus owner copy review. It touches only the web; nothing is needed for mobile or OTA (the app's label flow is native).

## Verification

- Signed-out, `curl /labels`: the HTML contains the guide headings and FAQ JSON-LD.
- Guest walk-through of steps 1→6 at desktop and at 375 px: the guide always stays below the step nav, there's no overlap or horizontal scroll, and the scroll-to-top still lands on the tool.
- Signed-in: the guide is collapsed. Org-scope: the guide is hidden.
- `/labels/classic` is unchanged.
- Rich Results Test passes on the FAQ; Lighthouse CLS shows no regression.
- `npx tsc --noEmit` passes. Build in an isolated worktree, not beside the dev server.

## Owner decisions

1. ~~Signed-in users: collapse or hide?~~ **DECIDED 2026-10-13: collapse** (a closed "How Label Studio works" disclosure; the copy stays in the server-rendered HTML).
2. Approve or edit the draft copy, especially section A and the "are labels free" FAQ.
3. Include the membership-emblem tile? (It promotes VIP/Card Lovers but may confuse guests.)
4. Guest CTA target: `/get-started` (recommended) or `/login?mode=signup`?
