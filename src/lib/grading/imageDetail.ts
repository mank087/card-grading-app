/**
 * Image detail level for every vision call in the grading pipeline.
 *
 * WHY THIS IS A KNOB: `detail` was pinned to 'high' in v8.8 because on the
 * GPT-4o-class stack `auto` silently varied the resolution tier per call. That
 * reasoning does not survive the move to gpt-5.6-luna. Per OpenAI's docs:
 *
 *   - 'high'     — "can resize images under their finite limits"
 *   - 'original' — "preserves the input dimensions and does not resize the
 *                   image to a pixel-dimension or patch-budget limit"
 *   - 'auto'/omitted on gpt-5.5 and gpt-5.6 are "equivalent to `original`"
 *
 * So on luna the v8.8 pin is now the thing DOWNSCALING our cards, and the
 * value we removed is the one that would not. That inverts the whole premise
 * of the zoom-crop pass, which exists to route around a ~768px short side.
 *
 * Left at 'high' by default so nothing changes without an explicit decision.
 * Set GRADING_IMAGE_DETAIL=original to test or roll forward.
 *
 * NOTE: 'original' is only meaningful on gpt-5.4 and later. On gpt-5.1 (the
 * old baseline) it is not documented as supported.
 */
export type ImageDetail = 'high' | 'low' | 'auto' | 'original';

const VALID: ImageDetail[] = ['high', 'low', 'auto', 'original'];

export function imageDetail(): ImageDetail {
  const raw = (process.env.GRADING_IMAGE_DETAIL || '').trim().toLowerCase() as ImageDetail;
  return VALID.includes(raw) ? raw : 'high';
}
