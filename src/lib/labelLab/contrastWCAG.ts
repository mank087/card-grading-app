/**
 * PROMOTED TO PRODUCTION — June 2026.
 *
 * The implementation now lives at src/lib/contrastWCAG.ts because the
 * production Label Studio uses it for WCAG text-polarity decisions (the
 * Style Gauntlet's "Guard A" paper-test winner). This re-export keeps the
 * Label Lab's imports working unchanged.
 */
export * from '../contrastWCAG'
