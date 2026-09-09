/**
 * @deprecated Import `@/components/grading/GradeBadge` directly.
 *
 * This module used to render its own badge from `GradeColors` (a 10 was
 * solid green), which contradicted the Heritage label's rainbow 10. It now
 * re-exports the single shared interface chip so every existing call site
 * gets parity without a rename; the props are a superset of the old ones.
 */
export { default, gradeInk, gradeConditionName } from '@/components/grading/GradeBadge'
export type { GradeBadgeProps, GradeBadgeSize } from '@/components/grading/GradeBadge'
