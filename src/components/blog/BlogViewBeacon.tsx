'use client';

import { useEffect } from 'react';

/**
 * Counts one view of a blog post: POST /api/blog/view once per page view,
 * skipped on reloads within the same browser session (sessionStorage guard
 * per slug). Renders nothing, so the post page stays fully static (ISR).
 */
export default function BlogViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `dcm_blog_viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked (private mode etc.): still count the view.
    }

    const body = JSON.stringify({ slug });
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon('/api/blog/view', body)) {
        return;
      }
    } catch {
      // Fall through to fetch.
    }
    fetch('/api/blog/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
