'use client';

import Link from 'next/link';
import BlogPostForm from '@/components/admin/BlogPostForm';

export default function NewBlogPostPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/admin/blog" className="hover:text-purple-600 transition-colors">
            Blog
          </Link>
          <span>/</span>
          <span className="text-gray-900">New Post</span>
        </nav>
        <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <BlogPostForm />
      </div>
    </div>
  );
}
