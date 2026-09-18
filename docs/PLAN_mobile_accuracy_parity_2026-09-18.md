# Mobile parity plan: first look, card confirmation and pricing safeguards

Prepared September 18, 2026, after the accuracy program shipped to the web (master `a044e619`). Covers the native app on iOS and Android (`dcm-mobile/`, Expo SDK 54).

## Summary

Mobile users already benefit from everything that runs on the server. What they are missing is the part they see: the "Confirm your card details" sheet, the "Confirm details" and "Not a standard card" tags, the clearer grading-failure message, and a few request fields the server now uses.

**No new native modules are needed**, so all of it ships by OTA update. No App Store or Play Store review is required.

Estimated effort is about 7–9 engineering days, released in two OTAs:

- **Release A:** fast safety fixes, about 1–2 days.
- **Release B:** the confirmation sheet and collection tags, about 5–7 days.

## 1. Where mobile stands today

### Already live for mobile users, because it runs on the server

| Feature | Why it already works on mobile |
|---|---|
| First look | It runs inside the grading API the app calls, so every mobile grade gets one. |
| Fail-closed inspection and atomic refunds | Server-side. A mobile grade that stops is marked failed and its credit is refunded. |
| Item-type check ("not a standard trading card") | Recorded on the card at grading time. |
| Price-write guard | Server-side. The app sends no revisions yet, so its own price saves are accepted without the check. |
| MTG flavor-title fallback | Used by the background refresh and the post-grading lookup. |
| Value guard in server totals | Covers the portfolio API and any screen that reads server totals. |

### Written for mobile but not yet published

Checked against the last OTA, the Sept 15 batch on all four lanes. The only mobile changes since then are these:

- `lib/valueGuard.ts`, `lib/itemType.ts` and the updated `lib/resolveCardValue.ts`. These are byte-identical to the web copies, and a web test fails if they drift.
- The card screen shows "Confirm your card details to see a value" to the owner when a value is withheld.
- Collection totals, the marketplace `CardPicker` and the eBay listing screen skip withheld values.

### Missing on mobile

1. **Confirmation sheet.** The app has no equivalent of the web dialog: no first-visit popup, no "Review later", no banner, no set picker, no version picker, no market pricing match block.
2. **Collection tags.** There is no "Confirm details" tag, and nothing opens a confirmation from the collection.
3. **"Not a standard trading card" label.** The card screen does not show it, and its Market Value section is still visible for those items.
4. **Grading-failure message.** When inspection is incomplete, the processing screen shows the generic failed state. The app fires the grading request and ignores the response, so it never reads `inspection_incomplete` or `credit_refund_status`.
5. **Request fields.**
   - The card screen's price lookups send `cardName` only, with no `alternateName`. MTG crossover cards such as "Splinter of the Shadows" therefore find nothing when priced from the phone.
   - They send no `identity_revision` or `pricing_selection_revision`, so a correction made on the web can be overwritten by a slow price request from the phone.
6. **Collection query gap.** The collection query does not select `item_type`. The guard treats a missing field as a standard card, so a divider or sticker would still show a value in the collection.

## 2. Design decisions

1. **Server decides, the app renders.** The sheet calls the same endpoints as the web:
   - `GET /api/cards/[id]/identity-review` for the prefill, eligibility, candidates and pricing match
   - `POST /api/cards/[id]/first-look` for an older card with no first look
   - `GET /api/cards/set-options?category=` for the set list
   - `PATCH /api/cards/[id]/details` with `confirm`, `dismiss` or `expected_identity_revision`
   - `POST /api/pricing/dcm-select` for the version pick
   
   No identification or prefill logic is duplicated in the app.
2. **Only tiny pure helpers are copied.** The sheet needs three: `changedFieldPayload`, `NO_CANDIDATE`, and the bracket-to-parallel helper. Move them out of `src/lib/identity/reviewPrefill.ts` into a dependency-free `src/lib/identity/reviewClient.ts`, and copy it verbatim to `dcm-mobile/lib/reviewClient.ts` with a drift test, following the `valueGuard.ts` pattern.
3. **A server-side kill switch, not a baked-in flag.**
   - `EXPO_PUBLIC_*` values are frozen into each OTA bundle, so a problem would need a new OTA to turn off.
   - Instead, make `/identity-review` return `mode: 'none'` when a server env var such as `IDENTITY_CONFIRM_ENABLED` is not `1`. The app always asks the server.
   - This gives one switch in Vercel that turns the feature off on web and both mobile platforms at once. It is a small web change and should land first.
4. **Same rules as the web.**
   - The sheet auto-opens the first time an owner opens an unconfirmed card.
   - Closing an auto-opened sheet counts as "Review later", and the banner takes over.
   - A stored value is never replaced silently. A first-look value that disagrees is offered as "Possible *field* alternative: X · Use".
5. **Native controls only.**
   - React Native `Modal` as a full-height sheet, with `KeyboardAvoidingView`.
   - The set picker is a searchable `FlatList` in a second modal, because MTG has 988 sets. It includes a "Type a set that is not listed" row.
   - The version picker is a radio list.
   - No `@react-native-picker` or other native dependency, which keeps everything OTA-able.

## 3. Work plan

### Release A: safety fixes (about 1–2 days, one OTA)

Most of this code is already written.

| # | Change | Files |
|---|---|---|
| A1 | Add `item_type`, `identity_revision` and `pricing_selection_revision` to the collection columns and the eBay listing selects | `app/(tabs)/collection.tsx` (`CARD_COLUMNS`), `app/pages/ebay-list.tsx` |
| A2 | MTG price lookups send `alternateName` (the card's `featured` / `player_or_character`) | `app/card/[id].tsx` (`buildPriceLookup`, `buildVariantLookup`) |
| A3 | Price lookups send `identity_revision` and `pricing_selection_revision`. On HTTP 409 `price_write_stale`, reload the card and retry once, quietly | `app/card/[id].tsx` |
| A4 | Card screen: show "Not a standard trading card" plus its one-line explanation (from `lib/itemType.ts`), and hide the Market Value section for those items | `app/card/[id].tsx` |
| A5 | Processing screen: read the grading response. On `inspection_incomplete`, show "Inspection incomplete. We could not finish a reliable grade." plus the refund line (refunded / not charged / could not confirm, contact support), matching the web wording in `src/lib/grading/inspectionMessage.ts` | `app/grade/processing.tsx`, `lib/gradingJob.ts` |
| A6 (web) | Server kill switch on `/identity-review` (decision 3) | `src/app/api/cards/[id]/identity-review/route.ts` |

### Release B: confirmation flow (about 5–7 days, one OTA)

| # | Change | Files |
|---|---|---|
| B1 | Extract `reviewClient.ts` on web and copy it to mobile with a drift test | `src/lib/identity/reviewClient.ts`, `dcm-mobile/lib/reviewClient.ts` |
| B2 | `ConfirmCardDetailsSheet` (details below) | new `components/identity/ConfirmCardDetailsSheet.tsx` |
| B3 | `SetPickerModal`: searchable list from `set-options`, with the release year and a write-in row. Choosing a set fills an empty Year | new `components/identity/SetPickerModal.tsx` |
| B4 | Auto-open logic on the card screen: first visit only, never over the onboarding tour or another modal, closing counts as dismissal. Banner otherwise | `app/card/[id].tsx` |
| B5 | Collection: amber "Confirm details" chip on unconfirmed graded cards, "Not a standard card" chip on labelled items. Tapping the chip opens the sheet in place and refreshes that card afterwards | `app/(tabs)/collection.tsx` |
| B6 | The existing edit modal becomes the sheet's "More details". It sends `expected_identity_revision` and handles 409 and 423 | `app/card/[id].tsx` |
| B7 | On-demand first look for older cards: `POST /first-look` while the sheet is open, merging suggestions without overwriting anything typed | `ConfirmCardDetailsSheet.tsx` |

**B2 sheet contents, in order:**
1. Front and back photos, tap to zoom. Use the signed URLs the card screen already holds, or the thumbnails in the collection.
2. The fields, each with its marker ("Read from card" or "Please check"), a "Possible *field* alternative" line with **Use**, and "Printed as" when relevant.
3. "Could also be" alternatives.
4. Sports only: "Which version is it?", with the serial-number hint, the candidate rows (name, set, "Numbered /N" and ungraded price when known), and "None of these / not sure". Choosing a version fills Parallel.
5. The "Market pricing match" block, or "No market pricing match yet. Make sure the card name and card number are correct."
6. Buttons:
   - **Looks correct**, which becomes **Update details** once anything is changed
   - **Review later**
   - **Reset to original findings**
   - **More details**

The save flow is identical to the web: PATCH only the changed fields, with `confirm: true`, then `dcm-select` if the version pick changed. A pricing failure never undoes a saved identity.

## 4. Testing

**Automated**
- Drift tests keep `valueGuard`, `itemType`, `resolveCardValue` and `reviewClient` identical between web and mobile.
- Unit tests cover the pure helpers.
- The endpoints are already covered by the web test suite.

**Devices.** A current iPhone, an older or smaller iPhone, and a mid-range Android phone. Run through:

1. Grade a card and confirm the sheet opens on the first visit with first-look values pre-filled.
2. Close the sheet and reopen the card. Only the banner should show.
3. Correct a set with the set picker, including the write-in row, save, and confirm the price refreshes.
4. Sports card: pick a version and confirm Parallel fills and the price updates.
5. Collection: tap "Confirm details" and confirm in place. The chip should disappear.
6. Deck divider (C05): label shown, no Market Value section.
7. MTG crossover card: price appears.
8. Card with no set or year: "Confirm your card details to see a value", then confirm, then the value appears.
9. Grading failure path: the refund message is correct.
10. Kill switch off: no sheet, no banner, no chips.
11. Android: smoke-test a credit purchase after the OTA. This follows the standing rule never to publish to Android blind.

## 5. Release steps

Follow the documented OTA procedure in `dcm-mobile/package.json` (`//ota`):

1. Land the web change A6 and turn the server switch on.
2. `npm run ota:ios -- "message"`, then `npm run ota:android -- "message"`, always one platform at a time.
3. Repeat for the legacy lanes, 1.0.1 iOS and 1.0.0 Android: set the `app.json` version, publish, then `git checkout -- app.json`.
4. After each release, check grading failures and incomplete-inspection counts from mobile cards for a day.

## 6. Open decisions

1. **Popup on mobile.** Recommended: the same first-visit sheet as the web. The alternative is a quieter banner-only rollout on mobile first.
2. **Two OTAs or one.** Recommended: two, so the safety fixes reach phones within a day or two instead of waiting for the sheet.
3. **Server kill switch.** Recommended: yes, before Release B.
