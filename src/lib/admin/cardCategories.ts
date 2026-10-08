// Card categories for the admin Cards/Users pages, derived from the pop
// report's list (the most complete source of truth) so stat tiles, the
// category filter, and row links cover every category the app grades.

import { POP_CATEGORIES } from '@/lib/popReport'
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates'

const TOP_LEVEL = POP_CATEGORIES.filter(c => !c.dbSubCategory)

/** Every `cards.category` value that routes to /sports (incl. 'Sports' itself). */
export const SPORT_DB_CATEGORIES: string[] = TOP_LEVEL
  .filter(c => categoryToRouteSlug(c.dbCategory) === 'sports')
  .map(c => c.dbCategory)

/** Non-sport top-level categories, in pop-report order (Other last). */
export const NON_SPORT_DB_CATEGORIES: string[] = TOP_LEVEL
  .filter(c => categoryToRouteSlug(c.dbCategory) !== 'sports')
  .map(c => c.dbCategory)

/** Admin filter / stat-tile groups: Sports (all sport subcategories) + each non-sport category. */
export const ADMIN_CATEGORY_GROUPS: string[] = ['Sports', ...NON_SPORT_DB_CATEGORIES]

export function isSportCategory(category: string | null | undefined): boolean {
  return !!category && SPORT_DB_CATEGORIES.includes(category)
}

/** Public card-page path, matching the sitemap (Star Wars cards render under /other). */
export function adminCardHref(category: string | null | undefined, cardId: string): string {
  const slug = categoryToRouteSlug(category)
  return `/${slug === 'starwars' ? 'other' : slug}/${cardId}`
}
