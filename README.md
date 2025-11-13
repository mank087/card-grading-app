# Card Grading Application

AI-powered sports card and collectible card grading system using GPT-4o Vision.

**Current Version:** v3.8 ENHANCED (Conversational AI + Weakest Link Scoring)
**Last Updated:** October 28, 2025

---

## 🎯 Overview

This application provides automated grading for sports cards, trading cards, and collectibles using OpenAI's GPT-4o Vision model. The system analyzes card images and provides professional-grade condition assessments on a 1.0-10.0 scale.

### Key Features

- **AI-Powered Grading**: Single-stage conversational AI grading using GPT-4o Vision
- **v3.8 Weakest Link Scoring**: Final grade determined by lowest weighted category score
- **Detailed Analysis**: Sub-scores for centering, corners, edges, and surface
- **Professional Estimates**: Maps to PSA, BGS, SGC, and CGC grading scales
- **Case Detection**: Identifies protective holders (one-touch, magnetic, top-loader, slab)
- **Slab Recognition**: Detects and compares professional grading slab information
- **Multi-Card Support**: Sports cards, Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece

---

## 🏗️ Architecture

### Grading System

**Primary System:** Conversational AI v3.5 PATCHED v2 (single-stage)

```
Image Upload → Conversational AI Grading → Markdown Parsing → JSON Extraction → Database Storage → Frontend Display
```

- **Input**: Front and back card images (Supabase Storage)
- **Processing**: Single GPT-4o Vision API call with detailed prompt
- **Output**: Comprehensive markdown report with grades, observations, and metadata
- **Scoring**: v3.8 Weakest Link (final grade = minimum of weighted category scores)

### Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (card images)
- **AI**: OpenAI GPT-4o Vision API
- **Authentication**: Supabase Auth

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key

### Environment Variables

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations (see migrations/ directory)
# Apply in Supabase SQL Editor

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 📂 Project Structure

```
card-grading-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   └── vision-grade/[id]/  # Main grading endpoint
│   │   ├── sports/[id]/        # Card detail pages
│   │   ├── collection/         # User collection
│   │   └── upload/             # Card upload
│   ├── lib/                    # Core libraries
│   │   ├── visionGrader.ts     # Grading functions
│   │   ├── conversationalParserV3_5.ts  # Primary parser
│   │   ├── conversationalParserV3.ts    # Legacy parser (fallback)
│   │   └── supabaseServer.ts   # Supabase client
│   └── types/                  # TypeScript types
│       └── card.ts             # Card interface
├── prompts/                    # AI prompts
│   └── conversational_grading_v3_5_PATCHED.txt  # Main grading prompt (v3.8)
├── migrations/                 # Database migrations
│   └── add_v3_8_weakest_link_fields.sql  # v3.8 schema
├── SYSTEM_ARCHITECTURE_CURRENT.md  # Complete system documentation
└── QUICK_START_2025-10-28.md      # Quick reference guide
```

---

## 📊 Grading System

### v3.8 Weakest Link Scoring

The final grade is determined by the **minimum** of the four weighted category scores (not the average):

```
Final Grade = MIN(Centering, Corners, Edges, Surface)

Where each category = (Front × 55%) + (Back × 45%)
```

**Example:**
- Centering: 9.5 (weighted)
- Corners: 9.0 (weighted) ← **Limiting Factor**
- Edges: 9.0 (weighted)
- Surface: 9.5 (weighted)

**Final Grade: 9.0** (determined by corners, the lowest weighted score)

### Grading Scale (DCM Master Scale)

| Grade | Condition | Description |
|-------|-----------|-------------|
| 10.0 | Gem Mint (GM) | Perfect card |
| 9.5 | Mint+ (M+) | Near-perfect |
| 9.0 | Mint (M) | Minimal flaws |
| 8.5 | Near Mint+ (NM+) | Very minor wear |
| 8.0 | Near Mint (NM) | Light wear |
| 7.5 | Near Mint- (NM-) | Noticeable wear |
| 7.0 | Excellent+ (EX+) | Moderate wear |
| 6.5 | Excellent (EX) | Visible wear |
| 6.0 | Excellent- (EX-) | Significant wear |
| 5.0-1.0 | Very Good to Poor | Heavy wear/damage |

---

## 🔧 API Usage

### Grade a Card

```http
GET /api/vision-grade/{card_id}?force_regrade=false
```

**Response:**
```json
{
  "id": "card-uuid",
  "card_name": "Player Name 2023 Prizm Silver",
  "conversational_decimal_grade": 9.0,
  "conversational_whole_grade": 9,
  "conversational_condition_label": "Mint (M)",
  "conversational_image_confidence": "A",
  "conversational_sub_scores": {
    "centering": { "front": 10.0, "back": 9.0, "weighted": 9.5 },
    "corners": { "front": 9.0, "back": 9.0, "weighted": 9.0 },
    "edges": { "front": 9.0, "back": 9.0, "weighted": 9.0 },
    "surface": { "front": 10.0, "back": 9.0, "weighted": 9.5 }
  },
  "conversational_weighted_sub_scores": {
    "centering": 9.5,
    "corners": 9.0,
    "edges": 9.0,
    "surface": 9.5
  },
  "conversational_limiting_factor": "corners",
  "conversational_preliminary_grade": 9.0,
  "estimated_professional_grades": {
    "psa": { "grade": 9, "range": "9" },
    "bgs": { "grade": 9.0, "subgrades": {...} },
    "sgc": { "grade": 9, "range": "9" },
    "cgc": { "grade": 9.0, "range": "9.0" }
  }
}
```

---

## 📚 Documentation

- **[SYSTEM_ARCHITECTURE_CURRENT.md](./SYSTEM_ARCHITECTURE_CURRENT.md)** - Complete system architecture and data flow
- **[QUICK_START_2025-10-28.md](./QUICK_START_2025-10-28.md)** - Quick reference for development
- **[SESSION_SUMMARY_2025-10-28.md](./SESSION_SUMMARY_2025-10-28.md)** - Latest implementation details
- **[V3_8_IMPLEMENTATION_COMPLETE.md](./V3_8_IMPLEMENTATION_COMPLETE.md)** - v3.8 weakest link scoring guide

---

## 🗃️ Database

Uses Supabase (PostgreSQL) with the following key tables:

- `cards` - Card information and grading results
- `users` - User accounts (Supabase Auth)

### Key Card Fields

| Field | Type | Description |
|-------|------|-------------|
| `conversational_grading` | TEXT | Full markdown report |
| `conversational_decimal_grade` | NUMERIC | Final grade (1.0-10.0) |
| `conversational_sub_scores` | JSONB | Front/back/weighted scores |
| `conversational_weighted_sub_scores` | JSONB | v3.8 weighted scores |
| `conversational_limiting_factor` | TEXT | v3.8 limiting factor |
| `conversational_case_detection` | JSONB | Protective holder info |
| `estimated_professional_grades` | JSONB | PSA/BGS/SGC/CGC estimates |

See [migrations/](./migrations/) for complete schema.

---

## 🧪 Testing

```bash
# Run development server
npm run dev

# Grade a test card
# 1. Upload images via /upload
# 2. View card at /sports/{id}
# 3. Click "Grade Card" button
# 4. Check console logs for grading output
```

### Test Checklist

- [ ] Upload new card images
- [ ] Grade card (first time - no cache)
- [ ] Verify all fields populated
- [ ] Check limiting factor highlighting
- [ ] Test cached card retrieval
- [ ] Test with slabbed card
- [ ] Test with card in protective case

---

## 🚧 Known Issues

### Supabase Image Download Timeouts (HIGH PRIORITY)
- **Issue**: Intermittent 400 errors when OpenAI tries to download images from Supabase
- **Impact**: Blocks grading for some cards
- **Workaround**: Retry grading or check Supabase bucket settings

### Database Save Failures (MEDIUM PRIORITY)
- **Issue**: Intermittent fetch errors when saving grading results
- **Impact**: Grading completes but doesn't save to database
- **Workaround**: Regrade with `force_regrade=true`

---

## 🔮 Roadmap

### Short Term
- Fix Supabase timeout issues
- Add retry logic for image downloads
- Improve error handling

### Medium Term
- Analytics dashboard (limiting factor distribution)
- Bulk re-grade tool
- Historical comparison (v3.7 vs v3.8)

### Long Term
- Mobile app
- API for third-party integrations
- Multi-language support

---

## 📄 License

Proprietary - All rights reserved

---

## 🤝 Contributing

This is a private project. For issues or feature requests, contact the project maintainer.

---

## 📞 Support

For technical issues, see:
- [SYSTEM_ARCHITECTURE_CURRENT.md](./SYSTEM_ARCHITECTURE_CURRENT.md) - System documentation
- [QUICK_START_2025-10-28.md](./QUICK_START_2025-10-28.md) - Quick troubleshooting

---

**Built with ❤️ using Next.js, TypeScript, and OpenAI GPT-4o Vision**
# Force rebuild with environment variables
