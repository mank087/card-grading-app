'use client';

import { useEffect, useState } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Extract headings from markdown content
  useEffect(() => {
    const headingRegex = /^\s*(#{2,3})\s+(.+)$/gm;
    const extractedItems: TOCItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, ''); // Remove markdown formatting
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      extractedItems.push({ id, text, level });
    }

    setItems(extractedItems);
  }, [content]);

  // Track active heading on scroll
  useEffect(() => {
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
  }, [items]);

  if (items.length < 3) {
    return null;
  }

  return (
    <nav className="sticky top-24">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Table of Contents
      </h3>
      <ul className="space-y-2 border-l-2 border-gray-200">
        {items.map((item) => (
          <li
            key={item.id}
            className={`${item.level === 3 ? 'pl-6' : 'pl-4'}`}
          >
            <a
              href={`#${item.id}`}
              className={`block text-sm transition-colors duration-200 ${
                activeId === item.id
                  ? 'text-purple-600 font-medium border-l-2 border-purple-600 -ml-[2px] pl-4'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: 'smooth',
                });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
