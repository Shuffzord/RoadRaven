const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/**
 * A rect's centre as a percentage of the viewport, clamped to 0-100. Used as
 * the capture's CSS `object-position`: with `object-fit: cover`, a point at
 * p% of the image aligned at p% of the box is always inside the box.
 */
export function focalPosition(
	rect: { x: number; y: number; width: number; height: number },
	viewport: { width: number; height: number },
): { x: number; y: number } {
	return {
		x: clampPercent(((rect.x + rect.width / 2) / viewport.width) * 100),
		y: clampPercent(((rect.y + rect.height / 2) / viewport.height) * 100),
	};
}
