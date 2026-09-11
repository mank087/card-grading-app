'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractHeadings } from '@/lib/seo/blogSchema';

interface TableOfContentsProps {
  content: string;
  /**
   * sidebar: sticky list for the desktop aside (default).
   * inline:  collapsible block placed above the article body for small
   *          screens, open by default so the links are in the HTML.
   */
  variant?: 'sidebar' | 'inline';
}

/**
 * Headings are extracted synchronously (useMemo) so the list is part of the
 * server-rendered HTML; only the active-heading highlight needs the browser.
 */
export default function TableOfContents({ content, variant = 'sidebar' }: TableOfContentsProps) {
  const items = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>('');

  // Track active heading on scroll
  useEffect(() => {
    if (variant !== 'sidebar' || items.length < 3) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0% -80% 0%',
        threshold: 0,
      }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items, variant]);

  if (items.length < 3) {
    return null;
  }

  const list = (
    <ul className="space-y-2 border-l-2 border-gray-200">
      {items.map((item) => (
        <li key={item.id} className={`${item.level === 3 ? 'pl-6' : 'pl-4'}`}>
          <a
            href={`#${item.id}`}
            aria-current={activeId === item.id ? 'location' : undefined}
            className={`block text-sm transition-colors duration-200 ${
              activeId === item.id
                ? 'text-purple-600 font-medium border-l-2 border-purple-600 -ml-[2px] pl-4'
                : 'text-gray-600 hover:text-purple-600'
            }`}
            onClick={(e) => {
              const el = document.getElementById(item.id);
              if (!el) return;
              e.preventDefault();
              el.scrollIntoView({ behavior: 'smooth' });
              history.replaceState(null, '', `#${item.id}`);
            }}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );

  if (variant === 'inline') {
    return (
      <details open className="lg:hidden mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4" role="navigation" aria-label="Article contents">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 uppercase tracking-wider">
          In this article
        </summary>
        <div className="mt-3">{list}</div>
      </details>
    );
  }

  return (
    <div role="navigation" className="sticky top-24" aria-label="Article contents">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Table of Contents
      </h3>
      {list}
    </div>
  );
}
