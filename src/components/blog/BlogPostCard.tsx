'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BlogPost } from '@/types/blog';
import CategoryBadge from './CategoryBadge';

interface BlogPostCardProps {
  post: BlogPost;
  featured?: boolean;
}

export default function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  if (featured) {
    return (
      <article className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
        <Link href={`/blog/${post.slug}`} className="block">
          <div className="md:flex">
            {/* Featured Image */}
            <div className="md:w-1/2 relative">
              <div className="aspect-[16/9] md:aspect-auto md:h-full relative bg-gray-100">
                {post.featured_image_path ? (
                  <Image
                    src={post.featured_image_path}
                    alt={post.featured_image_alt || post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-16 h-16 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
              {post.category && (
                <div className="mb-3">
                  <CategoryBadge category={post.category} size="sm" clickable={false} />
                </div>
              )}

              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-purple-600 transition-colors">
                {post.title}
              </h2>

              {post.subtitle && (
                <p className="text-lg text-gray-600 mb-3 line-clamp-1">
                  {post.subtitle}
                </p>
              )}

              {post.excerpt && (
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
              )}

              <div className="flex items-center text-sm text-gray-500 mt-auto">
                <span>{post.author_name}</span>
                <span className="mx-2">·</span>
                <time dateTime={post.published_at || undefined}>{formattedDate}</time>
                <span className="mx-2">·</span>
                <span>{post.read_time_minutes} min read</span>
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group">
      <Link href={`/blog/${post.slug}`} className="block">
        {/* Image */}
        <div className="aspect-[16/9] relative bg-gray-100">
          {post.featured_image_path ? (
            <Image
              src={post.featured_image_path}
              alt={post.featured_image_alt || post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {post.category && (
            <div className="mb-2">
              <CategoryBadge category={post.category} size="sm" clickable={false} />
            </div>
          )}

          <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center text-xs text-gray-500">
            <time dateTime={post.published_at || undefined}>{formattedDate}</time>
            <span className="mx-2">·</span>
            <span>{post.read_time_minutes} min read</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
