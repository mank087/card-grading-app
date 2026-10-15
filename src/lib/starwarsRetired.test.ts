import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import nextConfig from '../../next.config';
import { categoryToRouteSlug } from './postGradeEmailTemplates';

/**
 * Star Wars is an Other sub-category (category='Other', sub_category='Star
 * Wars'), not a grading category. The abandoned Star Wars category's route,
 * API and prompt were deleted; old links and any stray 'Star Wars' category
 * value must land on the Other card page.
 */
const root = path.resolve(__dirname, '../..');

describe('retired Star Wars category', () => {
  it('routes a Star Wars category value to /other', () => {
    expect(categoryToRouteSlug('Star Wars')).toBe('other');
    expect(categoryToRouteSlug('starwars')).toBe('other');
    expect(categoryToRouteSlug('Other')).toBe('other');
  });

  it('permanently redirects old /starwars/:id card links to /other/:id', async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual(
      expect.objectContaining({ source: '/starwars/:id', destination: '/other/:id', permanent: true }),
    );
  });

  it('has no Star Wars route, API or prompt delta on disk', () => {
    for (const p of ['src/app/starwars', 'src/app/api/starwars', 'prompts/starwars_delta_v5.txt']) {
      expect(fs.existsSync(path.join(root, p)), p).toBe(false);
    }
  });

  it('mobile route-slug twin has no starwars route either', () => {
    // Text check: dcm-mobile imports Expo modules that CI cannot load.
    const src = fs.readFileSync(path.join(root, 'dcm-mobile/lib/constants.ts'), 'utf8');
    expect(src).not.toMatch(/return 'starwars'/);
  });
});
