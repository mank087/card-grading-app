# Complete Deployment Guide: Local App → Live Web App
## Dynamic Collectibles Management - Production Deployment

**Target Audience:** True Beginners
**Domain:** GoDaddy registered domain
**Current Stack:** Next.js 15, Supabase, OpenAI
**Goal:** Production-ready, monetizable web application

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Hosting Platform Setup (Vercel)](#hosting-platform-setup-vercel)
4. [Domain Configuration (GoDaddy → Vercel)](#domain-configuration-godaddy--vercel)
5. [Database Security (Supabase Production)](#database-security-supabase-production)
6. [File Upload Security](#file-upload-security)
7. [User Authentication & Registration](#user-authentication--registration)
8. [Payment Processing (Stripe)](#payment-processing-stripe)
9. [Monetization Strategy](#monetization-strategy)
10. [Security Hardening](#security-hardening)
11. [Monitoring & Analytics](#monitoring--analytics)
12. [Deployment Workflow](#deployment-workflow)
13. [Post-Launch Checklist](#post-launch-checklist)
14. [Cost Breakdown](#cost-breakdown)
15. [Troubleshooting](#troubleshooting)

---

## Overview & Architecture

### What We're Building
A production-ready card grading platform that:
- Accepts user uploads (images)
- Processes with AI (OpenAI GPT-4o)
- Stores data securely (Supabase)
- Handles payments (Stripe)
- Scales automatically
- Costs minimal at low usage

### Recommended Tech Stack

| Component | Tool | Why | Cost |
|-----------|------|-----|------|
| **Hosting** | Vercel | Next.js optimized, auto-scaling, CDN | $0-20/mo |
| **Database** | Supabase Pro | Already integrated, RLS, backups | $25/mo |
| **Domain** | GoDaddy | You already have it | ~$12/yr |
| **Payments** | Stripe | Industry standard, easy integration | 2.9% + $0.30 |
| **Email** | Resend | Transactional emails, generous free tier | $0-20/mo |
| **Monitoring** | Sentry | Error tracking, performance | $0-26/mo |
| **Analytics** | Vercel Analytics | User tracking, performance | $10/mo |
| **Rate Limiting** | Upstash Redis | Prevent abuse | $0-10/mo |

**Total Monthly Cost (Starting):** ~$50-100/mo + usage-based charges

---

## Pre-Deployment Checklist

### ✅ Before You Start

- [ ] You have access to GoDaddy account (domain management)
- [ ] You have Supabase project (currently using)
- [ ] You have OpenAI API key (currently using)
- [ ] You have a GitHub account (for code repository)
- [ ] You have a credit/debit card (for service accounts)
- [ ] You've tested app locally and it works

### ✅ Create Necessary Accounts

1. **Vercel** - https://vercel.com/signup
   - Sign up with GitHub (easiest)
   - Free to start, upgrade when needed

2. **Stripe** - https://stripe.com/register
   - Business email required
   - Will need tax info for live mode

3. **Resend** - https://resend.com/signup
   - For sending emails (receipts, confirmations)
   - Free tier: 3,000 emails/month

4. **Sentry** (Optional but recommended) - https://sentry.io/signup
   - Error tracking
   - Free tier: 5,000 errors/month

### ✅ Prepare Your Code

```bash
# 1. Initialize Git repository (if not already done)
cd C:\Users\benja\card-grading-app
git init
git add .
git commit -m "Initial commit - ready for deployment"

# 2. Create GitHub repository
# Go to https://github.com/new
# Create repository named: card-grading-app
# Follow instructions to push code

git remote add origin https://github.com/YOUR_USERNAME/card-grading-app.git
git branch -M main
git push -u origin main
```

---

## Hosting Platform Setup (Vercel)

### Step 1: Create Vercel Project

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Click "Add New..." → "Project"

2. **Import Git Repository**
   - Click "Import" next to your `card-grading-app` repo
   - Vercel auto-detects it's a Next.js app

3. **Configure Build Settings**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

4. **Environment Variables**
   Click "Environment Variables" and add:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
   OPENAI_API_KEY=sk-your_openai_key_here
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NODE_ENV=production
   ```

   **Where to find these:**
   - Supabase keys: Supabase Dashboard → Settings → API
   - OpenAI key: https://platform.openai.com/api-keys
   - APP_URL: Your domain (set after domain config)

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build
   - You'll get a URL like: `your-app.vercel.app`

### Step 2: Test Vercel Deployment

1. Visit `https://your-app.vercel.app`
2. Try to:
   - Log in (Supabase auth should work)
   - Upload a card (images should upload)
   - Grade a card (OpenAI should process)

**If anything fails, check:**
- Vercel Logs: Dashboard → Deployment → Logs
- Environment variables are set correctly
- Supabase RLS policies allow production domain

---

## Domain Configuration (GoDaddy → Vercel)

### Step 1: Add Domain to Vercel

1. **Go to Vercel Project Settings**
   - Your project → Settings → Domains

2. **Add Your Domain**
   - Enter: `yourdomain.com`
   - Click "Add"

3. **Vercel will ask you to configure DNS**
   - You'll see instructions for:
     - A record: `76.76.21.21` (Vercel's IP)
     - CNAME: `cname.vercel-dns.com`

### Step 2: Configure GoDaddy DNS

1. **Log in to GoDaddy**
   - Go to: https://dcc.godaddy.com/domains

2. **Manage DNS**
   - Find your domain
   - Click "DNS" or "Manage DNS"

3. **Update DNS Records**

   **Option A: Root Domain (yourdomain.com)**
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   TTL: 1 Hour (or default)
   ```

   **Option B: Subdomain (www.yourdomain.com)**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   TTL: 1 Hour
   ```

   **Recommended:** Do BOTH
   - Set A record for root domain
   - Set CNAME for www subdomain
   - Vercel will redirect www → non-www automatically

4. **Wait for DNS Propagation**
   - Takes 1-48 hours (usually 1-4 hours)
   - Check status: https://dnschecker.org

### Step 3: Enable HTTPS

1. **Vercel Auto-SSL**
   - Once DNS propagates, Vercel auto-issues SSL certificate
   - Free, renews automatically
   - You'll see "SSL Certificate Issued" in Vercel dashboard

2. **Force HTTPS Redirect**
   - Vercel → Project Settings → Security
   - Enable "Force HTTPS"
   - All HTTP traffic redirects to HTTPS

---

## Database Security (Supabase Production)

### Step 1: Upgrade Supabase Plan

**Why upgrade?**
- Free tier: Limited resources, shared infrastructure
- Pro tier: Daily backups, better performance, dedicated resources

1. **Supabase Dashboard** → Project → Settings → Billing
2. **Upgrade to Pro Plan**: $25/month
   - Includes:
     - Daily automated backups (7 days retention)
     - 8GB database storage
     - 50GB bandwidth
     - Email support

### Step 2: Enable Row Level Security (RLS)

**Critical for production!** Without RLS, anyone can access any data.

```sql
-- Enable RLS on cards table
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own cards OR public cards
CREATE POLICY "Users can view own cards or public cards"
  ON cards
  FOR SELECT
  USING (
    auth.uid() = user_id OR is_public = true
  );

-- Policy: Users can only insert their own cards
CREATE POLICY "Users can insert own cards"
  ON cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own cards
CREATE POLICY "Users can update own cards"
  ON cards
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can only delete their own cards
CREATE POLICY "Users can delete own cards"
  ON cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket policies (images)
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'cards' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own images or public images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'cards' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      (SELECT is_public FROM cards WHERE front_path = name OR back_path = name)
    )
  );
```

### Step 3: Set Up Database Backups

1. **Automated Backups** (Pro plan)
   - Enabled automatically
   - Daily at 2 AM UTC
   - 7-day retention

2. **Manual Backup** (before major changes)
   ```bash
   # Download backup via Supabase CLI
   supabase db dump -f backup_$(date +%Y%m%d).sql
   ```

3. **Backup Verification**
   - Monthly: Download and verify backup restores

### Step 4: Database Limits & Quotas

```sql
-- Limit card uploads per user (prevent spam)
CREATE OR REPLACE FUNCTION check_user_card_limit()
RETURNS TRIGGER AS $$
DECLARE
  card_count INTEGER;
BEGIN
  -- Count user's cards in last 24 hours
  SELECT COUNT(*) INTO card_count
  FROM cards
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Free users: 10 cards/day, Paid users: unlimited
  IF card_count >= 10 AND NOT (
    SELECT is_premium FROM user_subscriptions WHERE user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Upload limit reached. Upgrade to premium for unlimited uploads.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_card_limit
  BEFORE INSERT ON cards
  FOR EACH ROW
  EXECUTE FUNCTION check_user_card_limit();
```

---

## File Upload Security

### Step 1: File Size Limits

**File:** `src/app/upload/page.tsx`

```typescript
// Add validation before upload
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const handleFileSelect = async (file: File, side: 'front' | 'back') => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    setStatus('❌ Error: File too large. Maximum size is 10MB.');
    return;
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    setStatus('❌ Error: Invalid file type. Please upload JPEG, PNG, or WebP images.');
    return;
  }

  // Existing compression logic...
};
```

### Step 2: Virus Scanning (Optional but Recommended)

**Option A: Client-Side (Basic)**
```typescript
// Check for suspicious file characteristics
const isSuspiciousFile = (file: File): boolean => {
  // Check for double extensions
  if (file.name.match(/\.(exe|bat|cmd|sh)$/i)) return true;

  // Check for embedded executables in image
  // (This is basic - not foolproof)
  return false;
};
```

**Option B: Server-Side (Better)**
Use Cloudflare Workers or AWS Lambda with ClamAV to scan uploads.

### Step 3: Rate Limiting

**File:** `src/app/api/vision-grade/[id]/route.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 requests per hour
  analytics: true,
});

export async function GET(request: NextRequest) {
  // Get user identifier
  const identifier = request.headers.get("x-forwarded-for") || "anonymous";

  // Check rate limit
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  // Continue with normal processing...
}
```

**Setup Upstash:**
1. Go to https://upstash.com
2. Create Redis database
3. Add to `.env`:
   ```
   UPSTASH_REDIS_REST_URL=your_url
   UPSTASH_REDIS_REST_TOKEN=your_token
   ```
4. Install: `npm install @upstash/ratelimit @upstash/redis`

---

## User Authentication & Registration

### Step 1: Enable Email Confirmation

**Supabase Dashboard** → Authentication → Settings

1. **Email Confirmations**: ON
2. **Confirm email**: Require users to confirm email before sign-in
3. **Email Templates**:
   - Customize confirmation email with your branding
   - Add logo and custom message

### Step 2: Add Social Login (Optional)

**Google OAuth:**
1. **Google Cloud Console**
   - Create OAuth 2.0 Client ID
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`

2. **Supabase**
   - Auth → Providers → Google
   - Enable and add Client ID + Secret

**Same process for:**
- Apple
- GitHub
- Discord
- etc.

### Step 3: User Profile Setup

```sql
-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  cards_remaining INT DEFAULT 10, -- Free tier monthly allowance
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: Create profile on user signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();
```

---

## Payment Processing (Stripe)

### Step 1: Stripe Account Setup

1. **Create Stripe Account**
   - Go to https://stripe.com/register
   - Complete business verification

2. **Get API Keys**
   - Dashboard → Developers → API keys
   - Copy:
     - **Publishable key** (starts with `pk_test_...`)
     - **Secret key** (starts with `sk_test_...`)

3. **Add to Environment Variables**
   ```
   # Vercel Environment Variables
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_... (get after webhook setup)
   ```

### Step 2: Install Stripe

```bash
npm install stripe @stripe/stripe-js
```

### Step 3: Create Pricing Tiers

**File:** `src/app/pricing/page.tsx`

```typescript
const PRICING_TIERS = [
  {
    name: "Free",
    price: 0,
    interval: "forever",
    features: [
      "10 cards per month",
      "Basic grading",
      "Public collection",
      "Community support"
    ],
    stripe_price_id: null
  },
  {
    name: "Pro",
    price: 9.99,
    interval: "month",
    features: [
      "Unlimited cards",
      "Advanced grading",
      "Private collections",
      "Priority support",
      "Export reports (PDF)"
    ],
    stripe_price_id: "price_1234567890" // Replace with real Price ID
  },
  {
    name: "Business",
    price: 49.99,
    interval: "month",
    features: [
      "Everything in Pro",
      "API access",
      "Bulk upload (CSV)",
      "White-label reports",
      "Dedicated support"
    ],
    stripe_price_id: "price_9876543210"
  }
];
```

### Step 4: Create Stripe Products & Prices

**Stripe Dashboard** → Products

1. **Create "Pro" Product**
   - Name: Card Grading Pro
   - Description: Unlimited card grading
   - Price: $9.99/month recurring
   - Copy Price ID → Add to code above

2. **Create "Business" Product**
   - Name: Card Grading Business
   - Price: $49.99/month recurring
   - Copy Price ID → Add to code

### Step 5: Implement Checkout

**File:** `src/app/api/create-checkout/route.ts`

```typescript
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  const { priceId, userId } = await request.json();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Step 6: Handle Webhooks

**File:** `src/app/api/stripe-webhook/route.ts`

```typescript
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await handleSubscriptionCreated(session);
      break;

    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;

    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(deletedSubscription);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionCreated(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const supabase = supabaseServer();

  await supabase
    .from('user_profiles')
    .update({
      is_premium: true,
      subscription_tier: 'pro',
      cards_remaining: 999999, // Unlimited
      subscription_expires_at: null,
    })
    .eq('id', userId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Update user profile based on subscription status
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const supabase = supabaseServer();

  await supabase
    .from('user_profiles')
    .update({
      is_premium: false,
      subscription_tier: 'free',
      cards_remaining: 10,
    })
    .eq('id', userId);
}
```

### Step 7: Configure Stripe Webhook

1. **Stripe Dashboard** → Developers → Webhooks
2. **Add endpoint**:
   - URL: `https://yourdomain.com/api/stripe-webhook`
   - Events to send:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
3. **Copy Webhook Secret**
   - Add to Vercel env: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## Monetization Strategy

### Recommended Pricing Model

**Freemium with Usage Limits:**

| Tier | Price | Cards/Month | Features |
|------|-------|-------------|----------|
| **Free** | $0 | 10 | Basic grading, public collection |
| **Pro** | $9.99/mo | Unlimited | + Private collections, export PDF |
| **Business** | $49.99/mo | Unlimited | + API access, bulk upload, priority |

### Alternative Models

**Pay-Per-Card:**
- $0.99 per card graded
- Good for occasional users
- Implement via Stripe Payment Intents (not subscriptions)

**Credit Packs:**
- 10 credits: $8 ($0.80/card)
- 50 credits: $35 ($0.70/card)
- 100 credits: $60 ($0.60/card)

### Additional Revenue Streams

1. **Premium Features**
   - Advanced analytics dashboard
   - Market price tracking
   - Collection insurance estimates

2. **White-Label Service**
   - Card shops can brand the app
   - $299/month per shop

3. **API Access**
   - Integrate grading into other platforms
   - $0.50 per API call

4. **Marketplace Fees**
   - Allow users to sell cards in-app
   - Take 5-10% transaction fee

---

## Security Hardening

### Environment Variables Security

**Never commit `.env` files to Git!**

```bash
# Add to .gitignore (already should be there)
.env
.env.local
.env.production
```

**Use Vercel Environment Variables:**
- Production environment only
- Encrypted at rest
- Never exposed to client (except `NEXT_PUBLIC_*`)

### Content Security Policy (CSP)

**File:** `next.config.ts`

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.stripe.com",
              "frame-src https://js.stripe.com"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
```

### CORS Configuration

**API routes should only accept requests from your domain:**

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
  ].filter(Boolean);

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { error: 'CORS policy: Origin not allowed' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### Input Validation

**Never trust user input!**

```typescript
// src/lib/validation.ts
import { z } from 'zod';

export const cardUploadSchema = z.object({
  cardId: z.string().uuid(),
  category: z.enum(['Sports', 'Pokemon', 'MTG', 'Lorcana', 'Other']),
  frontPath: z.string().min(1),
  backPath: z.string().min(1),
});

// Use in API routes:
const result = cardUploadSchema.safeParse(requestData);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

Install Zod:
```bash
npm install zod
```

---

## Monitoring & Analytics

### 1. Vercel Analytics

**Enable in Vercel Dashboard:**
- Project → Analytics → Enable
- Tracks:
  - Page views
  - Performance metrics (Web Vitals)
  - User geography

**Cost:** $10/month (free tier available)

### 2. Sentry (Error Tracking)

**Install:**
```bash
npm install @sentry/nextjs
```

**Configure:**
```bash
npx @sentry/wizard@latest -i nextjs
```

**File:** `sentry.client.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**Vercel Environment:**
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### 3. OpenAI Usage Tracking

```typescript
// Track OpenAI costs
import { supabaseServer } from '@/lib/supabaseServer';

async function logOpenAIUsage(userId: string, tokens: number, cost: number) {
  const supabase = supabaseServer();

  await supabase.from('openai_usage').insert({
    user_id: userId,
    tokens_used: tokens,
    cost_usd: cost,
    timestamp: new Date()
  });
}
```

**SQL Schema:**
```sql
CREATE TABLE openai_usage (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Monitor costs
SELECT
  DATE(timestamp) as date,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost
FROM openai_usage
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### 4. User Activity Tracking

```sql
CREATE TABLE user_activity_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100), -- 'card_upload', 'card_grade', 'subscription_purchase'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track daily active users
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as daily_active_users
FROM user_activity_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Deployment Workflow

### Development → Staging → Production

**Branch Strategy:**
```
main (production) ← PR merge only
├── staging (preview) ← test features here
└── feature/* (dev) ← create features here
```

**Workflow:**
1. Create feature branch:
   ```bash
   git checkout -b feature/add-payment-page
   ```

2. Develop locally, commit changes:
   ```bash
   git add .
   git commit -m "Add payment page with Stripe integration"
   git push origin feature/add-payment-page
   ```

3. Create Pull Request on GitHub
   - Vercel auto-deploys preview URL
   - Test at: `feature-add-payment-page.vercel.app`

4. Merge to `staging` branch
   - Vercel deploys staging environment
   - Test at: `staging.yourdomain.com`

5. Merge to `main` (production)
   - Vercel deploys to production
   - Live at: `yourdomain.com`

### Vercel Deployment Settings

**Project → Settings → Git:**
- **Production Branch:** `main`
- **Preview Branches:** All branches
- **Auto-deploy:** ON

**Environment Variables per Environment:**
- Production: Real Stripe keys, real database
- Preview: Test Stripe keys, staging database

---

## Post-Launch Checklist

### Week 1: Monitor & Fix

- [ ] Check Sentry for errors
- [ ] Monitor Vercel Analytics for traffic
- [ ] Review OpenAI usage/costs
- [ ] Test all payment flows
- [ ] Verify email confirmations working
- [ ] Check RLS policies (no data leaks)
- [ ] Test mobile responsiveness

### Week 2-4: Optimize

- [ ] Improve page load times (Lighthouse score)
- [ ] Add loading skeletons for better UX
- [ ] Implement progressive image loading
- [ ] Cache frequently accessed data
- [ ] Set up automated backups verification
- [ ] Create admin dashboard for monitoring

### Month 1: Iterate

- [ ] Collect user feedback
- [ ] Analyze most popular features
- [ ] Identify drop-off points in funnel
- [ ] A/B test pricing page
- [ ] Optimize conversion rates
- [ ] Plan next features based on usage

---

## Cost Breakdown

### Monthly Operating Costs (Estimated)

**Infrastructure:**
| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20/mo |
| Supabase | Pro | $25/mo |
| Upstash Redis | Pay-as-go | $5-10/mo |
| Resend | Free/Pro | $0-20/mo |
| Sentry | Team | $26/mo |
| Domain (GoDaddy) | Annual | $1/mo (amortized) |
| **Total Fixed** | | **~$77-102/mo** |

**Usage-Based:**
| Service | Cost | Example Usage |
|---------|------|---------------|
| OpenAI GPT-4o | ~$0.02/card | 100 cards = $2 |
| Stripe fees | 2.9% + $0.30 | $100 revenue = $3.20 |
| Vercel bandwidth | $0.15/GB | 100GB = $15 |
| Supabase storage | $0.021/GB | 50GB images = $1.05 |

**Example Monthly Cost (100 users, 10 cards each):**
- Fixed: $90
- OpenAI (1,000 cards × $0.02): $20
- Stripe (10 subs × $9.99): $3
- Bandwidth: $5
- **Total: ~$118/month**

**Revenue (100 users, 10% conversion):**
- 10 Pro subs × $9.99 = $99.90/month
- **Break-even: ~90 users with 10% conversion**

---

## Troubleshooting

### Common Issues

**1. "Module not found" errors after deployment**
- **Cause:** Missing dependencies
- **Fix:**
  ```bash
  npm install
  git add package-lock.json
  git commit -m "Update dependencies"
  git push
  ```

**2. Environment variables not working**
- **Cause:** Not set in Vercel or wrong scope
- **Fix:** Vercel → Settings → Environment Variables → Redeploy

**3. Database connection fails**
- **Cause:** Wrong Supabase URL or RLS blocking requests
- **Fix:** Check RLS policies, verify URL in env vars

**4. Images not uploading**
- **Cause:** Storage bucket policy or size limit
- **Fix:** Check Supabase Storage policies, increase size limit

**5. Stripe webhook not firing**
- **Cause:** Wrong endpoint URL or webhook secret
- **Fix:** Verify URL in Stripe dashboard, redeploy with correct secret

**6. Slow AI grading**
- **Cause:** Cold starts or OpenAI rate limits
- **Fix:**
  - Use Vercel Pro (reduces cold starts)
  - Implement queue system (BullMQ + Redis)
  - Add loading indicators for better UX

**7. DNS not propagating**
- **Cause:** DNS cache or wrong records
- **Fix:**
  - Wait 24-48 hours
  - Flush local DNS: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
  - Verify with: https://dnschecker.org

---

## Next Steps After Deployment

### Immediate (Day 1)
1. ✅ Deploy to Vercel
2. ✅ Configure domain
3. ✅ Test all features
4. ✅ Set up monitoring

### Short Term (Week 1-2)
1. Add Terms of Service page
2. Add Privacy Policy page
3. Set up transactional emails (welcome, receipt)
4. Create FAQ/Help Center
5. Add admin dashboard

### Medium Term (Month 1-3)
1. Implement referral program
2. Add social sharing features
3. Build marketplace for selling cards
4. Create mobile app (React Native)
5. Add bulk upload (CSV)

### Long Term (Quarter 1-2)
1. Partner with card shops
2. Integrate with eBay/TCGPlayer APIs
3. Add insurance estimates
4. Build API for third-party integrations
5. Expand to international markets

---

## Resources & Links

**Documentation:**
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Stripe: https://stripe.com/docs

**Communities:**
- Next.js Discord: https://nextjs.org/discord
- Supabase Discord: https://discord.supabase.com
- Stripe Discord: https://stripe.com/discord

**Support:**
- Vercel Support: support@vercel.com
- Supabase Support: https://supabase.com/support
- Stripe Support: https://support.stripe.com

---

## Final Checklist

Before going live, ensure:

- [ ] All environment variables set in Vercel
- [ ] Database RLS policies enabled
- [ ] Stripe products and prices created
- [ ] Stripe webhook configured
- [ ] Domain DNS configured (A record + CNAME)
- [ ] SSL certificate issued (HTTPS working)
- [ ] Rate limiting enabled
- [ ] File upload validation added
- [ ] Error tracking (Sentry) configured
- [ ] Analytics enabled
- [ ] Email confirmation enabled
- [ ] Privacy Policy page created
- [ ] Terms of Service page created
- [ ] Contact/Support page created
- [ ] Tested all user flows:
  - [ ] Sign up → Email confirm → Login
  - [ ] Upload card → Grade → View result
  - [ ] Subscribe → Payment → Access premium features
  - [ ] Cancel subscription → Revert to free tier
- [ ] Mobile responsive (test on phone)
- [ ] Lighthouse score > 90 (performance)
- [ ] No console errors in production
- [ ] Backup and restore tested

---

**You're ready to launch! 🚀**

Questions? Issues? Check the troubleshooting section or reach out to the respective service's support.

Good luck with your card grading app!
