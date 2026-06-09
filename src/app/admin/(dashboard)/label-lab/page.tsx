/**
 * Label Lab — admin-only closed environment for testing new label
 * rendering approaches before promoting them to the production Label
 * Studio.
 *
 * v1 scope:
 *   - Modern slab front + back only
 *   - Side-by-side: current production canvas raster vs new react-pdf
 *     vector render
 *   - WCAG contrast scoring across the gradient
 *   - Print-tuned color tweaks toggle
 *
 * Future iterations: other label styles (traditional, fold-over,
 * Avery, foldable), mobile parity test rig, batch print comparison.
 */
import LabelLabClient from './LabelLabClient'

export default function LabelLabPage() {
  return <LabelLabClient />
}
