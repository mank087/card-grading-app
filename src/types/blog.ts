/**
 * Blog System TypeScript Types
 * Defines interfaces for blog posts and categories
 */

export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  post_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content: string;
  featured_image_path: string | null;
  featured_image_alt: string | null;
  category_id: string | null;
  category?: BlogCategory;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  published_at: string | null;
  author_name: string;
  view_count: number;
  read_time_minutes: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// API response types
export interface BlogPostsResponse {
  posts: BlogPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface BlogCategoriesResponse {
  categories: BlogCategory[];
}

// Form data for creating/editing posts
export interface BlogPostFormData {
  title: string;
  subtitle?: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image_path?: string;
  featured_image_alt?: string;
  category_id?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  published_at?: string;
  author_name?: string;
}
