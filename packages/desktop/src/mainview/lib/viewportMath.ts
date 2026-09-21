/**
 * Pure viewport maths shared by the canvas and its commands.
 *
 * The zoom extent has to be agreed on in exactly one place: react-d3-tree
 * clamps the scale it renders to `scaleExtent` but happily accepts a `zoom`
 * prop outside it, so a programmatic target computed against an unclamped
 * zoom lands the camera somewhere the tree never goes (RC7).
 */

/** User decision D4: max zoom stays 1. */
export const SCALE_EXTENT: { min: number; max: number } = { min: 0.1, max: 1 };

/** Clamp a programmatic zoom target into the extent the tree will render. */
export function clampZoom(zoom: number): number {
	return Math.min(SCALE_EXTENT.max, Math.max(SCALE_EXTENT.min, zoom));
}
