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

/**
 * Pan and fit maths on measured SCREEN rectangles (v0.8.1 A4).
 *
 * Feeding these functions `getBoundingClientRect()` output rather than
 * react-d3-tree layout points is what makes them orientation-, zoom- and
 * card-size agnostic: horizontal trees render nodes at `translate(y, x)`
 * (RC2), and the card's visual centre sits ~16 local px above and ~10 left of
 * its layout point inside the 240x100 foreignObject (RC11). A measured rect
 * has neither problem, and jsdom's lack of layout stays confined to the thin
 * DOM glue in the canvas controller.
 */

export interface ScreenRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * How a reveal positions the card:
 * - `nearest` — only pan far enough to land the card's centre inside the
 *   comfort zone (UAT decision, commit aad416e: recentring on every arrow key
 *   whips the camera).
 * - `center`  — put the card's centre on the container's centre (jump-to
 *   actions: search, event log).
 * - `none`    — make the card mounted, but leave the camera where it is.
 */
export type PanAlign = "center" | "nearest" | "none";

/** Comfort-zone inset per side: the middle 50% of the container. */
const COMFORT_ZONE_INSET = 0.25;
/** Breathing room left around a fitted tree. */
const FIT_MARGIN = 0.85;
/** Smallest zoom a fit will choose, however wide the tree is. */
const MIN_FIT_ZOOM = 0.2;

function centreOf(rect: ScreenRect): { x: number; y: number } {
	return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

function clamp(value: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, value));
}

/** Screen-space translate delta that reveals `card` inside `container`. */
export function computePanDelta(
	card: ScreenRect,
	container: ScreenRect,
	align: PanAlign,
): { dx: number; dy: number } {
	if (align === "none") return { dx: 0, dy: 0 };
	const centre = centreOf(card);
	const width = container.right - container.left;
	const height = container.bottom - container.top;
	if (align === "center") {
		return {
			dx: container.left + width / 2 - centre.x,
			dy: container.top + height / 2 - centre.y,
		};
	}
	const targetX = clamp(
		centre.x,
		container.left + width * COMFORT_ZONE_INSET,
		container.right - width * COMFORT_ZONE_INSET,
	);
	const targetY = clamp(
		centre.y,
		container.top + height * COMFORT_ZONE_INSET,
		container.bottom - height * COMFORT_ZONE_INSET,
	);
	return { dx: targetX - centre.x, dy: targetY - centre.y };
}

/**
 * Viewport that fits every mounted card, as a translate + zoom for the tree.
 * `transform` is the live camera the rects were measured under; returns null
 * when nothing is mounted.
 */
export function computeFit(
	cards: ScreenRect[],
	container: ScreenRect,
	transform: { x: number; y: number; k: number },
): { translate: { x: number; y: number }; zoom: number } | null {
	if (cards.length === 0) return null;
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	for (const card of cards) {
		if (card.left < left) left = card.left;
		if (card.top < top) top = card.top;
		if (card.right > right) right = card.right;
		if (card.bottom > bottom) bottom = card.bottom;
	}
	// Screen -> the tree's local coordinates, which the translate is expressed
	// in: screenX = container.left + localX * k + transform.x.
	const localLeft = (left - container.left - transform.x) / transform.k;
	const localRight = (right - container.left - transform.x) / transform.k;
	const localTop = (top - container.top - transform.y) / transform.k;
	const localBottom = (bottom - container.top - transform.y) / transform.k;
	const width = container.right - container.left;
	const height = container.bottom - container.top;
	const zoom = clampZoom(
		Math.max(
			MIN_FIT_ZOOM,
			Math.min(
				(width * FIT_MARGIN) / (localRight - localLeft),
				(height * FIT_MARGIN) / (localBottom - localTop),
			),
		),
	);
	return {
		translate: {
			x: width / 2 - ((localLeft + localRight) / 2) * zoom,
			y: height / 2 - ((localTop + localBottom) / 2) * zoom,
		},
		zoom,
	};
}
