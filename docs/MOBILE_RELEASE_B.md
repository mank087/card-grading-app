# Mobile Release B: card confirmation flow

Prepared September 18, 2026. Spec: `docs/PLAN_mobile_accuracy_parity_2026-09-18.md`, Release B (B1 to B7). The web dialog is the source of truth for behaviour and wording. Everything here ships by OTA. There are no new native dependencies.

**Status:** built and type-checked, and the iOS bundle exports. **Nothing has been run on a device yet.** Nothing is committed.

## What was built

| # | What | Files |
|---|---|---|
| B1 | Pure client helpers moved out of `reviewPrefill.ts` into a dependency-free `reviewClient.ts`: the types, `IdentityReviewState`, `changedFieldPayload`, `NO_CANDIDATE`, `parallelFromListingName`, the merge helpers, `versionPickNeedsSaving`, `identityConfirmationPending` and the field maps. `reviewPrefill.ts` re-exports them. The web dialog now uses them. The file is copied byte for byte to mobile, and a web test compares the two as text. | `src/lib/identity/reviewClient.ts`, `src/lib/identity/reviewClient.test.ts`, `src/lib/identity/reviewPrefill.ts`, `src/components/cards/ConfirmCardDetailsDialog.tsx`, `dcm-mobile/lib/reviewClient.ts` |
| B2 | `ConfirmCardDetailsSheet`: a near-full-height `Modal` with `KeyboardAvoidingView` and a `ScrollView`. It has the same fields, markers, suggestions, "Could also be", version picker, market pricing match, buttons and save flow as the web. Tap a photo to zoom. | `dcm-mobile/components/identity/ConfirmCardDetailsSheet.tsx`, `dcm-mobile/lib/identityReviewApi.ts` |
| B3 | `SetPickerModal`: a searchable `FlatList` of the category's sets, with the year. It has a "Not sure" row and a "Type a set that is not listed" row, which opens a text box. Choosing a set fills an empty Year. Sports and Other have no set list, so they keep a plain text box. | `dcm-mobile/components/identity/SetPickerModal.tsx` |
| B4 | Card screen: `useIdentityReview` decides between the popup, the banner and nothing. The value callout "Confirm your card details to see a value" is now tappable. After a save the screen calls `fetchCard()`, then reprices quietly if the identity or the version pick changed. | `dcm-mobile/components/identity/useIdentityReview.tsx`, `dcm-mobile/app/card/[id].tsx` |
| B5 | Collection: an amber "Confirm details" chip and a grey "Not a standard card" chip. Tapping the chip opens the sheet in place and refreshes that one card afterwards. | `dcm-mobile/app/(tabs)/collection.tsx` |
| B6 | The existing "Edit Card Info" modal is now the sheet's "More details". It sends `expected_identity_revision`. On 409 it reloads the card and keeps the typed entries. On 423 it shows the sold-lock message. | `dcm-mobile/app/card/[id].tsx` |
| B7 | On-demand first look: if the review state has no first look, the sheet POSTs `/first-look` in the background and shows "Checking the card...". It merges the answer without touching any box the owner typed in. | `ConfirmCardDetailsSheet.tsx` |
| Web | `GET /api/cards/identity-confirm` returns `{ enabled }` from the same `IDENTITY_CONFIRM_DISABLED` switch. The collection needs it to hide its chips without loading every card's review state. | `src/app/api/cards/identity-confirm/route.ts` |

### Differences from the web

- **Popup timing.** The popup waits for the review state, the onboarding tour decision, the tour itself, every other sheet on the card screen (zoom, reports, labels, export, edit, edit label, parallel picker, mark as sold) and screen focus. If it is still blocked about 15 seconds after the state loads, it gives up, as on the web, and the banner remains the way in. For a first-card owner, the tour usually runs longer than that, so they get the banner, not the popup. The web behaves the same way.
- **On-demand first look.** The web gates it with `NEXT_PUBLIC_FIRST_LOOK_ON_DEMAND`. The app always asks. The server answers 503 while `FIRST_LOOK_ON_DEMAND` is off, and the sheet then carries on quietly. The "Checking the card..." line shows briefly on older cards either way.
- **"More details" from the collection** opens the card's own screen, as on the web.
- **Chips.** The collection shows one "Confirm details" chip per tile, including tiles whose value is withheld. The web instead puts it in place of the price in some views.

## Before publishing

1. Deploy the web changes first. The new `/api/cards/identity-confirm` route matters most. Without it the app treats the flow as on, so the kill switch would not hide the chips. The app reads nothing else new from the server.
2. Confirm `IDENTITY_CONFIRM_DISABLED` is not `1` in Vercel, unless you want the flow off.

## Device test checklist

Test on a current iPhone, an older or smaller iPhone, and a mid-range Android phone.

1. Grade a new card and open it. The sheet opens by itself on the first visit, with first-look values pre-filled and marked "Read from card" or "Please check".
2. Close the sheet with the X, the backdrop or Android back, then reopen the card. Only the banner should show, with the text "You can still check what we have on file for this card."
3. Correct the set with the set picker. Search, pick a set and check that an empty Year fills. Then use "Type a set that is not listed", save, and check that the price refreshes.
4. Sports card: pick a version under "Which version is it?". Parallel fills. Save and check that the price updates. Also check the "None of these / not sure" row and the serial-number hint on a numbered card.
5. Collection: tap "Confirm details". The tile must not open the card. The loading card shows, then the sheet. Confirm, and the chip disappears.
6. Deck divider (C05): the "Not a standard card" chip shows in the collection. The card screen shows the label and no Market Value section.
7. Card with no set or year: "Confirm your card details to see a value" opens the sheet. Confirm, and the value appears.
8. Kill switch: set `IDENTITY_CONFIRM_DISABLED=1` in Vercel. There should be no popup, no banner, no chips, and the value callout should not be tappable. Turn it off again.
9. Conflict: open the sheet on the phone, change the same card on the web, then save on the phone. You should see the "updated somewhere else" message, with your entries kept. Save again and it works. Repeat with "More details" (Edit Card Info).
10. Sold card: nothing is offered. Forcing a save on a sold card through "More details" shows the sold-lock message.
11. Keyboard: on every device, the Year and Serial boxes near the bottom of the sheet stay visible above the keyboard, and the buttons can be reached.
12. "More details" from the popup opens Edit Card Info on iOS, not a blank screen. Watch for the iOS stacked-modal issue.
13. Tour: on a fresh install with one graded card, the tour runs first and the popup never covers it.
14. Android: after the OTA, smoke-test a credit purchase. The standing rule is never to publish to Android blind.

## OTA publish steps

These follow `dcm-mobile/package.json` `//ota`. Publish one platform at a time and never use `--platform all`. Run everything from `dcm-mobile/`.

```bash
# 1.0.2 lanes (current store builds)
npm run ota:ios -- "Release B: confirm your card details"
npm run ota:android -- "Release B: confirm your card details"

# Legacy iOS lane 1.0.1
#   set "version": "1.0.1" in dcm-mobile/app.json, then:
npm run ota:ios -- "Release B: confirm your card details"
git checkout -- app.json

# Legacy Android lane 1.0.0
#   set "version": "1.0.0" in dcm-mobile/app.json, then:
npm run ota:android -- "Release B: confirm your card details"
git checkout -- app.json
```

After each release, watch for a day:

- identity-review, first-look and details request volume and errors from mobile;
- dismissal versus confirmation counts;
- grading failures.
