# DCM Mobile App — Complete Feature Implementation Plan

**Based on comprehensive audit of dcmgrading.com web app**
**Last updated**: 2026-04-23

---

## Current State (Phase 1 — Complete)

Auth (login/register), tab navigation, basic collection list, basic card detail, shop page, account page shell, credits context, API client.

---

## Phase 2: Card Detail Pages (Full Parity)

The card detail page is the core of the app — users spend the most time here. Must match the web experience exactly.

### 2.1 Card Images Section
- Front/back card images with pinch-to-zoom (use `react-native-image-zoom-viewer` or `react-native-reanimated` gesture handler)
- Tap to open full-screen image modal with pan/zoom
- Image loading states with shimmer placeholders
- Error handling with retry

### 2.2 Graded Slab/Label Preview
- Modern front label component (matches `ModernFrontLabel.tsx`)
- Modern back label component (matches `ModernBackLabel.tsx`)
- Slab wrapper with custom color overrides (from user's label style preference)
- Card image composited inside slab frame
- Label style dropdown (Modern, Traditional, Custom styles)
- Front/back toggle for label view

### 2.3 Grade Display
- Overall DCM grade (large, color-coded badge)
- Condition label (Gem Mint, Mint, Near Mint, etc.)
- Grade uncertainty display (±X)
- Image confidence badge (A/B/C/D)
- Prompt version display (v8.6)

### 2.4 Subgrade Breakdown
- Centering score with animated bar
- Corners score with animated bar
- Edges score with animated bar
- Surface score with animated bar
- Limiting factor indicator (which subgrade capped the grade)
- Front vs. back weight display (55/45)

### 2.5 Centering Ratios
- Front L/R percentage
- Front T/B percentage
- Back L/R percentage
- Back T/B percentage
- Quality tier labels (Perfect, Excellent, Good, Fair, Off-Center)

### 2.6 Defect Details
- Front summary (3-4 sentence AI analysis)
- Back summary (3-4 sentence AI analysis)
- Collapsible detailed defect sections:
  - Corners (per-corner condition with severity)
  - Edges (per-edge condition)
  - Surface (scratches, creases, print defects, stains)
- Defect severity badges (none/minor/moderate/heavy)

### 2.7 Professional Grade Estimates
- Collapsible section
- PSA estimated grade + confidence
- BGS estimated grade + confidence
- SGC estimated grade + confidence
- CGC estimated grade + confidence
- Notes per grading company

### 2.8 Market Pricing
- eBay price section:
  - Lowest, median, highest, average prices
  - Listing count
  - Last updated timestamp
  - "Refresh Prices" button
  - Link to eBay search (opens browser)
  - Link to eBay sold listings (opens browser)
- DCM price estimate (for sports cards via SportsCardsPro)
- Price history chart (if Card Lovers subscriber)
- Card Lovers gate for premium pricing features
- API routes: `GET /api/ebay/cached-price`, `POST /api/ebay/prices`, `GET /api/pricing/dcm-cached-price`

### 2.9 Reports & Labels Downloads
- Download options (share sheet on mobile):
  - Full grading report (PDF)
  - Slab label (PDF, duplex or fold-over)
  - Avery 6871 label (for one-touch holders)
  - Avery 8167 label (front+back for top loaders)
  - Fold-over label
  - Card images (front slab, back slab)
  - Mini report (JPG)
- Download triggers share sheet (save to files, share to social, print)
- Founder/VIP/Card Lovers emblems on labels based on user status
- Label style preference applied

### 2.10 eBay Insta-List
- "List on eBay" button
- Full eBay listing modal (bottom sheet on mobile):
  - Auto-populated title from card data
  - Condition mapping (grade → eBay condition)
  - Price suggestion
  - Description template
  - Photo selection (front/back/slab images)
  - Category selection
  - Duration, shipping options
  - Submit to eBay API
- Requires eBay account connection (opens browser for OAuth)

### 2.11 Card Actions
- Visibility toggle (public/private) with confirmation
- Re-grade button (with credit check + deduction)
- Edit card details (name, set, number, year)
- Edit card label (custom label text overrides)
- Delete card (with confirmation)
- Share card (native share sheet: copy link, social media)

### 2.12 Slab Detection Display
- If professional slab detected (PSA/BGS/SGC/CGC):
  - Show detected company, grade, cert number
  - Professional subgrades if visible
  - Visual badge

### 2.13 Evaluation Details
- Grading timestamp
- Prompt version (v8.6)
- Processing time
- Three-pass consistency data (if available)

**API Routes needed:**
- `GET /api/{category}/{id}` — all 8 category routes
- `PATCH /api/cards/{id}/visibility`
- `DELETE /api/cards/{id}`
- `PUT /api/cards/{id}/custom-label`
- `POST /api/ebay/prices`
- `GET /api/ebay/cached-price`
- `GET /api/pricing/dcm-cached-price`
- `POST /api/pricing/dcm-save`
- `GET /api/founders/status`
- `GET /api/user/label-style`
- `GET /api/user/label-emblem-preference`

---

## Phase 3: Collection Page (Full Parity)

### 3.1 Collection Grid/List View
- Toggle between grid (card thumbnails) and list (rows with details)
- Persistent view preference
- Pull-to-refresh
- Infinite scroll or "load more" pagination

### 3.2 Filters & Search
- Search bar (card name, serial, player)
- Category filter pills (All, Sports, Pokemon, MTG, etc.)
- Sort by: grade (high/low), date (new/old), name (A-Z), price
- Sort direction toggle

### 3.3 Collection Stats
- Total cards count
- Cards by category breakdown
- Average grade
- Grade distribution (mini chart)
- Total estimated value (if Card Lovers)

### 3.4 Batch Operations
- Multi-select mode (long-press to enter, checkboxes)
- Batch delete (with confirmation)
- Batch download labels (share sheet)
- Batch price refresh

### 3.5 Share Collection
- Set username for public profile
- Share collection link (native share sheet)
- View public collection URL

### 3.6 Price Refresh
- Refresh all prices button
- Progress indicator during refresh
- Batch eBay price refresh

**API Routes:**
- `GET /api/cards/my-collection?search=...`
- `DELETE /api/cards/{id}`
- `POST /api/ebay/batch-refresh-prices`
- `GET /api/profile/username`
- `POST /api/profile/username`

---

## Phase 4: Upload & Grading Flow

### 4.1 Category Selection
- Full-screen category picker matching web design
- Sports, Pokemon, MTG, Lorcana, One Piece, Yu-Gi-Oh, Other
- Color-coded category cards with icons
- Credit balance displayed

### 4.2 Camera Capture
- Native camera with Expo Camera:
  - Rear camera with flash toggle
  - Guide overlay (card aspect ratio frame with corner markers)
  - Front/Back side indicator
  - Portrait/Landscape orientation toggle
  - Photo tips button (opens tip sheet)
  - Capture button (large, centered)
  - Gallery picker fallback
- Image compression before upload (port `imageCompression.ts`)
- Image quality check (blur + brightness from `imageQuality.ts`)
- Quality score display with retake option
- Auto-crop to guide frame

### 4.3 Condition Report
- Optional condition hints form:
  - Corner condition picker
  - Edge condition picker
  - Surface condition picker
  - Centering assessment
  - Free-text notes
  - "No defects observed" checkbox
- 3-step wizard matching web flow

### 4.4 Upload & Processing
- Upload front + back images to Supabase Storage
- Serial number generation via `/api/serial`
- Credit deduction via `/api/stripe/deduct`
- Trigger grading via `/api/{category}/{id}`
- Background processing monitor:
  - Grading queue status
  - Progress animation
  - Push notification when complete (Phase 7)
  - Real-time status polling

### 4.5 Results Screen
- Animated grade reveal (card flip + grade number animation)
- Haptic feedback on grade reveal
- Full grade summary
- "View Details" → card detail page
- "Grade Another" → back to category selection
- First grade congratulations modal

**API Routes:**
- `GET /api/serial`
- `POST /api/stripe/deduct`
- `POST /api/{category}/{id}` (all 8 categories)
- `GET /api/{category}/{id}` (polling for results)
- Supabase Storage upload

---

## Phase 5: Pricing, Subscriptions & Account

### 5.1 Credits Purchase
- Credit package display (Basic $2.99, Pro $9.99, Elite $19.99, VIP $99)
- Opens dcmgrading.com/credits in browser for Stripe checkout
- OR native Stripe SDK integration (if pursuing in-app purchase)
- Credit balance updates after purchase

### 5.2 Card Lovers Subscription
- Feature overview screen
- Monthly ($49.99/70 credits) and Annual ($449/900 credits) options
- Opens dcmgrading.com/card-lovers for subscription
- Subscription status display in account
- Gated features indicator throughout app

### 5.3 VIP Package
- Feature overview screen
- Opens dcmgrading.com/vip for purchase

### 5.4 Account Settings (Full)
- User stats dashboard (total cards, avg grade, distribution)
- Email display
- Username management (set/change)
- Password change
- Founder/VIP/Card Lovers status badges
- Subscription management (cancel, resume, upgrade)
- Label style preference
- Emblem preferences (which badges to show on labels)
- Delete account (with confirmation flow)
- Sign out

**API Routes:**
- `GET/POST /api/profile/username`
- `POST /api/account/password`
- `POST /api/account/delete`
- `GET /api/founders/status`
- `GET /api/subscription/status`
- `GET/POST /api/user/label-style`
- `GET/POST /api/user/label-emblem-preference`
- `POST /api/stripe/cancel-subscription`
- `POST /api/stripe/resume-subscription`

---

## Phase 6: Label Studio, Market Pricing & Content

### 6.1 Label Studio
- Card selector (search collection)
- Label gallery (slab, one-touch, toploader, fold-over, card images)
- Live preview of selected label type
- Custom label designer:
  - Dimension presets
  - Color theme picker
  - Custom gradient colors
  - Border controls
  - Text editing (name, set, number, year, features)
  - Front/back toggle
- Download/share labels via share sheet
- Batch label generation
- Saved custom styles (up to 4)
- Amazon affiliate link to slabs

### 6.2 Market Pricing Dashboard (Card Lovers)
- Portfolio overview (total value, category breakdown)
- Top cards by value
- Price history charts
- Refresh prices
- Category filtering
- Card Lovers subscription gate

### 6.3 Content Pages (WebView or native)
- Blog (list + detail)
- FAQ (accordion)
- About Us
- Why DCM
- Grading Rubric
- Reports & Labels info
- Grading Limitations
- Terms & Conditions
- Privacy Policy
- Card Shows

### 6.4 Pop Report
- Category list with card counts
- Drill-down by category → cards with grade distribution
- Search within category
- Pagination

### 6.5 Featured Cards
- Curated card gallery
- Tap to view card detail

### 6.6 Card Databases
- Pokemon database browser
- MTG database browser
- Lorcana, One Piece, Yu-Gi-Oh, Star Wars databases
- Search by name, set, number
- Set browsing

### 6.7 Search
- Search by serial number
- Search results with card previews
- Tap to view detail

---

## Phase 7: Platform Features

### 7.1 Push Notifications (Firebase Cloud Messaging)
- Grading complete notification
- Credit low reminder
- Promotional notifications
- New feature announcements

### 7.2 Deep Linking
- `dcmgrading.com/pokemon/{id}` opens card in app
- `dcmgrading.com/collection/{username}` opens collection
- Universal links (iOS) + App Links (Android)

### 7.3 Offline Support
- Cache collection data for offline viewing
- Queue uploads for when back online
- Cached card detail pages (last viewed)

### 7.4 App Branding
- Custom app icon (DCM logo)
- Splash screen (DCM branded)
- App name: "DCM Grading"

### 7.5 Haptic Feedback
- Grade reveal
- Capture confirmation
- Button presses
- Pull-to-refresh completion

### 7.6 Native Share
- Share card details (native share sheet)
- Share collection link
- Share grading results to social media

---

## Phase 8: Store Submission

### 8.1 App Store (iOS)
- Apple Developer enrollment ($99/yr)
- App listing: title, description, keywords, screenshots
- Privacy policy URL (dcmgrading.com/privacy)
- App Review guidelines compliance
- TestFlight beta testing
- Submit for review

### 8.2 Google Play (Android)
- Google Play Console enrollment ($25 one-time)
- App listing: title, description, screenshots
- Content rating questionnaire
- Data safety declarations
- Internal testing track
- Submit for review

---

## Implementation Priority Order

| Priority | Phase | What | Effort |
|----------|-------|------|--------|
| 1 | 2 | Card Detail Pages (full parity) | Large |
| 2 | 4 | Upload & Grading Flow (camera + process) | Large |
| 3 | 3 | Collection Page (full parity) | Medium |
| 4 | 5 | Pricing, Subscriptions & Account | Medium |
| 5 | 6 | Label Studio, Market Pricing, Content | Large |
| 6 | 7 | Push Notifications, Deep Linking, Offline | Medium |
| 7 | 8 | Store Submission | Small |

**Estimated total: 10-14 weeks of development**

---

## Key Architecture Decisions

### API Strategy
All API calls go to the existing Vercel backend (dcmgrading.com/api/...). No backend changes needed. The mobile app is a new frontend client using the same API contract.

### Payment Strategy
For credits and subscriptions, open the web checkout in the phone's browser (Linking.openURL). This avoids Apple/Google's 15-30% in-app purchase commission. The app consumes credits but doesn't sell them directly.

### Label Generation
Port the canvas-based label generators to React Native. Use `react-native-skia` or `expo-print` for PDF generation, or render labels server-side and download.

### Content Pages
Static content pages (FAQ, About, Terms, etc.) can use WebView initially for fastest parity, then convert to native screens over time.

### Image Handling
Use `expo-image` (optimized image component) for card images. Implement progressive loading with blur placeholder → full resolution. Cache aggressively.

### Category-Specific Detail Pages
The web app has 8 separate CardDetailClient files (one per category). On mobile, use ONE unified CardDetailScreen that adapts based on category — the data structure is the same, only minor UI differences (Pokemon types, MTG colors, etc.).
