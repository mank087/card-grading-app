/**
 * Slabby Lab — admin-only scene composer for DCM's animated mascot.
 *
 * Build a sequence of "beats" (expression + motion + text overlays +
 * background image), preview it live at full fidelity via @remotion/player,
 * then export the scene JSON for MP4 rendering in the slabby/ workspace.
 */
import SlabbyLabClient from './SlabbyLabClient'

export default function SlabbyLabPage() {
  return <SlabbyLabClient />
}
