'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BlogPost, BlogCategory, BlogPostFormData } from '@/types/blog';
import BlogImageUploader from './BlogImageUploader';
import BlogCollageUploader from './BlogCollageUploader';
import MarkdownToolbar from './MarkdownToolbar';
import BlogPostContent from '@/components/blog/BlogPostContent';

interface BlogPostFormProps {
  post?: BlogPost;
  isEdit?: boolean;
}

export default function BlogPostForm({ post, isEdit = false }: BlogPostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  // Form state
  const [formData, setFormData] = useState<BlogPostFormData>({
    title: post?.title || '',
    subtitle: post?.subtitle || '',
    slug: post?.slug || '',
    excerpt: post?.excerpt || '',
    content: post?.content || '',
    featured_image_path: post?.featured_image_path || '',
    featured_image_alt: post?.featured_image_alt || '',
    category_id: post?.category_id || '',
    tags: post?.tags || [],
    meta_title: post?.meta_title || '',
    meta_description: post?.meta_description || '',
    status: post?.status || 'draft',
    published_at: post?.published_at || '',
    author_name: post?.author_name || 'DCM Team',
  });

  const [tagInput, setTagInput] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageMode, setImageMode] = useState<'single' | 'collage'>('single');
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Insert text at cursor position in content textarea
  const insertAtCursor = (text: string) => {
    const textarea = contentRef.current;
    if (!textarea) {
      // Fallback: append to end
      setFormData(prev => ({ ...prev, content: prev.content + '\n\n' + text }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = formData.content;

    // Insert with newlines for proper spacing
    const before = content.substring(0, start);
    const after = content.substring(end);
    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n\n');
    const needsNewlineAfter = after.length > 0 && !after.startsWith('\n');

    const insertText = (needsNewlineBefore ? '\n\n' : '') + text + (needsNewlineAfter ? '\n\n' : '');
    const newContent = before + insertText + after;

    setFormData(prev => ({ ...prev, content: newContent }));

    // Set cursor position after inserted text
    setTimeout(() => {
      const newPosition = start + insertText.length;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Handle image upload from toolbar
  const handleToolbarImageUpload = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/blog/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url } = await response.json();
      const altText = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      insertAtCursor(`![${altText}](${url})`);
    } catch (err: any) {
      alert(err.message || 'Failed to upload image');
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/admin/blog/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: !isEdit && !prev.slug ? generateSlug(title) : prev.slug,
    }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = false) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        status: publishNow ? 'published' : formData.status,
        published_at: publishNow && !formData.published_at
          ? new Date().toISOString()
          : formData.published_at,
      };

      const url = isEdit
        ? `/api/admin/blog/posts/${post?.id}`
        : '/api/admin/blog/posts';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save post');
      }

      router.push('/admin/blog');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter post title"
              required
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle
            </label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Optional subtitle"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <span className="text-gray-500 mr-2">/blog/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="post-url-slug"
                required
              />
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Brief summary for post cards and SEO"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.excerpt?.length || 0}/300 characters recommended
            </p>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Content <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    !showPreview
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={`px-3 py-1 text-sm font-medium transition-colors border-l border-gray-300 ${
                    showPreview
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* Preview Header */}
                {(formData.title || formData.subtitle) && (
                  <div className="bg-white border-b border-gray-200 px-6 py-6">
                    {formData.title && (
                      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                        {formData.title}
                      </h1>
                    )}
                    {formData.subtitle && (
                      <p className="text-xl text-gray-600">{formData.subtitle}</p>
                    )}
                    <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
                      <span className="font-medium text-gray-900">{formData.author_name || 'DCM Team'}</span>
                      <span>·</span>
                      <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                )}
                {/* Preview Featured Image */}
                {formData.featured_image_path && (
                  <div className="bg-white px-6 py-4 border-b border-gray-200">
                    <div className="aspect-[16/9] relative rounded-lg overflow-hidden">
                      <img
                        src={formData.featured_image_path}
                        alt={formData.featured_image_alt || formData.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                {/* Preview Content */}
                <div className="bg-white p-6 min-h-[400px]">
                  {formData.content ? (
                    <BlogPostContent content={formData.content} />
                  ) : (
                    <p className="text-gray-400 italic">No content to preview. Switch to Write mode to add content.</p>
                  )}
                </div>
                {/* Preview Tags */}
                {formData.tags && formData.tags.length > 0 && (
                  <div className="bg-white px-6 py-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
                <MarkdownToolbar
                  textareaRef={contentRef}
                  content={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  onImageUpload={handleToolbarImageUpload}
                  imageUploading={imageUploading}
                />
                <textarea
                  ref={contentRef}
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={20}
                  className="w-full px-4 py-3 font-mono text-sm border-0 focus:ring-0 focus:outline-none resize-y"
                  placeholder="Write your blog post content using Markdown..."
                  required
                />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {showPreview
                ? 'This is how your post will look when published.'
                : 'Use the toolbar above or type Markdown directly: **bold**, *italic*, [link](url), ## heading'}
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageFileChange}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Actions */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {(formData.status === 'published' || formData.status === 'scheduled') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publish Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.published_at ? formData.published_at.slice(0, 16) : ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    published_at: e.target.value ? new Date(e.target.value).toISOString() : '',
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>

          {/* Featured Image */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Featured Image
              </label>
              {!formData.featured_image_path && (
                <div className="flex rounded border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setImageMode('single')}
                    className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                      imageMode === 'single'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('collage')}
                    className={`px-2 py-0.5 text-xs font-medium transition-colors border-l border-gray-300 ${
                      imageMode === 'collage'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Collage
                  </button>
                </div>
              )}
            </div>
            {imageMode === 'single' ? (
              <BlogImageUploader
                currentImage={formData.featured_image_path}
                onUpload={(url) => setFormData(prev => ({ ...prev, featured_image_path: url }))}
                onRemove={() => setFormData(prev => ({ ...prev, featured_image_path: '' }))}
              />
            ) : (
              formData.featured_image_path ? (
                <BlogImageUploader
                  currentImage={formData.featured_image_path}
                  onUpload={(url) => setFormData(prev => ({ ...prev, featured_image_path: url }))}
                  onRemove={() => setFormData(prev => ({ ...prev, featured_image_path: '' }))}
                />
              ) : (
                <BlogCollageUploader
                  onUpload={(url) => setFormData(prev => ({ ...prev, featured_image_path: url }))}
                />
              )
            )}
            {formData.featured_image_path && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Alt Text
                </label>
                <input
                  type="text"
                  value={formData.featured_image_alt}
                  onChange={(e) => setFormData(prev => ({ ...prev, featured_image_alt: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe the image"
                />
              </div>
            )}
          </div>

          {/* Category */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Add tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-purple-500 hover:text-purple-700"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Author */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Author Name
            </label>
            <input
              type="text"
              value={formData.author_name}
              onChange={(e) => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="DCM Team"
            />
          </div>

          {/* SEO */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">SEO Settings</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Custom title for search engines"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Custom description for search engines"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
