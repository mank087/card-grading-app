/**
 * Seed Blog Posts Script
 * Run with: npx ts-node scripts/seed-blog-posts.ts
 *
 * This script creates draft blog posts directly in the database.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BlogPost {
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  content: string;
  category_slug: string;
  tags: string[];
  meta_title: string;
  meta_description: string;
}

const blogPosts: BlogPost[] = [
  {
    title: "Sports Card Grading 101: What Every Collector Needs to Know",
    subtitle: "From rookie cards to vintage finds, learn how condition impacts value",
    slug: "sports-card-grading-101-guide",
    excerpt: "Whether you're holding a 1952 Topps Mickey Mantle or a 2020 Prizm Joe Burrow rookie, understanding card grading is essential. Learn what graders look for and how to assess your sports cards.",
    category_slug: "grading-guides",
    tags: ["sports cards", "grading", "beginners", "football", "baseball", "basketball"],
    meta_title: "Sports Card Grading Guide | How to Grade Football, Baseball & Basketball Cards",
    meta_description: "Complete guide to sports card grading. Learn what PSA, BGS, and SGC look for when grading football, baseball, and basketball cards. Assess your cards at home with DCM.",
    content: `## Understanding Sports Card Grading

The sports card market has exploded in recent years, with record-breaking sales making headlines regularly. A PSA 10 2003 LeBron James Topps Chrome rookie sold for over $1.8 million. A Mickey Mantle 1952 Topps reached $12.6 million. But what separates a million-dollar card from a hundred-dollar card of the same player?

**Condition. It's all about condition.**

## The Four Pillars of Card Grading

Every major grading company evaluates cards based on four primary criteria:

### 1. Centering

Centering measures how well the card's image is positioned within its borders. Perfect centering means equal borders on all sides.

**Grading Standards:**
- **Gem Mint (10):** 50/50 or 55/45 centering
- **Mint (9):** 55/45 to 60/40 centering
- **Near Mint-Mint (8):** 65/35 centering acceptable
- **Below 8:** Increasingly off-center

Sports cards, especially vintage ones, often have centering issues due to printing technology of the era. A 1986 Fleer Michael Jordan with 70/30 centering might grade a 7 even with perfect corners.

### 2. Corners

Corners are often the first area to show wear on sports cards. Graders examine all four corners under magnification looking for:

- **Sharp corners:** Crisp, pointed edges (Gem Mint)
- **Slight rounding:** Barely perceptible wear (Mint)
- **Fuzzy corners:** Visible softening (NM-MT to NM)
- **Dinged corners:** Obvious damage (EX and below)

**Pro tip:** Check corners against a dark background to spot subtle whitening.

### 3. Edges

The edges of your card tell the story of how it's been handled. Look for:

- Edge whitening (chipping of the color layer)
- Rough cuts from manufacturing
- Dings from stacking or storage
- Separation of card layers

Vintage cards often have rougher cuts than modern cards, and graders account for era-appropriate standards.

### 4. Surface

Surface condition encompasses everything on the face and back of the card:

- **Scratches:** Especially visible on foil/chrome cards
- **Print defects:** Spots, lines, or missing ink
- **Staining:** Water damage, age spots
- **Creases:** Any bending of the card
- **Wax stains:** Common on vintage cards from pack wax

Chrome and Prizm cards are notoriously difficult to find scratch-free, even straight from the pack.

## Era-Specific Considerations

### Vintage Cards (Pre-1980)

Vintage sports cards face unique challenges:

- **Wax stains** from pack packaging
- **Gum stains** from included bubble gum
- **Paper quality** was lower, making them more susceptible to damage
- **Centering** was often poor due to printing limitations

Graders use era-appropriate standards, meaning a 1955 Topps Roberto Clemente isn't held to the same centering standards as a 2023 Topps card.

### Junk Wax Era (1987-1994)

The overproduction era created billions of cards, but condition remains king:

- Many were poorly stored
- Common to find off-center examples
- High-grade examples of key rookies (Griffey, Jordan, etc.) still command premiums

### Modern Era (1995-Present)

Today's cards present different challenges:

- **Print runs** are more controlled
- **Quality control** is higher
- **Surface scratches** on chrome/foil are the biggest issue
- **Pack fresh** doesn't always mean Gem Mint

## Using DCM for Sports Card Grading

Before spending $20-150 per card on professional grading, use DCM to:

1. **Pre-screen your submissions** - Identify which cards have Gem Mint potential
2. **Document condition** - Get detailed analysis for insurance or sales
3. **Price accurately** - Know what grade to expect for accurate pricing
4. **Sort efficiently** - Quickly assess large collections

### What DCM Analyzes on Sports Cards

Our AI examines your sports cards for:

- Precise centering measurements (front and back)
- Corner sharpness at all four points
- Edge condition and whitening
- Surface scratches, print defects, and creases
- Overall grade prediction with confidence level

## Tips for Better Grades

1. **Handle with care** - Always hold cards by edges, use clean hands
2. **Proper storage** - Penny sleeves + top loaders minimum
3. **Climate control** - Avoid humidity and temperature extremes
4. **Buy graded when possible** - For high-value cards, the premium is worth it
5. **Pre-screen before submitting** - Use DCM to avoid wasting grading fees

## The Investment Perspective

Understanding grading is crucial for collectors who view cards as investments:

| Grade | Typical Value Multiple |
|-------|----------------------|
| PSA 10 | 3-10x PSA 9 value |
| PSA 9 | 2-3x PSA 8 value |
| PSA 8 | Base market value |
| PSA 7 | 50-70% of PSA 8 |
| Below 7 | Significantly reduced |

A single grade point can mean thousands of dollars on key cards.

## Start Grading Today

Ready to evaluate your sports card collection? DCM gives you instant, accurate condition analysis so you can make informed decisions about your cards.

Whether you're deciding which cards to submit for professional grading or just curious about your collection's condition, DCM provides the insights you need in under two minutes.

---

**Grade your first sports card free** - [Sign up now](/login?mode=signup) and see exactly what your cards are worth.`
  },
  {
    title: "Understanding Card Market Values: A Collector's Guide to Pricing",
    subtitle: "How to research prices, spot trends, and value your collection accurately",
    slug: "understanding-card-market-values-pricing-guide",
    excerpt: "Card values fluctuate based on player performance, market trends, and condition. Learn how to research accurate prices and understand what drives the trading card market.",
    category_slug: "market-insights",
    tags: ["market", "pricing", "investing", "values", "ebay", "trends"],
    meta_title: "Trading Card Price Guide | How to Value Your Card Collection",
    meta_description: "Learn how to accurately price trading cards. Understand market trends, research sold listings, and discover what factors drive card values up or down.",
    content: `## The Art and Science of Card Valuation

"What's my card worth?" It's the most common question in collecting, and the answer is rarely simple. Card values are dynamic, influenced by everything from a player's Sunday performance to broader economic conditions.

Let's break down how to accurately value your cards.

## Where to Research Card Prices

### eBay Sold Listings (The Gold Standard)

eBay's completed sales data is the most reliable pricing source:

1. Search for your card (be specific: year, brand, card number)
2. Filter by "Sold Items"
3. Look at the last 30-90 days of sales
4. **Ignore outliers** - Both high and low
5. Find the median price for your card's condition

**Why sold listings matter:** Asking prices mean nothing. Only completed sales show what buyers actually pay.

### Price Guides and Databases

- **PSA Price Guide** - Based on APR (Average Price Realized)
- **Beckett** - Traditional hobby standard
- **Card Ladder** - Tracks population and sales data
- **130 Point** - Aggregates eBay sales data

**Caveat:** Database prices often lag the market by weeks or months.

### Auction Houses

For high-end cards, check recent auction results:

- Heritage Auctions
- PWCC
- Goldin
- Lelands

These set the market for premium cards but don't reflect typical collector transactions.

## Factors That Influence Card Value

### 1. Player Performance

Nothing moves card prices like on-field/on-court performance:

- **Rookie seasons** - Breakout performances spike prices
- **Championships** - Winning titles boosts all cards
- **MVP/Awards** - Major awards create demand surges
- **Injuries** - Can temporarily (or permanently) suppress values
- **Retirement** - Often stabilizes prices

**Example:** Patrick Mahomes' rookie cards 10x'd after his first Super Bowl win.

### 2. Condition (Grade)

We covered this in depth, but remember:

| Raw Card Condition | Approximate Value vs. Graded |
|-------------------|------------------------------|
| Pack fresh | 40-60% of PSA 10 |
| Light wear | 20-30% of PSA 10 |
| Moderate wear | 10-15% of PSA 10 |
| Heavy wear | 5% or less of PSA 10 |

**The grading premium is real.** A raw card valued at $100 might be worth $400+ in a PSA 10 slab.

### 3. Scarcity and Print Runs

Supply matters enormously:

- **Base cards** - Highest print runs, lowest values
- **Parallels** - Numbered cards command premiums
- **1/1s** - Unique cards with collector-set prices
- **Short prints** - Intentionally limited production

Modern cards often list print runs directly: "/99" means 99 copies exist.

### 4. Historical Significance

Certain cards transcend normal valuation:

- First cards (1952 Topps pioneered modern cards)
- Rookie cards of all-time greats
- Error cards with documented mistakes
- Cards featuring iconic moments

### 5. Market Sentiment

The broader market affects all cards:

- **Economic conditions** - Recessions suppress luxury spending
- **Media attention** - Documentaries, news coverage drive interest
- **Generational nostalgia** - As collectors age, their childhood cards rise
- **New collector influx** - 2020-2021 saw massive new interest

## Common Pricing Mistakes

### 1. Using Asking Prices

That card listed for $500? Means nothing until it sells. Always check **sold** listings.

### 2. Ignoring Condition

Your raw card isn't worth PSA 10 prices. Be honest about condition.

### 3. Overvaluing Commons

Most cards, even of great players, are worth $1-5. Not every card is valuable.

### 4. Cherry-Picking Comps

Don't find one high sale and assume that's the value. Look at median prices across multiple sales.

### 5. Forgetting Fees

When selling, remember:
- eBay: 13.25% final value fee
- PayPal/payments: 2.9% + $0.30
- Shipping: $4-5 minimum

A $100 sale nets you roughly $80.

## Building Value in Your Collection

### Buy Smart

- **Grade matters more than quantity**
- **Key rookies** hold value better than commons
- **Condition is king** - A few nice cards beat many damaged ones
- **Buy what you love** - Passion protects against market swings

### Sell Smart

- **Time your sales** - Sell during hot streaks
- **Grade first** - High-value raw cards often benefit from grading
- **Quality photos** - Good listings get better prices
- **Accurate descriptions** - Build buyer trust

## DCM's Role in Valuation

DCM helps you understand value by:

1. **Accurate condition assessment** - Know your card's true grade
2. **eBay integration** - See recent sold prices for similar condition
3. **Instant analysis** - Quick decisions on large collections
4. **Pre-screening** - Identify which cards deserve professional grading investment

### Example Workflow

1. Photograph your card with DCM
2. Receive condition grade (e.g., "Near Mint - likely PSA 8")
3. Check eBay sold listings for that card in PSA 8
4. Now you have an accurate value range

## Price Trends to Watch in 2024

- **Vintage is stabilizing** after 2021 peaks
- **Modern rookies** are highly volatile
- **Soccer/international** cards growing in US market
- **Women's sports** cards gaining collector interest
- **Basketball** remains the strongest market segment

## The Bottom Line

Card values aren't fixed - they're a constantly moving target influenced by countless factors. The best collectors:

1. Research thoroughly before buying or selling
2. Understand condition's impact on value
3. Follow market trends without panic-selling
4. Focus on cards they genuinely enjoy
5. Use tools like DCM to make informed decisions

---

**Know your collection's value** - [Start grading with DCM](/login?mode=signup) and get accurate condition assessments that help you price your cards correctly.`
  },
  {
    title: "Photography Tips for Accurate Card Grading Results",
    subtitle: "Get the most accurate grades by capturing your cards correctly",
    slug: "photography-tips-accurate-card-grading",
    excerpt: "The quality of your card photos directly impacts grading accuracy. Learn professional techniques for photographing trading cards to get the most accurate condition assessment.",
    category_slug: "tips-tricks",
    tags: ["photography", "tips", "tutorials", "how-to", "camera", "lighting"],
    meta_title: "How to Photograph Trading Cards | Card Photography Tips for Grading",
    meta_description: "Learn how to photograph your trading cards for accurate grading. Professional tips on lighting, angles, backgrounds, and camera settings for the best results.",
    content: `## Why Photography Matters for Card Grading

When using DCM or listing cards for sale, your photos are everything. Poor images can:

- Lead to inaccurate grade assessments
- Miss surface defects or highlight non-existent ones
- Create glare that obscures card details
- Make cards appear off-center when they're not

Let's master card photography.

## Essential Equipment

### Camera Options (Best to Good)

1. **DSLR/Mirrorless camera** - Best quality, full control
2. **Modern smartphone** (iPhone 12+, Samsung S21+) - Excellent for most needs
3. **Older smartphone** - Acceptable with good lighting
4. **Webcam** - Last resort, often insufficient

**Good news:** A modern smartphone with proper technique beats a DSLR with poor technique.

### Lighting Setup

**Natural light** (free and effective):
- Position near a window with indirect sunlight
- Avoid direct sun (creates harsh shadows)
- Overcast days provide ideal diffused light
- Morning or late afternoon works best

**Artificial light** (consistent results):
- Two matching lights at 45-degree angles
- Diffused/softbox lights reduce glare
- LED panels offer affordable, cool operation
- Avoid mixing light temperatures

**What to avoid:**
- Direct flash (creates hotspots)
- Single overhead light (harsh shadows)
- Fluorescent office lighting (color cast)
- Dim conditions (grainy images)

### Backgrounds

**Best options:**
- Black felt or velvet (hides lint, absorbs light)
- Dark gray card stock (professional look)
- White background (clean, reveals edges clearly)

**Avoid:**
- Busy patterns
- Reflective surfaces
- Wood grain (competes with card details)
- Your hand or lap

## Camera Settings and Technique

### Smartphone Photography

1. **Clean your lens** - Fingerprints ruin photos
2. **Use the main camera** - Not ultra-wide or zoom
3. **Tap to focus** on the card center
4. **Lock exposure** - Prevents shifting brightness
5. **Use a timer or volume button** - Reduces shake
6. **Enable grid lines** - Helps with alignment

### DSLR/Mirrorless Settings

- **Aperture:** f/8 to f/11 (sharp corner to corner)
- **ISO:** As low as possible (100-400)
- **Shutter:** Use tripod, any speed works
- **Focus:** Manual focus for consistency
- **White balance:** Match your lighting

## Step-by-Step Photo Process

### 1. Setup Your Station

- Clean, flat surface
- Background material laid flat
- Lights positioned (or window light identified)
- Camera/phone mount ready (tripod ideal)
- Clean microfiber cloth nearby

### 2. Prepare the Card

- **Remove from sleeve** - Reflections ruin photos
- **Handle by edges only** - Avoid fingerprints
- **Gently clean if needed** - Microfiber, no liquids
- **Check for dust** - Blow off any particles

### 3. Position the Card

- Card flat against background
- Parallel to camera (not tilted)
- Centered in frame with margin around edges
- All four corners visible

### 4. Check Your Frame

Before shooting, verify:
- [ ] Card is straight (use grid lines)
- [ ] All corners visible in frame
- [ ] No shadows crossing the card
- [ ] No glare/hotspots visible
- [ ] Card fills 70-80% of frame

### 5. Take Multiple Photos

- Shoot 3-5 images of each side
- Slightly adjust angle between shots
- Review immediately and reshoot if needed
- Keep the best, delete the rest

## Dealing with Problem Cards

### Foil/Chrome Cards

These reflective surfaces are challenging:

- Use diffused lighting (essential)
- Try tent lighting (surround with white paper)
- Angle lights to avoid direct reflection
- Take multiple shots at different angles
- Accept that some glare may be unavoidable

### Vintage Cards

Older cards need special attention:

- Highlight wear accurately (don't hide it)
- Watch for wax stains (they photograph darker)
- Creases may need angled light to show
- Paper texture is normal, not damage

### Thick Cards (Relics/Autos)

Cards with memorabilia or raised surfaces:

- May need more distance
- Watch for shadows from raised elements
- Consider multiple focus points
- Relic windows often reflect - treat like foil

## Common Photography Mistakes

### 1. Card in Sleeve/Toploader

**Problem:** Plastic reflections, distortion, captured dirt
**Solution:** Always remove for photography

### 2. Overhead Lighting Only

**Problem:** Harsh shadows, uneven exposure
**Solution:** Add side lighting or use window light

### 3. Too Close

**Problem:** Lens distortion, focus issues
**Solution:** Back up and crop later if needed

### 4. Tilted Cards

**Problem:** Appears off-center, corners cut off
**Solution:** Use grid lines, position card carefully

### 5. Dirty Background

**Problem:** Dust and fibers distract, look unprofessional
**Solution:** Use lint roller on black felt, fresh paper

## Photo Checklist for DCM

For best DCM grading results:

**Image Quality:**
- [ ] Well-lit, even exposure
- [ ] Sharp focus throughout
- [ ] True-to-life colors
- [ ] Minimal noise/grain

**Card Presentation:**
- [ ] Card removed from sleeve
- [ ] All four corners visible
- [ ] Card parallel to camera
- [ ] Clean, plain background

**Technical:**
- [ ] Image at least 1000px on short side
- [ ] No heavy filters or editing
- [ ] Straight orientation (not rotated)

## Quick Reference: Lighting Setups

### Budget Setup ($0)
- Window with indirect sunlight
- White paper for fill
- Phone on stack of books

### Intermediate Setup ($50-100)
- Two LED panels
- Simple tripod
- Black velvet background

### Professional Setup ($200+)
- Softbox lights
- Copy stand or mount
- Multiple backgrounds
- Color calibration card

## The Impact of Good Photos

Better photos mean:

1. **More accurate DCM grades** - AI sees what's really there
2. **Faster sales** - Buyers trust clear photos
3. **Higher prices** - Quality presentation commands premium
4. **Fewer returns** - Accurate representation reduces disputes
5. **Better records** - Document your collection properly

---

**Ready to grade with confidence?** Great photos lead to accurate grades. [Upload your cards to DCM](/login?mode=signup) and get instant condition analysis.`
  },
  {
    title: "The Magic: The Gathering Grading Guide: From Alpha to Modern Sets",
    subtitle: "Special considerations for grading the world's first trading card game",
    slug: "mtg-magic-the-gathering-grading-guide",
    excerpt: "MTG cards have unique characteristics that affect grading. From Alpha's rounded corners to modern foiling issues, learn what makes Magic grading different from other TCGs.",
    category_slug: "card-spotlights",
    tags: ["mtg", "magic the gathering", "tcg", "grading", "alpha", "beta", "vintage"],
    meta_title: "MTG Card Grading Guide | How to Grade Magic: The Gathering Cards",
    meta_description: "Complete guide to grading Magic: The Gathering cards. Learn about Alpha corners, foil curling, print quality by set, and what makes MTG grading unique.",
    content: `## Magic: The Gathering - A Grading Perspective

Since 1993, Magic: The Gathering has captivated millions of players and collectors. As the first trading card game, MTG established many conventions - and presents unique grading challenges.

Whether you're holding a Black Lotus or a draft common, understanding MTG-specific grading considerations will help you evaluate your collection.

## MTG-Specific Grading Factors

### Card Stock Evolution

Magic's card stock has changed significantly over three decades:

**Early Era (1993-1996):**
- Thicker, more rigid stock
- Prone to chipping on edges
- Belgian and US print facilities
- Distinctive "cardboard" feel

**Middle Era (1997-2014):**
- Standardized card stock
- Improved cutting consistency
- Generally considered the "quality" era
- Cards hold up well to play

**Modern Era (2015-Present):**
- Thinner card stock
- More prone to curling (especially foils)
- Quality varies by print facility
- Collector boosters often higher quality than draft boosters

### Corner Considerations

#### Alpha Corners

Alpha (first print run) cards have **rounded corners** - a unique feature that both aids authentication and affects grading:

- Corners should be uniformly rounded
- Sharp corners on "Alpha" cards indicate fakes or re-cuts
- Slight corner wear is common on genuine Alpha
- Gem Mint Alpha is exceptionally rare

#### Beta and Later

Beta through current sets have standard squared corners:

- Grading follows typical TCG standards
- Manufacturing variations exist (especially older sets)
- Modern sets generally have sharper corners from factory

### Centering Challenges

MTG cards are notorious for centering issues:

**By Era:**
- **Alpha/Beta:** Often significantly off-center; 60/40 is excellent
- **Revised-Ice Age:** Improved but still variable
- **Mirage-Urza's:** Generally good centering
- **Modern:** Usually good, but print runs vary

**Border Considerations:**
- White-bordered cards show miscuts more obviously
- Black borders hide minor centering issues
- Borderless cards need perfect cutting

### The Foil Problem

MTG foils present major grading challenges:

**Curling (Pringles):**
- Modern foils curl severely
- Climate/humidity dependent
- Can improve with proper storage
- Grading companies have varying tolerance

**Surface Scratching:**
- Foil layer scratches easily
- Pack fresh doesn't mean scratch-free
- Examine at multiple angles
- Light scratches may grade 9, not 10

**Print Lines:**
- Horizontal lines across foil layer
- Manufacturing defect, not damage
- Very common on certain sets
- Usually limits grade to 9

**Clouding/Delamination:**
- Foil layer separating from card
- Irreversible damage
- Automatic grade reduction
- More common in humid climates

## Grading by Set Category

### Reserved List & Power Nine

The most valuable MTG cards require extra scrutiny:

**Black Lotus, Moxes, Time Walk, etc.:**
- Fakes are sophisticated and common
- Always authenticate before grading
- Surface pressing concerns (artificial "enhancement")
- Even damaged copies have significant value

**Other Reserved List:**
- Dual lands are heavily played/graded
- Many cards exist only in played condition
- Market values NM/M copies at huge premium
- LP copies are acceptable for many collectors

### Vintage (Pre-Modern Border)

Sets from 1993-2003 with original frame:

**Grading notes:**
- Print quality varies significantly
- Albino/misprint collectors market
- Dark/light printing variations
- Chronicles vs. original set cards

### Modern Border Era

8th Edition through Magic 2015:

- More consistent printing
- Foil curling begins
- Japanese printings often superior
- Good availability of mint copies

### Current Era

Modern Horizons, Standard sets, Collector products:

- Extended art/borderless premium
- Collector boosters vs. draft quality varies
- Serialized cards (authenticate carefully)
- Set boosters generally better quality than draft

## MTG-Specific Defects

### Print Defects

**Crimping:** Roller marks from packaging - minor crimps may not affect grade significantly, severe crimping is major defect.

**Ink spots/missing ink:** Common on older sets, less tolerated on modern.

**Registration errors:** Color layers misaligned; minor errors are fascinating, severe errors are damaged.

### Play Wear

Many MTG cards were actually played:

**Shuffle wear:** Edge whitening from shuffling - immediate indicator of play.

**Sleeve wear:** Marks from sleeved play - less severe than unsleeved.

**Marking concerns:** Bent corners, notches, or marks may indicate marked cards.

## DCM and MTG Cards

DCM is optimized for Magic: The Gathering with:

### Accurate Detection of:
- Border alignment on all frame styles
- Foil surface condition
- Edge whitening patterns
- Print line identification
- Corner condition (including Alpha rounded corners)

### Set-Specific Standards

Our AI understands that:
- Alpha centering standards differ from modern sets
- Foil curl assessment accounts for reversibility
- Print variations within sets are documented
- Era-appropriate condition expectations apply

### Integration with Pricing

For MTG specifically:
- Scryfall pricing integration
- Foil vs. non-foil valuation
- Set/printing differentiation
- Condition-based price adjustment

## Investment Perspectives on MTG

### What Holds Value

- **Reserved List cards** - Guaranteed no reprints
- **Alpha/Beta staples** - Historical significance
- **First printings** - Original set versions
- **Serial numbered cards** - Modern scarcity
- **Judge foils/promos** - Limited distribution

### What's Volatile

- **Standard-legal cards** - Rotate out, lose demand
- **Reprinted cards** - Value decreases with supply
- **Buylist specs** - Quick to crash
- **Non-playable cards** - Pure collector appeal required

### Condition Premium in MTG

| Card Type | PSA 10 vs 9 Premium |
|-----------|-------------------|
| Power Nine | 50-100%+ |
| Dual Lands | 30-50% |
| Modern Staples | 20-40% |
| Sealed Product | N/A |

## Pre-Screening Your MTG Collection

Use DCM to identify:

1. **Grade potential** - Which cards merit PSA/BGS submission
2. **Foil condition** - Surface issues hard to see with naked eye
3. **Centering measurements** - Precise before submission
4. **Hidden defects** - Catch issues before paying grading fees

## Storage and Preservation

To maintain grade:

- **Inner sleeves** - Perfect fit, not penny sleeves
- **Outer sleeves** - Dragon Shield, KMC, or similar
- **Toploaders** - For valuable singles
- **Climate control** - Especially for foils
- **Away from magnets** - Foil layers are metallic

---

**Grade your MTG collection today** - [Sign up for DCM](/login?mode=signup) and get instant condition analysis on your Magic cards, from Alpha to the latest set.`
  }
];

async function seedBlogPosts() {
  console.log('Starting blog post seeding...\n');

  // Get categories
  const { data: categories, error: catError } = await supabase
    .from('blog_categories')
    .select('id, slug');

  if (catError) {
    console.error('Error fetching categories:', catError);
    return;
  }

  const categoryMap = new Map(categories?.map(c => [c.slug, c.id]) || []);

  for (const post of blogPosts) {
    const categoryId = categoryMap.get(post.category_slug);

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        category_id: categoryId || null,
        tags: post.tags,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        status: 'draft',
        author_name: 'DCM Team',
      })
      .select()
      .single();

    if (error) {
      console.error(`Error creating "${post.title}":`, error.message);
    } else {
      console.log(`✓ Created draft: "${post.title}"`);
    }
  }

  console.log('\nBlog seeding complete!');
}

seedBlogPosts();
