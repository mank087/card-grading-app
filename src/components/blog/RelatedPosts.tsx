'use client';

import { useEffect, useState } from 'react';
import { BlogPost } from '@/types/blog';
import BlogPostCard from './BlogPostCard';

interface RelatedPostsProps {
  currentPostId: string;
  categoryId?: string | null;
  tags?: string[];
}

export default function RelatedPosts({ currentPostId, categoryId, tags }: RelatedPostsProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedPosts = async () => {
      try {
        // Try to fetch posts from the same category first
        const url = '/api/blog/posts?limit=3';
        if (categoryId) {
          // Need to get category slug first - for now just fetch recent posts
          // This could be optimized with a dedicated related posts API endpoint
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // Filter out the current post
          const filteredPosts = data.posts.filter(
            (post: BlogPost) => post.id !== currentPostId
          );
          setPosts(filteredPosts.slice(0, 3));
        }
      } catch (error) {
        console.error('Error fetching related posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedPosts();
  }, [currentPostId, categoryId, tags]);

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
