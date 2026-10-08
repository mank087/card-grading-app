'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BlogPost, BlogCategory } from '@/types/blog';

/** The narrow row shape the list API returns. */
type BlogPostRow = Pick<BlogPost, 'id' | 'title' | 'slug' | 'status' | 'published_at' | 'view_count' | 'updated_at'> & {
  category?: Pick<BlogCategory, 'name' | 'color'> | null;
};

/** "Scheduled" posts are stored as published with a future published_at. */
const displayStatus = (post: BlogPostRow): BlogPost['status'] =>
  post.status === 'published' && post.published_at && new Date(post.published_at).getTime() > Date.now()
    ? 'scheduled'
    : post.status;

type SortKey = 'title' | 'category' | 'status' | 'published_at' | 'view_count';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [search, setSearch] = useState('');
  // The input updates `search` immediately; fetches use the debounced copy.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Incremented per request so a slow, stale response can't overwrite a newer one.
  const requestIdRef = useRef(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // null = default order (most recently updated first)
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchPosts();
  }, [pagination.page, debouncedSearch, statusFilter, sortBy, sortDir]);

  // Click a header to sort by it; click again to flip the direction.
  // Text columns start A to Z, dates and views start newest/highest.
  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'published_at' || key === 'view_count' ? 'desc' : 'asc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => {
    const active = sortBy === sortKey;
    return (
      <th
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900 ${active ? 'text-gray-900' : ''}`}
        >
          {label}
          <span aria-hidden="true" className={active ? '' : 'opacity-30'}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲▼'}
          </span>
        </button>
      </th>
    );
  };

  const fetchPosts = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
        search: debouncedSearch,
      });
      if (sortBy) {
        params.set('sort', sortBy);
        params.set('dir', sortDir);
      }

      const response = await fetch(`/api/admin/blog/posts?${params}`);
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setFetchError(data?.error || `Failed to load posts (HTTP ${response.status})`);
        return;
      }
      const data = await response.json();
      if (requestId !== requestIdRef.current) return;
      setFetchError(null);
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching posts:', error);
      setFetchError('Failed to load posts');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/blog/posts/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDeletePostId(null);
        // Refetch so pagination totals and the page contents stay right. If
        // this was the last row on a later page, step back a page (the page
        // change triggers the refetch).
        if (posts.length === 1 && pagination.page > 1) {
          setPagination(prev => ({ ...prev, page: prev.page - 1 }));
        } else {
          fetchPosts();
        }
      } else {
        alert('Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800' },
      published: { bg: 'bg-green-100', text: 'text-green-800' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800' },
      archived: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    };
    return badges[status] || badges.draft;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-600 mt-1">Manage your blog content</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {fetchError}
        </div>
      )}

      {/* Posts Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 mt-2">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first blog post.</p>
          <Link
            href="/admin/blog/new"
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Create First Post
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Title" sortKey="title" />
                  <SortHeader label="Category" sortKey="category" />
                  <SortHeader label="Status" sortKey="status" />
                  <SortHeader label="Published" sortKey="published_at" />
                  <SortHeader label="Views" sortKey="view_count" />
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {posts.map((post) => {
                  const status = displayStatus(post);
                  const statusBadge = getStatusBadge(status);
                  return (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-[300px]">
                            {post.title}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-[300px]">
                            /blog/{post.slug}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {post.category ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${post.category.color}15`,
                              color: post.category.color,
                            }}
                          >
                            {post.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(post.published_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {post.view_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status === 'published' && (
                            <Link
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              className="text-gray-500 hover:text-gray-700"
                              title="View live post"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </Link>
                          )}
                          <Link
                            href={`/admin/blog/${post.id}/edit`}
                            className="text-purple-600 hover:text-purple-800"
                            title="Edit post"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => setDeletePostId(post.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete post"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} posts
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.total_pages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletePostId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Post</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePostId(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletePostId)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
