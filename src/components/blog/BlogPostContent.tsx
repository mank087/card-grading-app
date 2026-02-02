'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';

interface BlogPostContentProps {
  content: string;
}

export default function BlogPostContent({ content }: BlogPostContentProps) {
  const components = useMemo(
    () => ({
      // Custom heading components with anchor links
      h1: ({ children, ...props }: any) => {
        const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
          <h1 id={id} className="text-3xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24" {...props}>
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }: any) => {
        const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
          <h2 id={id} className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24" {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: any) => {
        const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return (
          <h3 id={id} className="text-xl font-bold text-gray-900 mt-6 mb-3 scroll-mt-24" {...props}>
            {children}
          </h3>
        );
      },
      h4: ({ children, ...props }: any) => (
        <h4 className="text-lg font-bold text-gray-900 mt-5 mb-2" {...props}>
          {children}
        </h4>
      ),

      // Paragraphs
      p: ({ children, ...props }: any) => (
        <p className="text-gray-700 leading-relaxed mb-4" {...props}>
          {children}
        </p>
      ),

      // Links
      a: ({ href, children, ...props }: any) => (
        <a
          href={href}
          className="text-purple-600 hover:text-purple-800 underline underline-offset-2"
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      ),

      // Images with Next.js Image optimization
      img: ({ src, alt, ...props }: any) => {
        if (!src) return null;
        return (
          <span className="block my-6">
            <Image
              src={src}
              alt={alt || ''}
              width={800}
              height={450}
              className="rounded-lg shadow-md mx-auto"
              style={{ width: '100%', height: 'auto' }}
            />
            {alt && (
              <span className="block text-center text-sm text-gray-500 mt-2 italic">
                {alt}
              </span>
            )}
          </span>
        );
      },

      // Lists
      ul: ({ children, ...props }: any) => (
        <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: any) => (
        <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-2 ml-4" {...props}>
          {children}
        </ol>
      ),
      li: ({ children, ...props }: any) => (
        <li className="text-gray-700" {...props}>
          {children}
        </li>
      ),

      // Blockquotes
      blockquote: ({ children, ...props }: any) => (
        <blockquote
          className="border-l-4 border-purple-500 pl-4 py-2 my-4 bg-purple-50 rounded-r-lg italic text-gray-700"
          {...props}
        >
          {children}
        </blockquote>
      ),

      // Code blocks
      code: ({ className, children, ...props }: any) => {
        const isInline = !className;
        if (isInline) {
          return (
            <code
              className="bg-gray-100 text-purple-600 px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code
            className={`block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4 ${className}`}
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children, ...props }: any) => (
        <pre className="bg-gray-900 rounded-lg overflow-x-auto my-4" {...props}>
          {children}
        </pre>
      ),

      // Tables
      table: ({ children, ...props }: any) => (
        <div className="overflow-x-auto my-6">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props}>
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }: any) => (
        <thead className="bg-gray-50" {...props}>
          {children}
        </thead>
      ),
      th: ({ children, ...props }: any) => (
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" {...props}>
          {children}
        </th>
      ),
      td: ({ children, ...props }: any) => (
        <td className="px-4 py-3 text-sm text-gray-700 border-t border-gray-200" {...props}>
          {children}
        </td>
      ),

      // Horizontal rule
      hr: () => <hr className="my-8 border-gray-200" />,

      // Strong and emphasis
      strong: ({ children, ...props }: any) => (
        <strong className="font-semibold text-gray-900" {...props}>
          {children}
        </strong>
      ),
      em: ({ children, ...props }: any) => (
        <em className="italic" {...props}>
          {children}
        </em>
      ),
    }),
    []
  );

  return (
    <div className="prose prose-lg max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
