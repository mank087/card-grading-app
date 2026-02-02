'use client';

import Link from 'next/link';
import { BlogCategory } from '@/types/blog';

interface CategoryBadgeProps {
  category: BlogCategory;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
}

export default function CategoryBadge({
  category,
  size = 'md',
  clickable = true,
}: CategoryBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const baseClasses = `inline-flex items-center font-medium rounded-full transition-colors`;
  const colorStyle = {
    backgroundColor: `${category.color}15`,
    color: category.color,
  };

  if (clickable) {
    return (
      <Link
        href={`/blog/category/${category.slug}`}
        className={`${baseClasses} ${sizeClasses[size]} hover:opacity-80`}
        style={colorStyle}
      >
        {category.name}
      </Link>
    );
  }

  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]}`}
      style={colorStyle}
    >
      {category.name}
    </span>
  );
}
