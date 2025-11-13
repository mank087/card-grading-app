# Working System Files - Complete List
**Date**: October 21, 2025

---

## 📋 AI INSTRUCTIONS

### **Sports Card Grading (Main - Active)**
```
C:\Users\benja\card-grading-app\sports_assistant_instructions.txt
```
- Main grading instructions for sports cards
- Contains all 6 tasks (detection, identification, centering, defects, calculation, output)
- Updated with detailed inspection protocol (October 21, 2025)

### **Vision Grading Prompts (Active - Used by DVG v1/v2)**
```
C:\Users\benja\card-grading-app\prompts\card_grader_v1 - backup before simplification.txt
```
- Main comprehensive grading prompt for DVG v1
- Used in `visionGrader.ts` line 402

```
C:\Users\benja\card-grading-app\prompts\professional_grading_v1.txt
```
- Professional grading estimation prompt
- Used in `visionGrader.ts` line 422

```
C:\Users\benja\card-grading-app\prompts\detailed_inspection_v1.txt
```
- Detailed inspection prompt for DVG v2
- Used in `visionGrader.ts` line 442

```
C:\Users\benja\card-grading-app\prompts\conversational_grading_v1.txt
```
- Conversational grading analysis prompt
- Used in `visionGrader.ts` line 1208
- Generates the conversational AI analysis section

### **Other Card Types**
```
C:\Users\benja\card-grading-app\pokemon_assistant_instructions_master.txt
C:\Users\benja\card-grading-app\yugioh_assistant_instructions.txt
C:\Users\benja\card-grading-app\magic_assistant_instructions.txt
C:\Users\benja\card-grading-app\lorcana_assistant_instructions.txt
C:\Users\benja\card-grading-app\onepiece_assistant_instructions.txt
C:\Users\benja\card-grading-app\other_assistant_instructions.txt
```

---

## 🎨 FRONTEND FILES

### **Main Pages**

#### **Home/Upload Page**
```
C:\Users\benja\card-grading-app\src\app\page.tsx
```
- Landing page
- Card upload interface

#### **Upload Page**
```
C:\Users\benja\card-grading-app\src\app\upload\page.tsx
```
- Card upload form
- Front/back image selection
- Card type selection

#### **Collection Page**
```
C:\Users\benja\card-grading-app\src\app\collection\page.tsx
```
- List/Grid view toggle
- Sortable columns (name, manufacturer, series, year, grade, date, visibility)
- Professional PSA-style labels
- Dynamic text sizing
- Purple View Details buttons
- Search functionality

#### **Card Detail Page (Sports)**
```
C:\Users\benja\card-grading-app\src\app\sports\[id]\CardDetailClient.tsx
```
- Sports card details display
- Image zoom modal
- Conversational AI grading display (with mini tables)
- Professional grading sections
- DVG v1 grading display
- QR code generation
- Social sharing
- eBay integration
- Delete/Re-grade functionality
- Visibility toggle (public/private)

#### **Login Page**
```
C:\Users\benja\card-grading-app\src\app\login\page.tsx
```
- User authentication

---

### **Components**

#### **Image Zoom Modal**
```
C:\Users\benja\card-grading-app\src\app\sports\[id]\ImageZoomModal.tsx
```
- Full-screen image zoom
- Magnifier on hover (desktop)
- Pinch-to-zoom support (mobile)
- Updated size: 70vw x 70vh (October 21, 2025)

#### **Grade Badge Component**
```
C:\Users\benja\card-grading-app\src\app\ui\GradeBadge.tsx
```
- Visual grade display (10.0 = Gem Mint, 9.0 = Mint, etc.)
- Color-coded badges

---

### **Layout & Globals**

#### **Root Layout**
```
C:\Users\benja\card-grading-app\src\app\layout.tsx
```
- App-wide layout wrapper
- Metadata configuration

#### **Global Styles**
```
C:\Users\benja\card-grading-app\src\app\globals.css
```
- Tailwind CSS styles
- Custom CSS variables

---

## 🔌 API ROUTES

### **Sports Card Grading API**
```
C:\Users\benja\card-grading-app\src\app\api\sports\[id]\route.ts
```
- Main sports card grading endpoint
- OpenAI Assistant integration
- Image upload to Supabase
- Card data storage
- DVG v1 grading system
- Conversational AI grading

### **Vision Grading API**
```
C:\Users\benja\card-grading-app\src\app\api\vision-grade\[id]\route.ts
```
- Vision-based grading endpoint
- DVG v2 system
- Conversational grading generation
- Cached grading results

### **Card API (General)**
```
C:\Users\benja\card-grading-app\src\app\api\card\[id]\route.ts
```
- General card operations
- Pokemon/Yu-Gi-Oh/Magic/etc. cards

---

## 🗄️ DATABASE & SCHEMA

### **SQL Schema Files**
```
C:\Users\benja\card-grading-app\add_card_boundaries_column.sql
C:\Users\benja\card-grading-app\add_dvg_v1_fields.sql
C:\Users\benja\card-grading-app\add_enhanced_card_fields.sql
C:\Users\benja\card-grading-app\add_multi_evaluation_system.sql
C:\Users\benja\card-grading-app\add_autographed_column.sql
C:\Users\benja\card-grading-app\add_ebay_url_column.sql
C:\Users\benja\card-grading-app\add_tcgplayer_url_column.sql
C:\Users\benja\card-grading-app\add_user_email_column.sql
C:\Users\benja\card-grading-app\database_schema_v3_1_complete.sql
C:\Users\benja\card-grading-app\market_price_database_migration.sql
C:\Users\benja\card-grading-app\pokemon_database_migration.sql
```

### **Visibility Schema**
```
C:\Users\benja\card-grading-app\add_card_visibility.sql
C:\Users\benja\card-grading-app\change_default_visibility_to_public.sql
```

---

## 🛠️ UTILITY/LIBRARY FILES

### **Social Sharing Utils**
```
C:\Users\benja\card-grading-app\src\lib\socialUtils.ts
```
- Facebook, Twitter, Instagram sharing
- URL copying
- Social share utilities

### **eBay Integration Utils**
```
C:\Users\benja\card-grading-app\src\lib\ebayUtils.ts
```
- eBay search URL generation
- Sold listings URL generation

### **Vision Grader**
```
C:\Users\benja\card-grading-app\src\lib\visionGrader.ts
```
- Vision-based grading logic
- DVG v2 integration

---

## ⚙️ CONFIGURATION FILES

### **Next.js Config**
```
C:\Users\benja\card-grading-app\next.config.ts
```
- Next.js 15 configuration
- Turbopack enabled
- Image domains (Supabase)

### **TypeScript Config**
```
C:\Users\benja\card-grading-app\tsconfig.json
```
- TypeScript compiler options
- Path aliases

### **Tailwind Config**
```
C:\Users\benja\card-grading-app\tailwind.config.ts
```
- Tailwind CSS configuration
- Custom colors/spacing

### **ESLint Config**
```
C:\Users\benja\card-grading-app\eslint.config.mjs
```
- ESLint rules

### **PostCSS Config**
```
C:\Users\benja\card-grading-app\postcss.config.mjs
```
- PostCSS plugins (Tailwind)

---

## 📦 PACKAGE FILES

### **Package Configuration**
```
C:\Users\benja\card-grading-app\package.json
```
- Dependencies
- Scripts (dev, build, start)

### **Package Lock**
```
C:\Users\benja\card-grading-app\package-lock.json
```
- Dependency tree lock

---

## 🔐 ENVIRONMENT FILES

### **Environment Variables**
```
C:\Users\benja\card-grading-app\.env.local
```
- OpenAI API key
- Supabase credentials
- Assistant IDs
- **NOTE**: This file is gitignored (not in version control)

---

## 🤖 ASSISTANT UPDATE SCRIPTS

### **Main Update Script**
```
C:\Users\benja\card-grading-app\update_assistant.js
```
- Updates sports assistant instructions
- Assistant ID: asst_gwX2wmsnNsMOqsZqcnypUmlg

### **Other Update Scripts**
```
C:\Users\benja\card-grading-app\update_assistants_v3_1.js
C:\Users\benja\card-grading-app\create_single_stage_assistant.js
C:\Users\benja\card-grading-app\check_assistant.js
C:\Users\benja\card-grading-app\check_both_assistants.js
```

---

## 🖼️ PUBLIC ASSETS

### **Logos & Images**
```
C:\Users\benja\card-grading-app\public\DCM-logo.png
C:\Users\benja\card-grading-app\public\file.svg
C:\Users\benja\card-grading-app\public\globe.svg
C:\Users\benja\card-grading-app\public\next.svg
C:\Users\benja\card-grading-app\public\vercel.svg
C:\Users\benja\card-grading-app\public\window.svg
```

### **Favicon**
```
C:\Users\benja\card-grading-app\src\app\favicon.ico
```

---

## 📊 LABEL GENERATION

### **Label Generator Service**
```
C:\Users\benja\card-grading-app\label_generator_service\
```
- Professional label PDF generation
- Avery 6871 template support

---

## 📚 DOCUMENTATION FILES

### **Recent Updates**
```
C:\Users\benja\card-grading-app\AI_DETAILED_INSPECTION_UPDATE.md
C:\Users\benja\card-grading-app\CONVERSATIONAL_AI_FORMAT_FIX_V2.md
C:\Users\benja\card-grading-app\CONVERSATIONAL_AI_FORMAT_UPDATE.md
C:\Users\benja\card-grading-app\CONVERSATIONAL_SECTION_HEADER_FIX.md
C:\Users\benja\card-grading-app\COLLECTION_SORTING_FEATURE.md
C:\Users\benja\card-grading-app\DEFAULT_PUBLIC_UPDATE.md
C:\Users\benja\card-grading-app\CONVERSATIONAL_GRADING_UI_IMPROVEMENT.md
```

### **Setup Guides**
```
C:\Users\benja\card-grading-app\QUICK_START.md
C:\Users\benja\card-grading-app\DATABASE_SETUP_INSTRUCTIONS.md
C:\Users\benja\card-grading-app\DVG_V1_SETUP_GUIDE.md
```

### **System Architecture**
```
C:\Users\benja\card-grading-app\SYSTEM_ARCHITECTURE_FOR_REVIEW.md
C:\Users\benja\card-grading-app\COMPREHENSIVE_GRADING_SCALE.md
```

---

## 🎯 KEY WORKING FILES SUMMARY

### **Core Grading System**
1. `sports_assistant_instructions.txt` - AI grading logic
2. `src/app/api/sports/[id]/route.ts` - Sports grading API
3. `src/app/api/vision-grade/[id]/route.ts` - Vision grading API

### **Main Frontend**
1. `src/app/collection/page.tsx` - Collection view
2. `src/app/sports/[id]/CardDetailClient.tsx` - Card details
3. `src/app/sports/[id]/ImageZoomModal.tsx` - Image zoom
4. `src/app/upload/page.tsx` - Upload interface

### **Configuration**
1. `next.config.ts` - Next.js config
2. `package.json` - Dependencies
3. `.env.local` - Environment variables

### **Database**
1. `database_schema_v3_1_complete.sql` - Complete schema
2. `add_card_visibility.sql` - Visibility feature
3. `add_dvg_v1_fields.sql` - DVG v1 fields

---

## 📁 FOLDER STRUCTURE

```
card-grading-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sports/[id]/route.ts          ← Sports grading API
│   │   │   ├── vision-grade/[id]/route.ts    ← Vision grading API
│   │   │   └── card/[id]/route.ts            ← General card API
│   │   ├── collection/page.tsx               ← Collection page
│   │   ├── sports/[id]/
│   │   │   ├── CardDetailClient.tsx          ← Card details
│   │   │   └── ImageZoomModal.tsx            ← Zoom modal
│   │   ├── upload/page.tsx                   ← Upload page
│   │   ├── login/page.tsx                    ← Login page
│   │   ├── ui/GradeBadge.tsx                 ← Grade badge
│   │   ├── layout.tsx                        ← Root layout
│   │   ├── page.tsx                          ← Home page
│   │   ├── globals.css                       ← Global styles
│   │   └── favicon.ico                       ← Favicon
│   └── lib/
│       ├── socialUtils.ts                    ← Social sharing
│       ├── ebayUtils.ts                      ← eBay integration
│       └── visionGrader.ts                   ← Vision grader
├── public/
│   └── DCM-logo.png                          ← Logo
├── sports_assistant_instructions.txt         ← AI instructions
├── update_assistant.js                       ← Assistant updater
├── next.config.ts                            ← Next.js config
├── package.json                              ← Dependencies
├── tsconfig.json                             ← TypeScript config
├── tailwind.config.ts                        ← Tailwind config
└── .env.local                                ← Environment vars
```

---

**Total Working Files**: ~50+ active system files
**Last Updated**: October 21, 2025
**System Status**: ✅ Fully Operational
