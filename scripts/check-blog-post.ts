import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBlogPost() {
  const slug = 'getting-the-most-out-of-dcm-grading';

  // 1. Check if post exists at all
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, status, published_at, created_at, updated_at')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error querying post:', error.message);
    console.error('Code:', error.code);

    // Check if table exists at all
    const { data: anyPost, error: anyError } = await supabase
      .from('blog_posts')
      .select('id, title, slug, status, published_at')
      .limit(5);

    if (anyError) {
      console.error('\nCannot query blog_posts table at all:', anyError.message);
    } else {
      console.log(`\nblog_posts table exists. Found ${anyPost?.length || 0} posts total:`);
      anyPost?.forEach(p => {
        console.log(`  - [${p.status}] "${p.title}" (slug: ${p.slug}, published: ${p.published_at})`);
      });
    }
    return;
  }

  console.log('=== POST FOUND ===');
  console.log('Title:', post.title);
  console.log('Slug:', post.slug);
  console.log('Status:', post.status);
  console.log('Published at:', post.published_at);
  console.log('Created at:', post.created_at);

  // 2. Check if it would pass the public query filters
  const now = new Date().toISOString();
  const isPublished = post.status === 'published';
  const isPublishedDatePast = post.published_at && post.published_at <= now;

  console.log('\n=== VISIBILITY CHECK ===');
  console.log('Is published?', isPublished, `(status: "${post.status}")`);
  console.log('Published date in past?', isPublishedDatePast, `(published_at: ${post.published_at}, now: ${now})`);
  console.log('Would be visible?', isPublished && isPublishedDatePast);

  if (!isPublished) {
    console.log('\nFIX: Post status needs to be "published". Currently:', post.status);
  }
  if (!isPublishedDatePast) {
    console.log('\nFIX: published_at needs to be in the past (or null means not published yet)');
  }
}

checkBlogPost();
