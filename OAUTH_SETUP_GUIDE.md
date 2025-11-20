# OAuth Setup Guide (Google & Facebook)

This guide will help you configure Google and Facebook OAuth authentication for your card grading app.

## Prerequisites

- Access to your Supabase dashboard
- A Google account (for Google OAuth)
- A Facebook account (for Facebook OAuth)

---

## Part 1: Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: "Card Grading App" (or your preferred name)
4. Click "Create"

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → Click **Create**
3. Fill in the required fields:
   - **App name**: Card Grading App
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**
5. On the Scopes page, click **Save and Continue** (no need to add scopes)
6. On the Test users page, click **Save and Continue**
7. Click **Back to Dashboard**

### Step 3: Create OAuth Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
3. Select **Application type**: Web application
4. **Name**: Card Grading App Web Client
5. Under **Authorized JavaScript origins**, add:
   ```
   https://zyxtqcvwkbpvsjsszbzg.supabase.co
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/callback
   ```
7. Click **Create**
8. **IMPORTANT**: Copy the **Client ID** and **Client Secret** - you'll need these for Supabase

### Step 4: Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: **zyxtqcvwkbpvsjsszbzg**
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Sign in with Google** to ON
6. Enter the credentials from Step 3:
   - **Client ID**: (paste from Google Cloud Console)
   - **Client Secret**: (paste from Google Cloud Console)
7. Click **Save**

---

## Part 2: Facebook OAuth Setup

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Consumer** as the app type → Click **Next**
4. Fill in app details:
   - **App Name**: Card Grading App
   - **App Contact Email**: Your email
5. Click **Create App**
6. Complete the security check if prompted

### Step 2: Add Facebook Login Product

1. In the left sidebar, find **Add Products to Your App**
2. Find **Facebook Login** and click **Set Up**
3. Select **Web** platform
4. Skip the quickstart guide (we already have our implementation)

### Step 3: Configure Facebook Login Settings

1. In the left sidebar, navigate to **Facebook Login** → **Settings**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/callback
   ```
3. Click **Save Changes**

### Step 4: Get App Credentials

1. In the left sidebar, click **Settings** → **Basic**
2. You'll see:
   - **App ID** (this is your Client ID)
   - **App Secret** (click "Show" to reveal, this is your Client Secret)
3. **IMPORTANT**: Copy both values - you'll need these for Supabase

### Step 5: Configure App Domain

1. Still in **Settings** → **Basic**
2. Scroll to **App Domains** and add:
   ```
   zyxtqcvwkbpvsjsszbzg.supabase.co
   localhost
   ```
3. Scroll to **Privacy Policy URL** and add:
   ```
   https://zyxtqcvwkbpvsjsszbzg.supabase.co/privacy
   ```
   (You may need to create this page later)
4. Click **Save Changes**

### Step 6: Switch App to Live Mode

1. At the top of the page, you'll see a toggle that says "In Development"
2. Toggle it to **Live** mode
3. Complete the required information if prompted

### Step 7: Configure Facebook OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: **zyxtqcvwkbpvsjsszbzg**
3. Navigate to **Authentication** → **Providers**
4. Find **Facebook** in the list and click to expand
5. Toggle **Enable Sign in with Facebook** to ON
6. Enter the credentials from Step 4:
   - **Client ID**: (paste the App ID from Facebook)
   - **Client Secret**: (paste the App Secret from Facebook)
7. Click **Save**

---

## Part 3: Testing OAuth

### Test the Integration

1. Make sure your dev server is running:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/login

3. You should now see:
   - "Continue with Google" button
   - "Continue with Facebook" button
   - Email/password form below

4. Click on "Continue with Google":
   - You'll be redirected to Google's login page
   - After authentication, you'll be redirected back to `/auth/callback`
   - Then automatically redirected to `/collection`

5. Click on "Continue with Facebook":
   - You'll be redirected to Facebook's login page
   - After authentication, you'll be redirected back to `/auth/callback`
   - Then automatically redirected to `/collection`

### Troubleshooting

**Error: "redirect_uri_mismatch"**
- Make sure the redirect URI in Google Cloud Console exactly matches:
  ```
  https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/callback
  ```

**Error: "App Not Setup: This app is still in development mode"**
- Make sure you've switched your Facebook app to Live mode

**Error: "Invalid OAuth Redirect URI"**
- Make sure the redirect URI in Facebook Login Settings exactly matches:
  ```
  https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/callback
  ```

**OAuth works but user isn't created in database**
- Check that the `public.users` table exists and has the trigger set up
- The trigger should automatically create a user entry when someone signs up via OAuth

---

## Part 4: Production Setup

### Update Redirect URLs for Production

When you deploy to production, you'll need to add your production domain to:

1. **Google Cloud Console**:
   - Add production domain to "Authorized JavaScript origins"
   - No change needed to redirect URI (Supabase handles this)

2. **Facebook App Settings**:
   - Add production domain to "App Domains"
   - No change needed to redirect URI (Supabase handles this)

3. **Supabase**:
   - Navigate to **Authentication** → **URL Configuration**
   - Update **Site URL** to your production domain
   - Add production domain to **Redirect URLs**

---

## Security Notes

- Never commit OAuth credentials to version control
- Keep Client Secrets secure
- Regularly rotate secrets if compromised
- Monitor OAuth usage in Google Cloud Console and Facebook App Dashboard
- Review authorized domains periodically

---

## Files Modified

The following files were created/modified to support OAuth:

1. `src/lib/directAuth.ts` - Added OAuth functions
2. `src/app/login/page.tsx` - Added Google/Facebook buttons
3. `src/app/auth/callback/page.tsx` - OAuth callback handler
4. `database/create_users_table.sql` - Ensures users table exists for OAuth users

---

## Next Steps

1. Complete OAuth setup in Google Cloud Console and Facebook Developers
2. Configure both providers in Supabase dashboard
3. Test OAuth login with both providers
4. Consider adding additional OAuth providers (Apple, GitHub, etc.)
5. Create a privacy policy page for Facebook requirements

---

## Support

If you encounter issues:
- Check Supabase logs: Dashboard → Authentication → Logs
- Check browser console for errors
- Verify all redirect URLs are exact matches
- Ensure OAuth apps are in Live/Production mode
