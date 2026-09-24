/**
 * Pure custom-layout offset math (v0.8.4 Phase 3). A node offset is a
 * view-layer shift in SVG units (screen-aligned, before zoom) applied on top
 * of react-d3-tree's automatic position. Offsets live in fileViewStore and
 * fileSettings — never in the roadmap JSON (D-5).
 */

export type Orientation = "TB" | "LR";

export interface Offset {
	dx: number;
	dy: number;
}

export type OffsetMap = Record<string, Offset>;

/** One map per orientation: a TB offset means nothing in LR. */
export interface NodeOffsets {
	TB: OffsetMap;
	LR: OffsetMap;
}

export const ZERO_OFFSET: Offset = Object.freeze({ dx: 0, dy: 0 });

export const EMPTY_NODE_OFFSETS: NodeOffsets = Object.freeze({
	TB: Object.freeze({}),
	LR: Object.freeze({}),
}) as NodeOffsets;

interface CustomLayoutState {
	customLayout: boolean;
	nodeOffsets: NodeOffsets;
}

/** The node's offset as rendered: zero whenever custom layout is off. */
export function effectiveOffset(
	state: CustomLayoutState,
	orientation: Orientation,
	id: string,
): Offset {
	if (!state.customLayout) return ZERO_OFFSET;
	return state.nodeOffsets[orientation][id] ?? ZERO_OFFSET;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanMap(input: unknown): OffsetMap {
	const out: OffsetMap = {};
	if (!isRecord(input)) return out;
	for (const [id, entry] of Object.entries(input)) {
		if (!isRecord(entry)) continue;
		const { dx, dy } = entry;
		if (
			typeof dx === "number" &&
			typeof dy === "number" &&
			Number.isFinite(dx) &&
			Number.isFinite(dy)
		) {
			out[id] = { dx, dy };
		}
	}
	return out;
}

/**
 * Hydration guard for a (possibly hand-edited) settings file: keeps only
 * entries whose dx and dy are finite numbers.
 */
export function clampOffsets(input: unknown): NodeOffsets {
	const raw = isRecord(input) ? input : {};
	return { TB: cleanMap(raw.TB), LR: cleanMap(raw.LR) };
}

/** A pointer delta in screen pixels, in canvas units at zoom factor `k`. */
export function screenDeltaToCanvas(delta: Offset, k: number): Offset {
	return { dx: delta.dx / k, dy: delta.dy / k };
}
