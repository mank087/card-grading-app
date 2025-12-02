# Google OAuth Fix Plan

## Problem Summary

When users log in with Google, they are redirected to the homepage and appear logged out, even though they successfully authenticated with Google.

## Root Cause

### 1. Race Condition
The OAuth callback page (`/src/app/auth/callback/page.tsx`) calls `router.push('/collection')` immediately after writing to localStorage. The navigation may complete before localStorage is fully written.

### 2. Session Storage Mismatch
- OAuth relies on `supabaseClient.auth.getSession()` to detect tokens in the URL hash
- The rest of the app uses `getStoredSession()` which reads from localStorage key `supabase.auth.token`
- If localStorage write doesn't complete before navigation, the collection page sees no session

### 3. Timing Issue
The Supabase SDK needs time to parse OAuth tokens from the URL hash (`#access_token=...&refresh_token=...`) but the callback page may call `getSession()` before this completes.

---

## Key Files Involved

| File | Role | Issue |
|------|------|-------|
| `/src/lib/directAuth.ts` | OAuth flow & session storage | Race condition in `getOAuthSession()` |
| `/src/app/auth/callback/page.tsx` | Handles Google redirect | Navigates too quickly after storing session |
| `/src/lib/supabaseClient.ts` | Main Supabase client | Has `detectSessionInUrl: false` (should be `true`) |
| `/src/app/collection/page.tsx` | Checks session on load | Shows error if no session found |

---

## What's Missing

1. **No server-side session verification** - Admin auth uses HTTP-only cookies and `/api/admin/auth/verify`. Regular OAuth has no equivalent.

2. **No retry logic** - If `getOAuthSession()` fails, there's no retry mechanism.

3. **Silent failures** - Errors logged to console but users see no clear message.

---

## Fix Plan

### Step 1: Fix the Race Condition in Callback (Quick Fix)

**File: `/src/app/auth/callback/page.tsx`**

Add a verification step before navigating:

```typescript
useEffect(() => {
  const handleOAuthCallback = async () => {
    try {
      // Wait for Supabase SDK to process URL hash
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await getOAuthSession();

      if (result.error) {
        setError(result.error);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      if (result.session) {
        // Verify session was actually stored before navigating
        const storedSession = getStoredSession();
        if (storedSession) {
          router.push('/collection');
        } else {
          // Retry once
          await new Promise(resolve => setTimeout(resolve, 300));
          const retrySession = getStoredSession();
          if (retrySession) {
            router.push('/collection');
          } else {
            setError('Session storage failed. Please try again.');
            setTimeout(() => router.push('/login'), 3000);
          }
        }
      } else {
        setError('No session found');
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Authentication failed');
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  handleOAuthCallback();
}, [router]);
```

### Step 2: Fix supabaseClient.ts

**File: `/src/lib/supabaseClient.ts`**

Change:
```typescript
detectSessionInUrl: false
```

To:
```typescript
detectSessionInUrl: true
```

### Step 3: Add Server-Side OAuth Verification Endpoint (Recommended)

Create a new API route for verifying OAuth sessions:

**File: `/src/app/api/auth/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
```

### Step 4: Improve Error Handling in Callback Page

**File: `/src/app/auth/callback/page.tsx`**

Add better error display:

```typescript
if (error) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="text-red-500 text-5xl mb-4">!</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">Redirecting to login...</p>
      </div>
    </div>
  );
}
```

### Step 5: Add Logging for Debugging

**File: `/src/lib/directAuth.ts`**

Add console logs to `getOAuthSession()`:

```typescript
export async function getOAuthSession() {
  try {
    console.log('[OAuth] Getting session from Supabase...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error('[OAuth] Session error:', error);
      return { error: error.message };
    }

    if (session && typeof window !== 'undefined') {
      console.log('[OAuth] Session found, storing in localStorage...');
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(new Date(session.expires_at!).getTime() / 1000),
        user: session.user
      }));
      console.log('[OAuth] Session stored successfully');
    } else {
      console.warn('[OAuth] No session found or not in browser context');
    }

    return { session };
  } catch (err: any) {
    console.error('[OAuth] Exception:', err);
    return { error: err.message || 'Failed to get session' };
  }
}
```

---

## Supabase Console Configuration Checklist

Before testing, verify these settings in your Supabase dashboard:

1. **Authentication → Providers → Google**
   - [ ] Google provider is ENABLED
   - [ ] Client ID is set (from Google Cloud Console)
   - [ ] Client Secret is set (from Google Cloud Console)

2. **Authentication → URL Configuration**
   - [ ] Site URL: `https://yourdomain.com` (production)
   - [ ] Redirect URLs include:
     - `https://yourdomain.com/auth/callback`
     - `http://localhost:3000/auth/callback` (for development)

3. **Google Cloud Console (console.cloud.google.com)**
   - [ ] OAuth consent screen configured
   - [ ] OAuth 2.0 Client ID created (Web application type)
   - [ ] Authorized redirect URIs include:
     - `https://<your-supabase-project>.supabase.co/auth/v1/callback`

---

## Stripe Compatibility

**Google OAuth and Stripe work perfectly together:**

- Google OAuth handles *identity* (who the user is)
- Stripe handles *payments* (billing the user)

### Integration Pattern:

1. User logs in with Google → Supabase creates/finds user record with `user.id`
2. User subscribes → Call Stripe API to create customer
3. Store `stripe_customer_id` in your `profiles` or `users` table linked to `user.id`
4. Set up Stripe webhook to update subscription status on payment events
5. Check subscription status before allowing premium features

### Database Schema Addition:

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
```

---

## Testing Checklist

After implementing fixes:

- [ ] Click "Continue with Google" on login page
- [ ] Complete Google authentication
- [ ] Verify redirect to `/collection` (not homepage)
- [ ] Check browser console for OAuth logs
- [ ] Verify localStorage contains `supabase.auth.token`
- [ ] Refresh page and confirm still logged in
- [ ] Sign out and sign back in with Google
- [ ] Test on incognito/private browsing

---

## Files to Modify

1. `/src/app/auth/callback/page.tsx` - Fix race condition
2. `/src/lib/supabaseClient.ts` - Enable `detectSessionInUrl`
3. `/src/lib/directAuth.ts` - Add logging
4. `/src/app/api/auth/verify/route.ts` - Create new file (optional but recommended)

---

## Priority Order

1. **High**: Fix race condition in callback (Step 1)
2. **High**: Fix `detectSessionInUrl` setting (Step 2)
3. **Medium**: Add server-side verification endpoint (Step 3)
4. **Medium**: Improve error handling (Step 4)
5. **Low**: Add debugging logs (Step 5 - can remove after fixing)

---

*Document created: November 29, 2025*
*Status: Planning phase - no changes made yet*
