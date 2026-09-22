# Card detail V2 — Star Wars parity walk

**Date:** 2026-09-22
**Branch:** `card-detail-v2` (worktree `tmp/card-detail-v2`)
**Route:** `src/app/starwars/[id]/page.tsx` — 10 lines, a redirect
**V2 adapter:** none, deliberately

---

## 1. There is no Star Wars card detail page, and has not been since March 2026

`git log src/app/starwars/[id]/page.tsx` ends at **commit d41b72f8, 2026-03-30,
"Add sub-category system for Other cards, migrate Star Wars"**. That commit:

- removed Star Wars as a top-level card type on the upload page;
- migrated every existing Star Wars row to
  `category='Other', sub_category='Star Wars'`;
- made `/starwars/[id]` redirect to `/other/[id]`;
- removed Star Wars from the collection filters, the verify route and the pop
  report.

Three independent checks agree:

| Check | Result |
| --- | --- |
| Does anything import `src/app/starwars/[id]/CardDetailClient.tsx`? | **No.** `grep` over `src/` returns nothing but the file itself. |
| Does `/sitemap.xml` contain any `/starwars/` URL? | **No.** Every other category has thousands; Star Wars has zero. |
| What does `page.tsx` render? | Nothing. It calls `redirect()` and returns. |

The 7,057-line `src/app/starwars/[id]/CardDetailClient.tsx` is dead code left
behind by that migration. It is frozen like the other seven and was not
touched.

## 2. What was built instead

**No `CardDetailV2Client.tsx` and no `resolveCardDetailVersion` call.** An
adapter here would be a fourth file that no request can ever reach, and the
version decision genuinely belongs to `/other/[id]/page.tsx`, which is where a
Star Wars card is rendered. See `CARD_DETAIL_V2_OTHER_PARITY_2026-09-22.md`;
the test card used there, `0006d261-2865-4df4-a4d0-eae9de83b55e`, is a migrated
Star Wars row (Anakin Skywalker, Topps Star Wars Galaxy #14).

What the route **did** owe the rollout is that a reviewer's version override
survives the hop. Before this change, `/starwars/<id>?v=2` redirected to
`/other/<id>` with the query dropped, so the override silently vanished and the
reviewer got whichever page the flag happened to pick. `page.tsx` now forwards
`v`, and only `v`, and only when it is exactly `'1'` or `'2'` — the same two
values `resolveCardDetailVersion` honours. Anything else is dropped rather than
forwarded, so this cannot become a way to carry arbitrary query parameters onto
`/other`. Nothing else about the route changed.

## 3. The `starwars` branch that does exist in code

`buildTcgCardInfo` in `src/lib/cardDetail/cardInfoCategories.ts` has a
`starwars` branch — the chain the frozen starwars client uses, including the
oddity its own comment records: duplicate object keys were removed and the last
value won, so there is no `sw_` field for cost or power at all and `sw_faction`
really does read the JSON key `card_cost`.

**Nothing in the app reaches that branch today**, and the file says so. It is
kept because `buildCardInfo` is a public function that still accepts the
category, because `CARD_DETAIL_CATEGORIES` still lists `starwars`, and because
it is the only record of that chain outside the dead client. A Star Wars card
loaded through `/other/[id]` is built by `buildOtherCardInfo`.

## 4. Verification

- `curl "http://localhost:3100/starwars/0006d261-2865-4df4-a4d0-eae9de83b55e?v=2"`
  → `307` to
  `http://localhost:3100/other/0006d261-2865-4df4-a4d0-eae9de83b55e?v=2`.
  The destination returns 200 on both `?v=1` and `?v=2`.
- `npx tsc --noEmit` exits 0.
- The Star Wars legacy client is byte-identical
  (`git status --porcelain` shows no change to any `CardDetailClient.tsx`).

## 5. If Star Wars ever comes back as its own route

Everything needed is already in place: the flag lists `starwars`,
`useCardDetail` has its re-grade label, `CardDetailShell`'s `EbayCardType`
accepts it, `DownloadReportButton`'s `cardType` now accepts it (widened in this
pass), and `buildTcgCardInfo` carries the chain. What would be needed is a
`StarWarsCardDetailsV2` adapter — a copy of the One Piece one with `'Topps'`,
`sw_faction` / `sw_era` / `sw_rarity` / `sw_card_type` in the card-info slot —
and the ordinary switch in `page.tsx` in place of the redirect.
