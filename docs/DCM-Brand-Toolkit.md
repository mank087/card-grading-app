# DCM Grading Brand Toolkit

## Brand Overview

**Brand Name:** DCM Grading
**Tagline:** AI-Powered Trading Card Grading
**Website:** https://www.dcmgrading.com
**Technology Name:** DCM Optic™

---

## Logo

### Logo Files
| File | Usage |
|------|-------|
| `DCM-logo.png` | Primary logo for light backgrounds |
| `DCM Logo white.png` | White logo for dark/colored backgrounds |

### Logo URLs (for emails/external use)
- **Dark logo:** `https://www.dcmgrading.com/DCM-logo.png`
- **White logo:** `https://www.dcmgrading.com/DCM%20Logo%20white.png`

### Logo Usage Guidelines
- Minimum clear space: Equal to the height of the "D" in DCM
- Do not stretch, rotate, or alter the logo colors
- Use white logo on dark backgrounds (purple, dark gray)
- Use dark logo on light/white backgrounds

---

## Color Palette

### Primary Brand Color
| Name | Hex | RGB | Tailwind | Usage |
|------|-----|-----|----------|-------|
| **DCM Purple** | `#7c3aed` | rgb(124, 58, 237) | `purple-600` | Primary buttons, links, accents |
| DCM Purple (Hover) | `#6d28d9` | rgb(109, 40, 217) | `purple-700` | Button hover states |
| DCM Purple (Light) | `#ede9fe` | rgb(237, 233, 254) | `purple-100` | Light backgrounds |
| DCM Purple (Pale) | `#f5f3ff` | rgb(245, 243, 255) | `purple-50` | Hover backgrounds |

### Secondary Colors
| Name | Hex | RGB | Tailwind | Usage |
|------|-----|-----|----------|-------|
| **Blue** | `#3b82f6` | rgb(59, 130, 246) | `blue-500` | Basic tier, informational |
| Blue Light | `#eff6ff` | rgb(239, 246, 255) | `blue-50` | Blue backgrounds |
| **Amber/Gold** | `#f59e0b` | rgb(245, 158, 11) | `amber-500` | Founders, Elite tier, special offers |
| Amber Dark | `#d97706` | rgb(217, 119, 6) | `amber-600` | Amber text on light backgrounds |
| Amber Light | `#fef3c7` | rgb(254, 243, 199) | `amber-100` | Founders section background |
| **Emerald Green** | `#059669` | rgb(5, 150, 105) | `emerald-600` | Success states, bonus credits |
| Green Light | `#d1fae5` | rgb(209, 250, 229) | `green-100` | Success backgrounds |

### Semantic Colors
| Name | Hex | RGB | Tailwind | Usage |
|------|-----|-----|----------|-------|
| **Success** | `#10b981` | rgb(16, 185, 129) | `emerald-500` | Success messages |
| **Error** | `#dc2626` | rgb(220, 38, 38) | `red-600` | Errors, low credits warning |
| **Warning** | `#f59e0b` | rgb(245, 158, 11) | `amber-500` | Warnings, urgent notices |

### Neutral Colors (Grays)
| Name | Hex | RGB | Tailwind | Usage |
|------|-----|-----|----------|-------|
| White | `#ffffff` | rgb(255, 255, 255) | `white` | Backgrounds, cards |
| Gray 50 | `#f9fafb` | rgb(249, 250, 251) | `gray-50` | Page background |
| Gray 100 | `#f3f4f6` | rgb(243, 244, 246) | `gray-100` | Footer, email background |
| Gray 200 | `#e5e7eb` | rgb(229, 231, 235) | `gray-200` | Borders, dividers |
| Gray 400 | `#9ca3af` | rgb(156, 163, 175) | `gray-400` | Muted text, placeholders |
| Gray 500 | `#6b7280` | rgb(107, 114, 128) | `gray-500` | Secondary text |
| Gray 600 | `#4b5563` | rgb(75, 85, 99) | `gray-600` | Body text |
| Gray 700 | `#374151` | rgb(55, 65, 81) | `gray-700` | Body text (darker) |
| Gray 800 | `#1f2937` | rgb(31, 41, 55) | `gray-800` | Headings |
| Gray 900 | `#111827` | rgb(17, 24, 39) | `gray-900` | Dark backgrounds |

---

## Typography

### Font Families
| Font | Usage | Fallback |
|------|-------|----------|
| **Geist Sans** | Primary typeface for UI | Arial, Helvetica, sans-serif |
| **Geist Mono** | Code, serial numbers | monospace |
| **Noto Sans JP** | Japanese language support | sans-serif |

### Font Weights
- **Regular (400):** Body text
- **Medium (500):** Emphasized text, subheadings
- **Semibold (600):** Buttons, navigation
- **Bold (700):** Headings, important text

### Text Sizes (Desktop)
| Element | Size | Weight |
|---------|------|--------|
| H1 | 24px | Bold (700) |
| H2 | 20px / 22px | Bold (700) |
| H3 | 18px | Semibold (600) |
| Body | 15px / 16px | Regular (400) |
| Small | 13px / 14px | Regular (400) |
| Caption | 11px / 12px | Regular (400) |

---

## Pricing Tier Colors

Each pricing tier has its own color identity:

| Tier | Primary Color | Gradient | Hex |
|------|--------------|----------|-----|
| **Basic** | Blue | `from-blue-500 to-blue-600` | `#3b82f6` → `#2563eb` |
| **Pro** | Purple | `from-purple-600 to-indigo-600` | `#7c3aed` → `#4f46e5` |
| **Elite** | Amber | `from-amber-500 to-orange-600` | `#f59e0b` → `#ea580c` |
| **Founders** | Gold | Solid amber with border | `#f59e0b` border, `#fef3c7` bg |

---

## Special Effects

### Founders Shimmer Animation
A signature animated gradient text effect used for the "Founders" link:

```css
.founders-shimmer {
  background: linear-gradient(90deg,
    #f59e0b 0%,
    #fbbf24 25%,
    #fef3c7 50%,
    #fbbf24 75%,
    #f59e0b 100%
  );
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Button Styles

### Primary Button (CTA)
- Background: `#7c3aed` (purple-600)
- Hover: `#6d28d9` (purple-700)
- Text: White
- Padding: 14px 28px (or 16px 40px for large)
- Border radius: 8px
- Font weight: 600 (semibold)
- Shadow: subtle drop shadow

### Secondary Button (Outline)
- Background: Transparent
- Border: 2px solid `#7c3aed`
- Text: `#7c3aed`
- Hover: Light purple background

### Founders/Special Button
- Background: `#f59e0b` (amber-500)
- Text: `#1f2937` (gray-800, dark)
- Font weight: 700 (bold)

---

## Email Design

### Email Header
- Background: `#7c3aed` (purple-600)
- Logo: White version
- Text: White with `#e9d5ff` (purple-200) for subtitles

### Email Footer
- Background: `#f3f4f6` (gray-100)
- Text: `#6b7280` (gray-500) / `#9ca3af` (gray-400)
- Links: `#7c3aed` (purple-600)

---

## Social Media

| Platform | URL |
|----------|-----|
| Facebook | https://www.facebook.com/dcmgrading |
| Instagram | https://www.instagram.com/dcm_grading/ |
| X (Twitter) | https://x.com/DCM_Grading |

---

## Contact Information

- **Email:** admin@dcmgrading.com
- **Website:** https://www.dcmgrading.com

---

## Brand Assets Summary

### Image Assets Available
| Asset | Path | Description |
|-------|------|-------------|
| DCM Logo (Dark) | `/DCM-logo.png` | Primary logo |
| DCM Logo (White) | `/DCM Logo white.png` | For dark backgrounds |
| Label Example | `/DCM-Label-Mag-OneTouch.png` | Mag/one-touch label example |
| Full Report | `/DCM-full-downloadable-report.png` | PDF report example |
| Foldable Report | `/2.5x3.5-foldable-report.png` | Compact report format |

### Sample Card Images
| Card | URL |
|------|-----|
| Rapunzel (Lorcana) | `https://www.dcmgrading.com/DCM-Card-Rapunzel---High-Climber-710817-front.jpg` |
| Shohei Ohtani (Sports) | `https://www.dcmgrading.com/DCM-Card-Shohei-Ohtani-496896-front.jpg` |
| Mega Lucario EX (Pokemon) | `https://www.dcmgrading.com/DCM-Card-Mega-Lucario-EX-930288-front.jpg` |

---

## UTM Parameters (for tracking)

Standard UTM structure for marketing campaigns:
```
?utm_source=[source]&utm_medium=[medium]&utm_campaign=[campaign]&utm_content=[content]
```

Example:
```
?utm_source=emailoctopus&utm_medium=email&utm_campaign=free-user-followup&utm_content=main-cta
```

---

*Last updated: January 2026*
