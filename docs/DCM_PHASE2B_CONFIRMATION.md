# Phase 2B: owner confirmation of card details

September 17, 2026. Implements increment 2B of
[DCM_PHASE2_IDENTITY_CONFIRMATION_SCOPE.md](DCM_PHASE2_IDENTITY_CONFIRMATION_SCOPE.md)
on top of the save contract in
[DCM_PHASE2A_IDENTITY_SAVE.md](DCM_PHASE2A_IDENTITY_SAVE.md). No database
migration, no grading change, no price-matcher change. Nothing was applied to
production and no production data was read.

## What changed

| File | Change |
|---|---|
| `src/lib/identity/reviewPrefill.ts` | New. All the logic: field precedence, season-to-year, eligibility, catalog candidate pre-selection, and the changed-field payload. Pure. |
| `src/lib/identity/reviewPrefill.test.ts` | New. 39 unit tests. |
| `src/app/api/cards/[id]/identity-review/route.ts` | New. Owner-only GET with the review state, the prefill, first look's alternatives and the sports catalog candidates. |
| `src/app/api/cards/[id]/identity-review/route.test.ts` | New. 12 route tests with mocked auth, Supabase and PriceCharting. |
| `src/app/api/cards/[id]/first-look/route.ts` | New. Owner-only POST that runs first look on demand for a card that has none. |
| `src/app/api/cards/[id]/first-look/route.test.ts` | New. 12 route tests with mocked auth, Supabase, storage, image download and runner. |
| `src/components/cards/IdentityReview.tsx` | New. The one mount per page: decides popup / banner / nothing, owns the dialog, and exports `ConfirmCardDetailsCalloutButton` for the value-guard callout. |
| `src/components/cards/ConfirmCardDetailsDialog.tsx` | New. The dialog itself. |
| `src/app/<category>/[id]/CardDetailClient.tsx` (eight files) | +13 lines each, no deletions: one import, one `<ConfirmCardDetailsCalloutButton />` inside the existing value-guard callout, one `<IdentityReview …>` above the card information block. |

## The flow

1. The owner opens a graded card. `IdentityReview` renders nothing and makes no
   request unless `NEXT_PUBLIC_IDENTITY_CONFIRM=1`, the viewer owns the card, and
   the card is neither sold nor deleted.
2. It reads `GET /api/cards/[id]/identity-review`, which returns
   `mode: 'popup' | 'banner' | 'none'`.
   - **popup** — graded on or after `NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE`, not
     dismissed, not confirmed at the current `identity_revision`.
   - **banner** — everything else that still needs a review: older cards,
     dismissed cards, and every card when no rollout date is set.
   - **none** — not the owner, ungraded, still grading, failed, sold-locked,
     deleted, or already confirmed at the current revision.
3. The popup opens at most once per page load, about 600 ms after the state
   arrives, and only when no other overlay is on screen (see
   "Modal conflicts"). Escape and a backdrop click close it without dismissing:
   the banner stays.
4. The dialog shows front and back (tap to enlarge) and a compact form of:
   card title, player or character, set, year, card number, manufacturer, insert
   or subset, parallel (sports only) and serial numbering.
5. Each box carries a marker. **Read from card** means first look transcribed the
   value off the photo. **Please check** means it recognized or inferred the
   value and it only filled a blank. No marker means it is the value the grading
   run stored. A disagreement appears under the box as `Suggested: <value> · Use`,
   and first look's `alternatives` appear as a short "Could also be" list.
6. Sports cards get a "Which version is it?" radio list of catalog products, with
   a best guess pre-selected by token overlap, a `(Base)` marker on the plainest
   product, and always "None of these / not sure". Other categories get one line
   pointing at the Market Pricing section, because each category has its own
   lookup component and this phase does not rebuild them.
7. The primary button reads **Looks correct** while nothing differs from what is
   stored, and **Save and confirm** as soon as anything does. It sends only the
   changed fields plus `confirm: true` and `expected_identity_revision` to
   `PATCH /api/cards/[id]/details`.
   - 409 reloads the review state, keeps everything the owner typed, and explains
     what happened.
   - 423 shows the existing sold-record message.
   - After a successful save, a chosen catalog product is posted to
     `/api/pricing/dcm-select`. A pricing failure never undoes the identity save:
     it is reported as one calm line and the owner presses Done.
8. **Review later** sends `PATCH { dismiss: true }`. A dismissal is not a
   confirmation: the banner stays and the popup never returns for that card.
9. **More details** opens the existing `EditCardDetailsModal` unchanged.
10. After any successful save the page's own post-edit handler runs, which is the
    same `window.location.reload()` the advanced editor already used, so the card,
    the label and the pricing refresh exactly as before.

### Precedence, and why it is this way

Measured on 2026-09-17: first look's own confidence label is uninformative, a
"recognized" set name is wrong on look-alike products (it called a 1977 Wonder
Bread card "Topps"), and true parallels are named correctly only about 40-45% of
the time whatever the prompt says. So first look pre-fills and suggests; the
owner decides.

1. A first-look value with source `printed` wins, and is labelled as read from
   the card. It is also counted as a pending change, so pressing the primary
   button does save it.
2. Otherwise the stored value wins when it carries information. `unknown`, `n/a`
   and `none` do not count as information.
3. Otherwise a `recognized` or `inferred` value fills the blank and is marked
   "Please check".
4. When the stored value is present and first look disagrees, the stored value
   stays and first look's becomes a one-tap suggestion.
5. Nothing is invented. A field with no evidence stays empty.

Two details: a season such as `1995-96` is stored as `1995` because the year
column only accepts four digits, and the season is shown under the box. Card
numbers and serial stamps come from the verbatim transcription, so `116/086`,
`091/086`, `RA-CS` and `23/99` survive; only a leading `#` is stripped.

### Modal conflicts

These pages already have an onboarding tour, a first-grade congratulations modal,
a post-result offer, a label editor and a consent banner. Rather than hard-code
their names, `anotherOverlayOpen()` in `IdentityReview.tsx` looks for any visible
element with `role="dialog"`, or any visible full-screen `fixed inset-0` element
with a `z-index` of 40 or more, that is not one of ours. If one is open the
popup waits 500 ms and looks again, for up to about 15 seconds; after that the
banner is the way in and the owner is not ambushed later in the session. Our own
overlays are excluded by a `data-dcm-identity-review="true"` wrapper.

## Environment flags

| Flag | Where | Effect |
|---|---|---|
| `NEXT_PUBLIC_IDENTITY_CONFIRM` | browser | `1` turns the whole feature on. Anything else: nothing renders and no request is made. |
| `NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE` | browser and server | ISO date. A card graded on or after it may pop up. **Unset means never pop up** — every eligible card gets the banner instead. This is the rollout control: set it to the deploy date so old collections are not covered in popups. |
| `FIRST_LOOK_ON_DEMAND` | server | `1` lets `POST /api/cards/[id]/first-look` run. Off returns 503 and never calls OpenAI. |
| `NEXT_PUBLIC_FIRST_LOOK_ON_DEMAND` | browser | `1` lets the dialog ask for that run in the background. Set both or neither. |
| `FIRST_LOOK_SHADOW` | server | Unchanged from Phase 1: fills `cards.first_look` at grading time. Most existing cards have none, which is why the on-demand route exists. |
| `FIRST_LOOK_SEARCH` | server | `1` allows first look's web-search second pass when the card does not name its own product. |

## Costs

- The first-look contract pass is about half a cent per card (one vision call,
  roughly 7K input tokens, two photos at 1600px).
- The search pass costs a few cents and takes 20-35 seconds, and only runs when
  pass 1 could not read the set off the card. That is why the dialog opens
  immediately with stored values, shows a quiet "Checking the card..." line, and
  merges the answer in later without overwriting anything the owner has typed.
- The confirmation itself costs nothing: no credit, no grading call, no new
  signed image URLs. The dialog reuses the front and back URLs the page already
  holds, so a review adds no Supabase egress.
- `GET identity-review` on a sports card makes one PriceCharting search. On
  other categories it makes none.

## What is NOT done

- **Native mobile.** No changes under `dcm-mobile/`. The API is additive so the
  app keeps working, but there is no confirmation UI on iOS or Android.
- **Non-sports pickers inside the dialog.** Pokemon, MTG, Lorcana, One Piece,
  Yu-Gi-Oh, Star Wars and Other point at their existing Market Pricing lookup
  instead. Sports is the only category with a picker in the dialog.
- **Revision-guarded background price writers (2C).** Still open, unchanged from
  2A: `dcm-save`, `/api/pricing/*`, `batchPriceRefresh` and the crons write
  prices by card id with no identity or selection revision condition, so a slow
  price request that started before a correction can still land after it. 2B
  makes corrections much more likely, so this is now the most valuable next fix.
- **`pricing_selection_revision` is still a read-then-write bump** inside
  `dcm-select`, not an atomic increment.
- **The admin corrections path** (`src/lib/gradeReview/cardDetails.ts`) still has
  its own identity writer and does not go through `saveCardIdentity`, so an admin
  correction does not bump `identity_revision` and cannot invalidate a
  confirmation.
- **No server-side gate on the public flag.** `GET identity-review` answers even
  when `NEXT_PUBLIC_IDENTITY_CONFIRM` is off. It is an owner-only read of the
  owner's own card, so this is deliberate, but it means the flag is a UI switch
  and not an API switch.
- **The on-demand guard is per instance.** Two lambdas can still run first look
  for the same card at the same time. It stops the common cases (a dialog that
  mounts twice, an owner who reopens it) and the second run simply overwrites the
  first.
- **No browser verification.** Everything below the API line is covered by unit
  and route tests; the dialog, the banner, the popup timing, the focus trap and
  the 360px layout have not been rendered in a browser. Walk the checklist.

## Manual test checklist

Set `NEXT_PUBLIC_IDENTITY_CONFIRM=1` and `NEXT_PUBLIC_IDENTITY_CONFIRM_SINCE` to
today. Leave the first-look flags off for the first pass.

1. **Off is off.** With `NEXT_PUBLIC_IDENTITY_CONFIRM` unset, open a graded card:
   no banner, no popup, and no `identity-review` request in the network tab.
2. **Popup, once.** Grade a card today, open it: the popup appears a moment after
   the page settles. Close it with Escape, then with a backdrop click: the banner
   is there both times and the popup does not come back on this page load. Reload:
   it appears again.
3. **Not over a tour.** Open a card that triggers the first-grade congratulations
   modal or the onboarding tour. The popup must wait until that is finished.
4. **Confirm with nothing changed.** Press "Looks correct". The page reloads, the
   banner is gone, and a withheld value above $500 now appears.
5. **Correct something.** Change the set or year. The button becomes "Save and
   confirm". Save, then check the card information block, the label preview and
   the collection row all show the corrected value, and that the old price is
   gone rather than carried over.
6. **Review later.** On another card press "Review later": the banner stays, the
   popup never returns for that card even after a reload, and the value guard is
   still in force (a dismissal is not a confirmation).
7. **Callout button.** Find a card whose value is withheld ("Confirm your card
   details to see a value"). The button in that callout opens the same dialog.
8. **Sports picker.** On a sports card with parallels, check the pre-selected
   version looks sane, pick another, save, then confirm Market Pricing shows the
   product you picked. Pick "None of these / not sure" on another card and
   confirm no selection is saved.
9. **More details.** The text link opens the old Edit Card Details modal, and
   saving from there still works.
10. **Conflict.** Open the dialog, edit a field, then in another tab change the
    same card through Edit Card Details. Save in the first tab: you should get
    the "updated somewhere else" message with your typing intact, and a second
    save should succeed.
11. **Sold card.** Mark a card sold: no banner and no popup. Reopen the dialog
    through the callout if you can reach it and confirm the 423 message appears
    rather than a silent failure.
12. **Not the owner.** Open the card in a logged-out window: nothing at all.
13. **Phone width.** At 360px the two photos sit side by side, every box is
    reachable, the buttons stack, and the dialog scrolls without the page behind
    it moving.
14. **Keyboard.** Tab cycles inside the dialog only, every box has a label, and
    Escape closes.
15. **First look on demand.** Turn on `FIRST_LOOK_ON_DEMAND=1` and
    `NEXT_PUBLIC_FIRST_LOOK_ON_DEMAND=1`. Open an older card: "Checking the
    card..." appears, and when the answer lands the empty boxes fill with
    "Please check" markers while anything you already typed is untouched. Confirm
    the grade, the sub-scores and the credit balance are all unchanged.

## Running the tests

```
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/vitest/vitest.mjs run src/lib/identity src/lib/identification "src/app/api/cards/[id]"
```
