/**
 * Creates a draft blog post announcing the iOS + Android app launches.
 *
 * Status is set to 'draft' so it appears in /admin/blog and can be reviewed,
 * edited, and published from there. Doesn't auto-publish.
 *
 * Run: npx tsx scripts/create-app-launch-blog-post.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NEWS_CATEGORY_ID = '56fda505-903e-45cd-adf6-07d2f6576a37'

const content = `We just launched native mobile apps for DCM Grading, available today on the Apple App Store and Google Play. The web version at dcmgrading.com keeps working exactly as it does now, so this is purely an addition rather than a replacement.

## What's in the apps

The mobile apps include the same tools you already use on the website. You can grade cards using your phone's camera, browse your collection, design custom slab labels in Label Studio, and list graded cards directly to eBay. Everything is built native, which means it loads faster than the web version on a phone or tablet.

There is no separate mobile feature set to learn. If you already know how to use DCM Grading on the web, you already know how to use it in the app.

## One account, three platforms

Your DCM account works the same on all three platforms. Sign in once with your email, Apple ID, or Google account, and you will see the same credits balance, the same graded card collection, and the same Label Studio designs no matter which device you pick up.

Grade a card on your phone during a card show, then come home and review the full report on your laptop. The data syncs automatically. No imports, no exports, no manual transfers.

This was important to us. We did not want to force anyone to commit to one platform. Some collectors prefer typing on a real keyboard for serious cataloging work. Others want to grab a quick grade between sessions at the local card shop. The apps are an option, not a replacement, and your workflow is yours to design.

## Getting the apps

Both apps are free to install:

- [Apple App Store](https://apps.apple.com/us/app/dcm-grading/id6768663163) for iPhone and iPad
- [Google Play](https://play.google.com/store/apps/details?id=com.dcmgrading.app) for Android phones and tablets

If you already have credits in your account, they carry over. New users get a free first grade when they sign up.

## Web is not going anywhere

If you prefer dcmgrading.com on your computer, keep using it. The web version receives all the same updates and runs the same grading engine. Many of our most active users grade primarily on the web, and that is a perfectly valid workflow.

We will continue to build for both surfaces. Anything that lands in the app will also be available on the web, and the other way around.

## Found an issue?

Both apps are brand new, so if something feels off or you spot a bug, send a note to admin@dcmgrading.com. We are actively monitoring feedback and pushing updates to both stores as needed.

Thanks for being part of the DCM Grading community. We are looking forward to seeing what you grade next.
`

async function main() {
  // Build slug. If a draft already exists with this slug, append a -1 suffix
  // to avoid the unique-constraint failure (idempotent re-runs land cleanly).
  const baseSlug = 'dcm-grading-now-on-iphone-and-android'
  let slug = baseSlug
  for (let i = 1; i < 10; i++) {
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${i}`
  }

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title: 'DCM Grading is now on iPhone and Android',
      subtitle: 'Native mobile apps for iOS and Android, with the same account that already works on the web.',
      excerpt: 'DCM Grading is now available as native apps on the Apple App Store and Google Play. Your account, credits, and collection work across iPhone, Android, and the web with no setup required.',
      content,
      category_id: NEWS_CATEGORY_ID,
      tags: ['app launch', 'mobile app', 'ios', 'android', 'news', 'announcement'],
      meta_title: 'DCM Grading Mobile Apps Now on iOS and Android | DCM Grading',
      meta_description: 'DCM Grading is now available as native apps on the Apple App Store and Google Play. Your account, credits, and collection sync across iPhone, Android, and web.',
      status: 'draft',
      author_name: 'DCM Team',
    })
    .select('id, title, slug, status')
    .single()

  if (error) {
    console.error('Failed to create post:', error.message)
    process.exit(1)
  }

  console.log('Blog post created as DRAFT')
  console.log('  ID:    ', post.id)
  console.log('  Title: ', post.title)
  console.log('  Slug:  ', post.slug)
  console.log('  Status:', post.status)
  console.log('')
  console.log('Review and publish at:')
  console.log(`  https://dcmgrading.com/admin/blog/${post.id}/edit`)
  console.log('')
  console.log('Once published, it will be live at:')
  console.log(`  https://dcmgrading.com/blog/${post.slug}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
