/** Stamp the policy actually used; never reconstruct old settings from today's env. */
export function gradeReviewCaptureFields() {
  if (process.env.GRADE_REVIEW_CAPTURE_ENABLED !== 'true') return {};
  return {
    grade_review_policy_context: {
      version: 'centering-v9.23',
      captured_at: new Date().toISOString(),
      centering: process.env.CENTERING_POLICY || 'shadow',
      r0: process.env.CENTERING_R0 || 'enforce',
      cv: process.env.CV_CENTERING_MODE || 'shadow',
    },
  };
}
