# Homepage Scrolling Card Background - Update Guide

**Last Updated:** 2025-11-17
**Status:** ✅ Live in Production
**Component:** `src/app/ui/ScrollingCardBackground.tsx`

---

## 📊 Current Implementation

The homepage hero section features a **3-row parallax scrolling card background** with:
- ✅ 30 card images automatically fetched from your database (public cards)
- ✅ 40% opacity + 2px blur for text readability
- ✅ GPU-accelerated CSS animations (60fps performance)
- ✅ Infinite seamless loop
- ✅ Different scroll speeds per row (parallax effect)

**Current Behavior:**
The component queries your `cards` table and pulls the first 30 public cards with `front_url` images.

---

## 🎨 How to Use Custom Card Images

When you're ready to replace the database placeholders with your chosen card images, follow these steps:

### **Option 1: Static Image Files** (Recommended for Final Images)

#### Step 1: Prepare Your Images

1. **Collect 30 card images** (front images only)
2. **Optimize images for web:**
   - Recommended size: 200-250px width
   - Format: WebP or JPG (for smaller file size)
   - Compression: 70-80% quality (they'll be blurred anyway)
3. **Name them systematically:**
   ```
   card-01.jpg
   card-02.jpg
   card-03.jpg
   ...
   card-30.jpg
   ```

#### Step 2: Add Images to Project

Create the folder and add your images:
```bash
mkdir public/cards/background
# Copy your 30 card images into this folder
```

#### Step 3: Update the Component

**File:** `src/app/ui/ScrollingCardBackground.tsx`

Replace the entire component with this static version:

```tsx
"use client";

import Image from "next/image";

interface ScrollingCardBackgroundProps {
  opacity?: number; // 0-100, default 40
  blur?: number; // px, default 2
  speed?: number; // multiplier, default 1
}

export default function ScrollingCardBackground({
  opacity = 40,
  blur = 2,
  speed = 1
}: ScrollingCardBackgroundProps) {
  // Static array of card images (replace with your actual filenames)
  const cardImages = [
    "/cards/background/card-01.jpg",
    "/cards/background/card-02.jpg",
    "/cards/background/card-03.jpg",
    "/cards/background/card-04.jpg",
    "/cards/background/card-05.jpg",
    "/cards/background/card-06.jpg",
    "/cards/background/card-07.jpg",
    "/cards/background/card-08.jpg",
    "/cards/background/card-09.jpg",
    "/cards/background/card-10.jpg",
    "/cards/background/card-11.jpg",
    "/cards/background/card-12.jpg",
    "/cards/background/card-13.jpg",
    "/cards/background/card-14.jpg",
    "/cards/background/card-15.jpg",
    "/cards/background/card-16.jpg",
    "/cards/background/card-17.jpg",
    "/cards/background/card-18.jpg",
    "/cards/background/card-19.jpg",
    "/cards/background/card-20.jpg",
    "/cards/background/card-21.jpg",
    "/cards/background/card-22.jpg",
    "/cards/background/card-23.jpg",
    "/cards/background/card-24.jpg",
    "/cards/background/card-25.jpg",
    "/cards/background/card-26.jpg",
    "/cards/background/card-27.jpg",
    "/cards/background/card-28.jpg",
    "/cards/background/card-29.jpg",
    "/cards/background/card-30.jpg"
  ];

  // Distribute cards across 3 rows
  const row1Cards = cardImages.slice(0, 10);
  const row2Cards = cardImages.slice(10, 20);
  const row3Cards = cardImages.slice(20, 30);

  // Duplicate arrays for seamless infinite scroll
  const row1Double = [...row1Cards, ...row1Cards];
  const row2Double = [...row2Cards, ...row2Cards];
  const row3Double = [...row3Cards, ...row3Cards];

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        opacity: opacity / 100,
        filter: `blur(${blur}px)`
      }}
    >
      {/* Row 1 - Scrolling Right */}
      <div className="scroll-row scroll-right" style={{ animationDuration: `${20 / speed}s` }}>
        {row1Double.map((url, index) => (
          <div key={`row1-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={200}
              height={280}
              className="rounded-lg shadow-lg object-cover"
              loading={index < 5 ? "eager" : "lazy"}
              priority={index < 5}
            />
          </div>
        ))}
      </div>

      {/* Row 2 - Scrolling Left */}
      <div className="scroll-row scroll-left" style={{ animationDuration: `${25 / speed}s` }}>
        {row2Double.map((url, index) => (
          <div key={`row2-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={200}
              height={280}
              className="rounded-lg shadow-lg object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* Row 3 - Scrolling Right */}
      <div className="scroll-row scroll-right" style={{ animationDuration: `${30 / speed}s` }}>
        {row3Double.map((url, index) => (
          <div key={`row3-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={200}
              height={280}
              className="rounded-lg shadow-lg object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        .scroll-row {
          display: flex;
          gap: 1.5rem;
          position: absolute;
          width: max-content;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .scroll-row:nth-child(1) {
          top: 5%;
        }

        .scroll-row:nth-child(2) {
          top: 40%;
        }

        .scroll-row:nth-child(3) {
          top: 75%;
        }

        .card-item {
          flex-shrink: 0;
          width: 200px;
          height: 280px;
        }

        @keyframes scroll-right {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes scroll-left {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }

        .scroll-right {
          animation-name: scroll-right;
          left: 0;
        }

        .scroll-left {
          animation-name: scroll-left;
          right: 0;
        }

        /* Pause on hover for accessibility */
        .scroll-row:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
```

---

### **Option 2: Keep Database-Based** (Dynamic)

If you want the background to automatically update with your latest graded cards:

**Keep the current implementation** - No changes needed!

**Customize which cards appear:**
```tsx
// In ScrollingCardBackground.tsx, modify the query:
const { data, error } = await supabase
  .from('cards')
  .select('front_url')
  .eq('visibility', 'public')
  .eq('category', 'Pokemon')  // Only Pokemon cards
  .gte('dcm_grade_whole', 9)  // Only high-grade cards
  .order('created_at', { ascending: false })  // Newest first
  .limit(30);
```

---

## ⚙️ Customization Options

### Adjust Visual Settings

**In `src/app/page.tsx`**, modify the component props:

```tsx
<ScrollingCardBackground
  opacity={40}  // 0-100 (lower = more transparent, higher = more visible)
  blur={2}      // pixels (higher = more blurred)
  speed={1}     // multiplier (higher = faster scroll, 2 = 2x speed)
/>
```

**Examples:**
```tsx
// More visible, less blurred
<ScrollingCardBackground opacity={60} blur={1} speed={1} />

// Subtle background
<ScrollingCardBackground opacity={25} blur={3} speed={0.7} />

// Fast-moving, dramatic effect
<ScrollingCardBackground opacity={50} blur={2} speed={2} />
```

### Change Scroll Directions

**In `ScrollingCardBackground.tsx`**, modify animation durations and directions:

```tsx
// Make Row 2 scroll right instead of left
<div className="scroll-row scroll-right" style={{ animationDuration: `${25 / speed}s` }}>

// Speed up Row 1
<div className="scroll-row scroll-right" style={{ animationDuration: `${10 / speed}s` }}>

// Slow down Row 3
<div className="scroll-row scroll-right" style={{ animationDuration: `${40 / speed}s` }}>
```

### Adjust Row Positioning

```tsx
// In the <style jsx> section, change vertical positions:
.scroll-row:nth-child(1) {
  top: 10%;  // Move row 1 down
}

.scroll-row:nth-child(2) {
  top: 50%;  // Center row 2
}

.scroll-row:nth-child(3) {
  top: 85%;  // Move row 3 closer to bottom
}
```

### Change Number of Rows

Add a 4th row:
```tsx
const row4Cards = cardImages.slice(30, 40);
const row4Double = [...row4Cards, ...row4Cards];

// Add after Row 3:
<div className="scroll-row scroll-left" style={{ animationDuration: `${35 / speed}s` }}>
  {row4Double.map((url, index) => (
    <div key={`row4-${index}`} className="card-item">
      <Image src={url} alt="" width={200} height={280} className="rounded-lg shadow-lg object-cover" loading="lazy" />
    </div>
  ))}
</div>

// Add CSS:
.scroll-row:nth-child(4) {
  top: 90%;
}
```

---

## 🎨 Image Optimization Tips

**For Best Performance:**

1. **Use WebP format** (smaller file size):
   ```bash
   # Convert JPG to WebP (requires webp tools)
   cwebp -q 80 card-01.jpg -o card-01.webp
   ```

2. **Resize to optimal dimensions**:
   - Width: 200-250px (component displays at 200px)
   - Height: Auto (maintains aspect ratio)
   - No need for high resolution (blurred background)

3. **Compress images**:
   - 70-80% quality is fine (they're blurred anyway)
   - Tools: TinyPNG, ImageOptim, Squoosh

4. **Expected file sizes**:
   - Target: 15-30KB per image
   - Total: ~450-900KB for all 30 images

---

## 📝 Testing Checklist

After making changes:

- [ ] Images load correctly (no 404 errors)
- [ ] Smooth scrolling performance (60fps)
- [ ] Text remains readable over background
- [ ] Mobile responsive (test on phone)
- [ ] No layout shifts on load
- [ ] Infinite loop is seamless (no visible restart)

---

## 🚀 Deployment

After updating the component:

```bash
# Test locally
npm run dev

# Commit and push
git add src/app/ui/ScrollingCardBackground.tsx
git add public/cards/background/  # if using static images
git commit -m "Update homepage scrolling background with custom card images"
git push origin master
```

Vercel will auto-deploy in 2-3 minutes.

---

## 🔧 Troubleshooting

**Images not showing:**
- Check file paths are correct
- Ensure images are in `/public/cards/background/`
- Verify image filenames match the array

**Scrolling is choppy:**
- Reduce image file sizes
- Lower the `speed` prop
- Ensure images are optimized

**Text is hard to read:**
- Increase `blur` value (more blur)
- Decrease `opacity` value (more transparent)
- Adjust gradient overlay in `page.tsx`

**Want to disable background temporarily:**
- Comment out the component in `src/app/page.tsx`:
  ```tsx
  {/* <ScrollingCardBackground opacity={40} blur={2} speed={1} /> */}
  ```

---

## 📂 Related Files

- **Component:** `src/app/ui/ScrollingCardBackground.tsx`
- **Homepage:** `src/app/page.tsx`
- **Images:** `/public/cards/background/` (if using static)
- **Database:** `cards` table (if using dynamic)

---

**Questions or issues?** Update this document as you customize the background!
