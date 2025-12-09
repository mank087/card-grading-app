# Egress Optimization Plan

## What is Egress?

**Egress** is data that leaves your Supabase project and travels to users or external services. You're charged for:

1. **Database egress**: Data sent from your database to your app/users
2. **Storage egress**: Images/files downloaded from Supabase Storage
3. **Auth egress**: Authentication responses (minimal)

Think of it like a water bill - you pay for water (data) that flows OUT of your house (Supabase).

### Your Main Egress Sources (Estimated)

| Source | % of Egress | Description |
|--------|-------------|-------------|
| **Image downloads** | ~70-80% | Card images (front/back) downloaded by users |
| **Large JSON fields** | ~10-15% | `conversational_grading`, `ai_grading` (2-5KB each) |
| **SELECT * queries** | ~5-10% | Admin monitoring fetching all columns |
| **API responses** | ~5% | Card data, collection lists |

---

## Priority 1: Image Optimization (Highest Impact)

### Problem
Each card has 2 images (front + back). Every time a user views their collection or a card detail page, those images are downloaded from Supabase Storage.

### Solutions

#### 1.1 Add Supabase Image Transformations
Use Supabase's built-in image transformation to serve smaller images for thumbnails.

**Current**: Full-size images (~500KB-2MB each) served everywhere
**Optimized**: Thumbnails for lists (~50KB), full-size only for detail view

```typescript
// In your API routes, generate thumbnail URLs for collection views
const thumbnailUrl = supabase.storage
  .from('cards')
  .getPublicUrl(path, {
    transform: {
      width: 400,
      height: 560,
      quality: 70
    }
  });
```

**Estimated savings**: 60-80% reduction in image egress

#### 1.2 Implement Browser Caching Headers
Add cache headers so browsers don't re-download images.

```typescript
// When generating signed URLs, use longer expiry
const { data } = await supabase.storage
  .from('cards')
  .createSignedUrl(path, 86400); // 24 hours instead of 1 hour
```

#### 1.3 Use a CDN (Cloudflare)
Put Cloudflare in front of your Supabase storage to cache images globally.

**Setup**:
1. Add your domain to Cloudflare
2. Create a Worker or Page Rule to cache storage URLs
3. Images are served from Cloudflare's edge, not Supabase

**Estimated savings**: 50-90% reduction after cache warm-up

---

## Priority 2: Database Query Optimization (Medium Impact)

### Problem
Several queries fetch more data than needed, especially in admin routes.

### Solutions

#### 2.1 Fix SELECT * Queries in Admin Routes

**Files to update**:
- `/src/app/api/admin/monitoring/api-usage/route.ts`
- `/src/app/api/admin/monitoring/errors/route.ts`
- `/src/app/api/admin/cards/[id]/route.ts`

**Change from**:
```typescript
.select('*', { count: 'exact' })
```

**Change to**:
```typescript
.select('id, created_at, endpoint, method, status_code, duration_ms', { count: 'exact' })
```

#### 2.2 Don't Fetch Unused Large Fields

The `ai_grading` field is legacy and not displayed, but still fetched. Remove it from SELECT statements.

**Current collection query includes**:
```
ai_grading, conversational_grading, conversational_card_info...
```

**Optimized** - only fetch what's displayed:
```
id, serial, front_path, back_path, card_name, category,
conversational_decimal_grade, created_at, visibility
```

#### 2.3 Implement Pagination Properly

For admin monitoring, limit results and add proper pagination:

```typescript
const pageSize = 20; // Reduce from 50
const { data } = await supabase
  .from('api_usage_log')
  .select('id, endpoint, created_at, status_code')
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1);
```

---

## Priority 3: Lazy Loading & Deferred Fetching (Medium Impact)

### Problem
Collection page fetches ALL card data upfront, including fields only needed on detail pages.

### Solutions

#### 3.1 Two-Tier Data Fetching

**Tier 1 (Collection List)** - Minimal data:
```typescript
.select('id, serial, front_path, card_name, category, conversational_decimal_grade, created_at')
```

**Tier 2 (Card Detail)** - Full data when user clicks:
```typescript
.select('*') // Only when viewing single card
```

#### 3.2 Lazy Load Images Below the Fold

Only load images that are visible in the viewport:

```typescript
// In your card grid component
<img
  src={card.thumbnailUrl}
  loading="lazy"  // Native lazy loading
  alt={card.card_name}
/>
```

#### 3.3 Infinite Scroll Instead of Load All

Instead of loading 50+ cards at once, load 12 at a time as user scrolls:

```typescript
// Initial load
const initialCards = await fetchCards({ limit: 12, offset: 0 });

// On scroll near bottom
const moreCards = await fetchCards({ limit: 12, offset: cards.length });
```

---

## Priority 4: Caching Strategies (Medium Impact)

### 4.1 Server-Side Response Caching

Add caching headers to API responses:

```typescript
// In your API routes
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'private, max-age=60', // Cache for 1 minute
  }
});
```

### 4.2 Client-Side Data Caching

Use React Query or SWR for intelligent caching:

```typescript
// With React Query
const { data: cards } = useQuery({
  queryKey: ['cards', userId],
  queryFn: fetchUserCards,
  staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
});
```

### 4.3 Cache Signed URLs

Your vision-grade route already caches signed URLs. Extend this pattern:

```typescript
// Create a URL cache with 50-minute expiry
const urlCache = new Map<string, { url: string; expires: number }>();

function getCachedSignedUrl(path: string) {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  // Generate new signed URL...
}
```

---

## Priority 5: Archive Old Data (Low Impact, Good Hygiene)

### Problem
Admin monitoring tables grow indefinitely, causing larger queries over time.

### Solutions

#### 5.1 Add Data Retention Policies

Create a scheduled function to clean old logs:

```sql
-- Run weekly via Supabase cron
DELETE FROM api_usage_log WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days';
```

#### 5.2 Archive Instead of Delete

Move old records to an archive table:

```sql
-- Archive old records
INSERT INTO api_usage_log_archive
SELECT * FROM api_usage_log WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM api_usage_log WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## Implementation Checklist

### Quick Wins (Do First)
- [ ] Add `loading="lazy"` to all card images
- [ ] Reduce signed URL expiry or add caching headers
- [ ] Fix SELECT * queries in admin routes
- [ ] Remove `ai_grading` from collection queries

### Medium Effort
- [ ] Implement image transformations for thumbnails
- [ ] Add two-tier data fetching (list vs detail)
- [ ] Implement infinite scroll pagination
- [ ] Add response caching headers

### Larger Projects
- [ ] Set up Cloudflare CDN for image caching
- [ ] Implement client-side data caching (React Query)
- [ ] Create data retention/archival jobs
- [ ] Add signed URL caching layer

---

## Monitoring Your Progress

### Check Egress in Supabase Dashboard
1. Go to **Project Settings** > **Usage**
2. Look at **Database egress** and **Storage egress**
3. Track daily/weekly trends

### Add Egress Tracking
Consider logging data sizes in your API routes:

```typescript
const data = await fetchCards();
console.log(`Collection response size: ${JSON.stringify(data).length} bytes`);
```

---

## Expected Results

| Optimization | Estimated Egress Reduction |
|--------------|---------------------------|
| Image transformations (thumbnails) | 60-70% of image egress |
| CDN caching | Additional 50-90% |
| Remove unused JSON fields | 20-30% of database egress |
| Lazy loading + pagination | 30-50% of initial load |
| **Combined** | **70-90% total reduction** |

---

## Questions to Consider

1. **Do you need full-resolution images in the collection grid?** Thumbnails would dramatically reduce egress.

2. **How often do users refresh their collection page?** More caching = less egress.

3. **Are admin monitoring pages used frequently?** If not, aggressive optimization there has less impact.

4. **Would you consider a CDN like Cloudflare?** This is the single biggest win for image-heavy apps.
