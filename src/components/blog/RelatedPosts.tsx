'use client';

import { useEffect, useState } from 'react';
import { BlogPost } from '@/types/blog';
import BlogPostCard from './BlogPostCard';

interface RelatedPostsProps {
  currentPostId: string;
  categoryId?: string | null;
  /** Category slug — /api/blog/posts filters by slug, not id. */
  categorySlug?: string | null;
  tags?: string[];
}

export default function RelatedPosts({ currentPostId, categorySlug, tags }: RelatedPostsProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable dependency: the array identity changes on every render otherwise.
  const tagKey = (tags || []).join(',');

  useEffect(() => {
    let cancelled = false;

    const fetchPage = async (query: string): Promise<BlogPost[]> => {
      const response = await fetch(`/api/blog/posts?${query}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.posts || []) as BlogPost[];
    };

    const fetchRelatedPosts = async () => {
      try {
        const collected: BlogPost[] = [];
        const seen = new Set<string>([currentPostId]);

        const add = (candidates: BlogPost[]) => {
          for (const post of candidates) {
            if (seen.has(post.id)) continue;
            seen.add(post.id);
            collected.push(post);
            if (collected.length >= 3) return;
          }
        };

        // Most topical first: same category, then a shared tag, then recent.
        if (categorySlug) {
          add(await fetchPage(`limit=4&category=${encodeURIComponent(categorySlug)}`));
        }
        const firstTag = (tags || [])[0];
        if (collected.length < 3 && firstTag) {
          add(await fetchPage(`limit=4&tag=${encodeURIComponent(firstTag)}`));
        }
        if (collected.length < 3) {
          add(await fetchPage('limit=4'));
        }

        if (!cancelled) setPosts(collected.slice(0, 3));
      } catch (error) {
        console.error('Error fetching related posts:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRelatedPosts();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPostId, categorySlug, tagKey]);

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
