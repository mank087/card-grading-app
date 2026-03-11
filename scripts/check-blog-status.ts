import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Also test with anon key (what the public blog pages use)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkBlogStatus() {
  console.log('=== BLOG DIAGNOSTICS ===\n');

  // 1. Check categories (admin)
  const { data: categories, error: catError } = await supabaseAdmin
    .from('blog_categories')
    .select('*');

  console.log('--- Categories (admin/service_role) ---');
  if (catError) {
    console.error('ERROR:', catError.message);
    console.error('Code:', catError.code);
    console.error('Details:', catError.details);
  } else {
    console.log(`Found ${categories?.length || 0} categories`);
    categories?.forEach(c => console.log(`  - ${c.name} (${c.slug})`));
  }

  // 2. Check categories (anon - what public pages use)
  const { data: anonCats, error: anonCatError } = await supabaseAnon
    .from('blog_categories')
    .select('*');

  console.log('\n--- Categories (anon/public) ---');
  if (anonCatError) {
    console.error('ERROR:', anonCatError.message);
    console.error('Code:', anonCatError.code);
    console.error('This means RLS is blocking public reads!');
  } else {
    console.log(`Found ${anonCats?.length || 0} categories`);
  }

  // 3. Check all blog posts (admin)
  const { data: allPosts, error: postsError } = await supabaseAdmin
    .from('blog_posts')
    .select('id, title, slug, status, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n--- All Blog Posts (admin/service_role) ---');
  if (postsError) {
    console.error('ERROR:', postsError.message);
    console.error('Code:', postsError.code);
    console.error('Details:', postsError.details);
  } else {
    console.log(`Found ${allPosts?.length || 0} total posts`);
    allPosts?.forEach(p => {
      console.log(`  - [${p.status}] "${p.title}" (slug: ${p.slug})`);
      console.log(`    published_at: ${p.published_at}, created_at: ${p.created_at}`);
    });
  }

  // 4. Check published posts (anon - what public pages use)
  const { data: publicPosts, error: publicError } = await supabaseAnon
    .from('blog_posts')
    .select('id, title, slug, status, published_at')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(20);

  console.log('\n--- Published Blog Posts (anon/public) ---');
  if (publicError) {
    console.error('ERROR:', publicError.message);
    console.error('Code:', publicError.code);
    console.error('This means RLS is blocking public reads on blog_posts!');
  } else {
    console.log(`Found ${publicPosts?.length || 0} published posts visible to public`);
    publicPosts?.forEach(p => {
      console.log(`  - "${p.title}" (${p.slug})`);
    });
  }

  // 5. Check RLS policies
  const { data: policies, error: policyError } = await supabaseAdmin
    .rpc('get_policies', undefined)
    .catch(() => ({ data: null, error: { message: 'RPC not available' } as any }));

  if (!policies) {
    // Try direct SQL approach
    console.log('\n--- RLS Policy Check (via pg_policies) ---');
    const { data: pgPolicies, error: pgError } = await supabaseAdmin
      .from('pg_policies' as any)
      .select('*')
      .in('tablename', ['blog_posts', 'blog_categories']);

    if (pgError) {
      console.log('Cannot directly query policies (expected). Check Supabase dashboard.');
    } else {
      console.log('Policies:', JSON.stringify(pgPolicies, null, 2));
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const totalPosts = allPosts?.length || 0;
  const publishedPosts = publicPosts?.length || 0;
  const totalCategories = categories?.length || 0;
  const publicCategories = anonCats?.length || 0;

  if (totalPosts === 0) {
    console.log('ISSUE: No blog posts exist in the database at all. Need to create or seed posts.');
  } else if (publishedPosts === 0 && totalPosts > 0) {
    console.log('ISSUE: Posts exist but none are published/visible. Check status and published_at dates.');
  }

  if (totalCategories === 0) {
    console.log('ISSUE: No blog categories exist.');
  } else if (publicCategories === 0 && totalCategories > 0) {
    console.log('ISSUE: Categories exist but RLS is blocking public access.');
  }

  if (anonCatError) {
    console.log('ISSUE: RLS blocking public access to blog_categories table.');
  }
  if (publicError) {
    console.log('ISSUE: RLS blocking public access to blog_posts table.');
  }

  if (publishedPosts > 0 && publicCategories > 0) {
    console.log('Blog data looks OK. Issue may be in the frontend or build.');
  }
}

checkBlogStatus();
