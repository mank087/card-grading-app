# DCM Grading Mobile App — Implementation Plan

**Status**: Planning
**Last updated**: 2026-04-23
**Owner**: Doug Mankiewicz

---

## Overview

Build a React Native (Expo) mobile app that replicates the full DCM Grading web application for iOS and Android from a single codebase. The existing Supabase + Vercel backend stays unchanged — only the frontend is new.

---

## Approach: React Native with Expo

- Single codebase for iOS + Android
- Reuse existing TypeScript, Supabase Auth, Stripe, and API logic
- Expo handles builds, signing, and store submissions
- Expo Router for file-based navigation (familiar from Next.js)
- No backend changes needed — mobile app calls the same Vercel API routes

---

## Features to Port

| Feature | Web | Mobile |
|---|---|---|
| Auth (login, register, Google OAuth) | Supabase Auth | Supabase Auth SDK for React Native |
| Card grading (upload photos, receive grade) | Camera + file upload | Native camera with scanner improvements |
| Collection management | Grid view, filters | Native list/grid with pull-to-refresh |
| Card detail pages | Full grade breakdown | Same layout, swipe between cards |
| Label Studio | Canvas-based label generation | React Native canvas libraries |
| Reports & Labels (PDF download) | jsPDF in browser | Share sheet for PDF export |
| Market Pricing | eBay/DCM price lookups | Same API calls |
| Pop Report | Category browsing | Same data, native navigation |
| Stripe payments (credits, subscriptions) | Stripe Checkout redirect | Stripe SDK for mobile OR web checkout |
| Blog | CMS-rendered pages | WebView or native rendering |
| Account management | Settings page | Native settings screen |
| Push notifications | None | Firebase Cloud Messaging (new) |

---

## Architecture

```
┌─────────────────────────────────┐
│     React Native / Expo App     │
│  (iOS + Android from one code)  │
├─────────────────────────────────┤
│  Expo Router (file-based nav)   │
│  React Native components        │
│  Supabase JS SDK (auth + DB)    │
│  Stripe React Native SDK        │
│  Expo Camera (card photos)      │
│  Expo Notifications (push)      │
├─────────────────────────────────┤
│     Existing Backend            │
│  (No changes needed)            │
│  Supabase (PostgreSQL + Auth)   │
│  Vercel API routes              │
│  Stripe                         │
│  OpenAI GPT-5.1                 │
└─────────────────────────────────┘
```

---

## Phased Build Plan

### Phase 1: Foundation (Weeks 1-2)
- Set up Expo project with Expo Router
- Configure Supabase auth (login, register, Google OAuth, session persistence)
- Navigation structure: Tab bar (Grade, Collection, Shop, Account) + stack navigators
- Design system: port color palette, typography, component library
- API client layer: shared fetch wrapper for Vercel API routes

### Phase 2: Core Grading (Weeks 3-4)
- Camera capture with Expo Camera, guide overlay, flash, front/back toggle
- Image compression (port from web imageCompression.ts)
- Upload to Supabase Storage + trigger grading API + progress UI
- Grading results screen with animated grade reveal, subgrades, defects
- Credit system: balance display, purchase flow

### Phase 3: Collection & Details (Weeks 5-6)
- Collection grid (FlatList with thumbnails, grades, filters, search)
- Card detail screen (full breakdown, images, zoom, swipe between cards)
- Public collections
- Pop Report (category list, drill-down)
- Featured cards

### Phase 4: Labels, Pricing & Content (Weeks 7-8)
- Label Studio (canvas rendering, preview, download/share)
- Market Pricing (eBay + DCM lookups)
- Blog (WebView or native markdown)
- FAQ, About, Rubric (static content)
- Shop (affiliate product cards)

### Phase 5: Polish & Platform Features (Weeks 9-10)
- Push notifications (grade complete, promotions, credit reminders)
- Offline support (cache collection, view grades offline)
- Deep linking (dcmgrading.com URLs open in app)
- App icon, splash screen (DCM branding)
- Haptic feedback (grade reveal, capture)

### Phase 6: Store Submission (Weeks 11-12)
- Apple Developer enrollment + app listing + screenshots
- Google Play enrollment + app listing + screenshots
- TestFlight beta (iOS) + Google Play beta (Android)
- App Store Review prep (privacy policy, data declarations)
- Submit for review + launch

---

## Costs

### One-Time
| Item | Cost |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Developer | $25 one-time |
| **Total to start** | **$124** |

### Ongoing
| Item | Monthly |
|---|---|
| Apple Developer | ~$8.25/mo ($99/yr) |
| Google Play | $0 (one-time fee) |
| Expo EAS Build | $0 (free tier: 30 builds/mo) |
| Push notifications (Firebase) | $0 (free tier) |
| Existing infrastructure | No change |

### Platform Revenue Share
| Platform | Commission |
|---|---|
| Apple App Store | 15% (<$1M annual, Small Business Program) |
| Google Play | 15% (first $1M) |
| Stripe (web checkout) | 2.9% + $0.30 |

**Strategy**: Sell credits via web checkout (Stripe, 2.9%) rather than in-app purchase (15-30%) where possible.

---

## What Claude Code Can Build
- Entire React Native / Expo codebase
- All screens, navigation, components
- Supabase auth integration
- Camera capture with guide overlays
- API integration with existing backend
- Label generation
- Push notification setup
- Store listing metadata
- Build configuration (EAS Build, app signing)

## What Requires Manual Action
- Apple Developer and Google Play account creation (identity + payment)
- Physical device testing
- Store screenshots
- Store submission clicks
- Apple/Google review responses
- Payment strategy decision (IAP vs web checkout)
