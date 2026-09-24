import type { Offset, Orientation } from "./nodeOffsets";

/**
 * Connector paths for custom layout (v0.8.4 Phase 3). Coordinates are
 * react-d3-tree LAYOUT coordinates (`linkData.source` / `.target`): in LR
 * the library draws a node at translate(y, x), so layout x is vertical.
 */

export interface LayoutPoint {
	x: number;
	y: number;
}

export interface LayoutLink {
	source: LayoutPoint;
	target: LayoutPoint;
}

/**
 * react-d3-tree 3.6.7 `Link.drawStepPath` (lib/esm/Link/index.js:44-49),
 * character for character, so a zero offset changes no connector.
 */
export function stepPath(
	source: LayoutPoint,
	target: LayoutPoint,
	orientation: Orientation,
): string {
	const deltaY = target.y - source.y;
	return orientation === "LR"
		? `M${source.y},${source.x} H${source.y + deltaY / 2} V${target.x} H${target.y}`
		: `M${source.x},${source.y} V${source.y + deltaY / 2} H${target.x} V${target.y}`;
}

/** A screen-aligned offset expressed on the orientation's layout axes. */
function shift(
	p: LayoutPoint,
	o: Offset,
	orientation: Orientation,
): LayoutPoint {
	return orientation === "LR"
		? { x: p.x + o.dy, y: p.y + o.dx }
		: { x: p.x + o.dx, y: p.y + o.dy };
}

/** Moves each endpoint of a link by its node's (screen-aligned) offset. */
export function offsetLink(
	link: LayoutLink,
	offsets: { source: Offset; target: Offset },
	orientation: Orientation,
): LayoutLink {
	return {
		source: shift(link.source, offsets.source, orientation),
		target: shift(link.target, offsets.target, orientation),
	};
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const STEP_SHAPE = {
	TB: /^M[^ ]+ V[^ ]+ H[^ ]+ V[^ ]+$/,
	LR: /^M[^ ]+ H[^ ]+ V[^ ]+ H[^ ]+$/,
};

/**
 * The inverse of `stepPath`: the link endpoints a rendered `d` was drawn
 * from, or null for a path of any other shape. The drag gesture reads the
 * live connectors with it instead of reaching into react-d3-tree state.
 */
export function stepEndpoints(
	d: string | null,
	orientation: Orientation,
): LayoutLink | null {
	if (!d || !STEP_SHAPE[orientation].test(d)) return null;
	const n = (d.match(NUMBER) ?? []).map(Number);
	if (n.length !== 5) return null;
	return orientation === "LR"
		? { source: { x: n[1], y: n[0] }, target: { x: n[3], y: n[4] } }
		: { source: { x: n[0], y: n[1] }, target: { x: n[3], y: n[4] } };
}
