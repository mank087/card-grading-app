# Navigation — usability review and roadmap (desktop + mobile web)

**Status:** proposal + full usability review, nothing implemented
**Date:** August 14, 2026 · reviewed and expanded August 17, 2026
**Question asked:** the DCM mobile apps have good navigation — would it be
efficient and good practice to use similar navigation on mobile web, and if so
how do we implement it?

**Answer:** yes, but scoped to authenticated app-like routes, and only after a
prerequisite fix (Phase 1) that the current design silently depends on. The
Aug 17 review adds a Phase 0 of independent quick wins — real gaps found by a
full IA inventory — and resolves the open questions at the bottom.

---

## Aug 17 usability review — findings from a full IA inventory

A complete audit of `Navigation.tsx` (desktop + drawer), `Footer.tsx`, and the
native app's tab bar + Menu tab surfaced the following, in priority order.

### Functional gaps (fix regardless of any redesign)

1. **The Grade dropdown omits Yu-Gi-Oh!** The nav CTA offers 6 categories, the
   footer offers 7. A supported card type is invisible at the primary CTA.
2. **Org members on mobile web cannot manage their org.** The desktop
   workspace switcher offers Enterprise Page / Welcome / Brand Setup /
   Billing & Grades; the mobile drawer switcher only toggles scope. A store
   owner on a phone (the grading-at-the-counter persona) has no path to Brand
   Setup at all. Highest-value single fix in this document.
3. **The logged-out drawer has no Sign Up item.** The CTA exists in the header
   row, but the drawer — where a lost visitor goes hunting — dead-ends at
   Login.
4. **Shop is unreachable on desktop.** It exists only in the mobile drawer
   ("Shop") and footer ("Recommended Products" — a different name). Add to the
   desktop account dropdown under one canonical label.
5. **Card Shows pages exist on web but are linked from nowhere** (app-menu
   only). Add to footer Resources at minimum — it is also SEO surface.

### Consistency drift (one cheap polish batch)

- Same destination, wandering labels: "Featured" vs "Featured Cards"; "Shop"
  vs "Recommended Products"; "eBay InstaList" vs "InstaList" vs "InstaList
  Marketplace". Pick one name per destination on every surface.
  (Deliberate audience-based labels are fine and should stay: "Pricing"
  logged-out vs "Buy Credits" logged-in, "How It Works" vs "Grading Rubric".)
- Pop Report's position wanders: last in the drawers, mid-list in the account
  dropdown, buried in footer Resources.
- The nav's Grade links carry a `t=Date.now()` cache-buster; the footer's
  identical links don't.
- The search icon doesn't reveal it is serial-only until opened. Label it
  "Serial lookup" (mirrors the app's "Search by Serial").
- App Menu has "My Account" and "Change Password" pointing at the same page.

### Structural (what the tab-bar plan below solves)

The mobile drawer is a 17-item single list behind one tap — nothing in the
thumb zone — and app users arrive with muscle memory the site contradicts.
The original diagnosis and phasing below stand.

---

## Where things stand today

### The mobile app (`dcm-mobile`)

Six-tab bottom bar, `dcm-mobile/app/(tabs)/_layout.tsx`:

| Tab | Screen | Icon |
|---|---|---|
| Grade | `grade` | custom card glyph |
| Collection | `collection` | grid |
| Labels | `labels` | pricetags |
| Portfolio | `market-pricing` | cash |
| InstaList | `instalist-marketplace` | eBay wordmark |
| Menu | `account` | hamburger |

Above it sits `dcm-mobile/components/AppHeaderBar.tsx` — logo, credit badge
(green ≥3 / amber 1-2 / red 0), and a purple Grade CTA on tab screens; back
button instead on detail screens. `shop` is deliberately off the bar
(`href: null`), reachable from Menu → Tools.

The Menu tab (`(tabs)/account.tsx`) is a sectioned list: Getting Started,
Grading, Tools, Pricing & Plans, Information, Account.

### Mobile web (`src/app/ui/Navigation.tsx`, 1174 lines)

A sticky top bar with a hamburger drawer holding **22 links**, constrained to
`100dvh - 4rem` with its own scroll container. Everything — grading, collection,
labels, portfolio, InstaList, account, legal — is behind one tap plus a scroll.
Nothing sits in the thumb zone.

---

## Why bottom tabs are worth it here

- Bottom bars are established mobile-web practice (YouTube, X, Instagram,
  Reddit all ship one). This is not a native-only pattern.
- The payoff is larger than usual for DCM because the apps exist: a user who
  installs the app and later opens the site on a phone arrives with muscle
  memory the site currently contradicts.
- It moves the five highest-frequency tasks from "two taps + scroll" to one
  thumb-reachable tap.

---

## The trap — the app renders the website inside itself

`dcm-mobile/components/ui/InAppPage.tsx` loads web pages in a WebView and strips
the site's chrome by **injecting CSS**:

```css
header, nav, footer { display: none !important; }
main { padding-top: 16px !important; }
```

plus a sweep hiding any `position: fixed` element with
`bottom < 50 && right < 50 && z-index >= 40` (aimed at the HelpBot button), and
a `[data-dcm-launch-banner]` rule.

Consequences for a web bottom bar:

- Built as `<nav>` → hidden by accident inside the app. Works, but by luck.
- Built as `<div>` → renders **underneath the app's own tab bar**. Two tab bars.
- The `.fixed` sweep may or may not catch a full-width bar depending on the
  z-index, so behaviour is unpredictable either way.

This affects the highest-traffic paths: Market Pricing, InstaList, and card
detail are all WebView screens (`app/pages/*.tsx` → `InAppPage`).

Relying on a CSS hack inside a shipped binary — one that only updates through
the app stores — is the fragile part. **Phase 1 replaces it with a contract the
web owns, and is worth doing whether or not the tab bar ships.**

## The second constraint — marketing pages

Logged-out mobile traffic lands on the homepage, blog, pricing, `/enterprise`,
and the pop report. A persistent app-shell bar there costs ~56px plus safe area,
competes with conversion CTAs, and reads as "app" to someone who has not signed
up. Those pages keep the current top nav.

---

## Proposed shape

**Show the bottom bar when all hold:**

1. viewport < `lg`
2. user is authenticated
3. route is on the app-route allowlist
4. not embedded in the app WebView

**Tabs — mirroring the app so muscle memory transfers:**

| Tab | Route | Note |
|---|---|---|
| Grade | `/upload` | primary CTA styling |
| Collection | `/collection` | |
| Labels | `/labels` | **hidden in org scope** — org label design lives in Brand Setup |
| Portfolio | `/market-pricing` | |
| InstaList | `/instalist-marketplace` | |
| Menu | sheet | everything else |

In org scope, Labels swaps for **Enterprise Page**, keeping six tabs. The scope
signal already exists in `src/contexts/OrgContext.tsx` (`isOrgScope`).

**Top bar slims on mobile** once the bar exists: logo, credits/workspace pill,
search. The hamburger goes away; its 22 links become the Menu sheet, reusing the
app's section headings.

---

## Phases

### Phase 0 — quick wins *(Aug 17; ~½ day, no IA risk, ship first)*

All independent of the tab-bar decision:

1. Add Yu-Gi-Oh! to the nav Grade dropdown (parity with the footer).
2. Add the four org-management links (Enterprise Page / Welcome / Brand Setup /
   Billing & Grades) to the mobile drawer under the workspace switcher.
3. Add Sign Up to the logged-out drawer.
4. Add Shop to the desktop account dropdown; normalize its label everywhere.
5. Add Card Shows to footer Resources.
6. Label normalization pass (Featured Cards, InstaList naming, Pop Report
   placement).
7. Label the search field "Serial lookup".
8. Drop the `t=Date.now()` cache-buster asymmetry.
9. **Instrument nav clicks** as consent-gated gtag events before Phase 2 ships,
   so drawer-era vs tab-era engagement is comparable with real numbers — and so
   the "does Shop/Credits deserve a tab?" question is answered with data.

### Phase 1 — embedded-mode contract *(prerequisite)*

Web reads an explicit signal — `?dcm_app=1` setting a class/attribute on
`<html>`, or a header — and `Navigation`, `Footer`, HelpBot, `LaunchBanner`, and
the future bottom bar all honour it. App release starts passing the flag.

Ship web first; the old CSS injection keeps working during the transition, so
there is no coordinated-release requirement. Old app versions keep working
indefinitely on the injection path.

### Phase 2 — `MobileTabBar`

New `src/components/nav/MobileTabBar.tsx`, mounted in
`src/components/ClientLayout.tsx` alongside the existing nav.

- `fixed bottom-0`, `h-14`, `padding-bottom: env(safe-area-inset-bottom)`
- active state from `usePathname`
- gated on auth + allowlist + embedded flag
- hamburger stays for now

Reversible by deleting one mount — good prototype checkpoint for a device test.

### Phase 3 — Menu sheet

Port the drawer's 22 links into a bottom sheet using the app's sections
(Getting Started, Grading, Tools, Pricing & Plans, Information, Account).
Include the workspace switcher for org members. Remove the hamburger on small
screens once at parity.

### Phase 4 — padding and polish

Global `pb-14` on app routes so the bar never covers content — check the
collection grid's last row and any sticky action buttons. Optionally add
`manifest.json` (**the site has none today**) to make it installable, which
pairs naturally with an app shell.

---

## Gotchas to plan around

- **iOS Safari** overlays a bottom URL bar that shrinks the viewport as it hides
  on scroll. Use `100dvh` (never `100vh`) plus the safe-area inset, and test on
  a real iPhone rather than a simulator.
- **`/upload`** is the most vertical-space-hungry screen and ends in a CTA near
  the bottom. Consider excluding it from the bar, or auto-hiding on scroll.
- **Card detail pages** are both WebView targets and heavy mobile-web routes —
  the page most likely to end up double-chromed if Phase 1 slips.
- **No SEO risk.** Nav is client-rendered; page content is unchanged.

---

## Open questions — resolved Aug 17

1. **Phase 1 vs prototype first → do both in one motion.** The web side of the
   embedded contract is small and doesn't wait on an app release; the tab bar
   prototype builds against it immediately. The old CSS injection keeps old app
   versions working, so nothing is release-coupled.
2. **`/upload` keeps the tab bar.** Consistency beats vanishing chrome, and the
   native app shows tabs on its own Grade tab. Add auto-hide-on-scroll-down
   only if real-device testing shows it crowding the submit CTA.
3. **Six-tab set stays at app parity** (Grade, Collection, Labels, Portfolio,
   InstaList, Menu; Labels → Enterprise Page in org scope). Credits does not
   need a tab — it lives in the header pill, same as the app. Shop stays in
   Menu. Revisit only if the Phase 0 nav analytics say otherwise.
4. **PWA/manifest: skip.** The store apps are strategically load-bearing
   (iOS IAP compliance, camera flow, OTA channel); making the website
   installable invites users onto the worse path. Revisit only if app-store
   friction becomes a measured acquisition problem.

## Effort (updated)

| Phase | Size |
|---|---|
| 0 — quick wins | ~½ day |
| 1 — embedded contract | small on web, needs an app release |
| 2 — tab bar | ~1 day + real-iPhone test |
| 3 — menu sheet | the real work, ~2–3 days (22 links across auth + org states) |
| 4 — polish | small |

## Key files

| Purpose | Path |
|---|---|
| App tab bar (reference IA) | `dcm-mobile/app/(tabs)/_layout.tsx` |
| App header (reference) | `dcm-mobile/components/AppHeaderBar.tsx` |
| App menu sections | `dcm-mobile/app/(tabs)/account.tsx` |
| WebView chrome injection | `dcm-mobile/components/ui/InAppPage.tsx` |
| Web nav + drawer | `src/app/ui/Navigation.tsx` |
| Mount point | `src/components/ClientLayout.tsx` |
| Org scope signal | `src/contexts/OrgContext.tsx` |
