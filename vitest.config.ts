import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  test: {
    // Jest-style globals (describe/it/expect) so existing *.test.ts files run
    // unmodified — professionalGradeMapper.test.ts predates this runner.
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    // Grading calls cost money and are nondeterministic. Unit tests must never
    // reach the network; anything needing a live model belongs in the
    // repeatability harness, which is run deliberately and not on every push.
    exclude: ['node_modules/**', 'dcm-mobile/**', 'scripts/**', '.next/**'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Unit tests are node-environment and import no stylesheets. Without this,
  // Vite discovers postcss.config.mjs (Tailwind v4) and fails to parse it.
  css: { postcss: {} },
})
