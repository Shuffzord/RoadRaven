/**
 * Pure per-file layout knobs (v0.8.4 Phase 2): defaults, valid ranges, input
 * clamping, and the react-d3-tree `separation`/`nodeSize` config derived from
 * them. Canvas.tsx reads `treeLayoutFor`; it does no arithmetic of its own.
 */

export interface LayoutKnobs {
	siblingGap: number;
	depthGap: number;
	density: "comfortable" | "compact";
}

/**
 * Phase 1 set `separation.siblings` to 1.1 (Canvas.tsx); Phase 7 (UAT-2)
 * widened both gaps after owner UAT found the layout too tight.
 */
export const KNOB_DEFAULTS: LayoutKnobs = {
	siblingGap: 1.2,
	depthGap: 1.6,
	density: "comfortable",
};

export const KNOB_RANGES = {
	siblingGap: { min: 0.8, max: 2.0, step: 0.1 },
	depthGap: { min: 0.6, max: 2.0, step: 0.1 },
} as const;

/** Today's ratio (Canvas.tsx, pre-Phase-2): nonSiblings = siblings * 1.3. */
const NONSIBLING_RATIO = 1.3;
const BASE_NODE_SIZE = { x: 240, y: 100 };

function clampNumber(
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

/**
 * Tolerates missing/NaN/out-of-range/wrong-type input, so a hand-edited
 * settings.json can never push the layout outside KNOB_RANGES.
 */
export function clampKnobs(input: unknown): LayoutKnobs {
	const raw = (input && typeof input === "object" ? input : {}) as Record<
		string,
		unknown
	>;
	return {
		siblingGap: clampNumber(
			raw.siblingGap,
			KNOB_DEFAULTS.siblingGap,
			KNOB_RANGES.siblingGap.min,
			KNOB_RANGES.siblingGap.max,
		),
		depthGap: clampNumber(
			raw.depthGap,
			KNOB_DEFAULTS.depthGap,
			KNOB_RANGES.depthGap.min,
			KNOB_RANGES.depthGap.max,
		),
		density: raw.density === "compact" ? "compact" : KNOB_DEFAULTS.density,
	};
}

export interface TreeLayoutConfig {
	separation: { siblings: number; nonSiblings: number };
	nodeSize: { x: number; y: number };
}

// react-d3-tree remounts its layout whenever the separation/nodeSize prop
// identity changes (Perf, Phase 2 brief) — expected on a slider change, not
// on a re-render the knobs didn't cause. Canvas.tsx also wraps the call in
// useMemo on the three primitives; this single-slot cache is the function's
// own half of that contract, so a caller that skips useMemo still gets a
// stable object back for repeated (siblingGap, depthGap, orientation) inputs.
let lastKey: string | null = null;
let lastResult: TreeLayoutConfig | null = null;

/**
 * react-d3-tree swaps the depth/sibling axes for horizontal orientation
 * (Tree/index.js:388): TB scales nodeSize.y (100px), LR scales nodeSize.x
 * (240px) — both by `depthGap`.
 */
export function treeLayoutFor(
	knobs: LayoutKnobs,
	orientation: "TB" | "LR",
): TreeLayoutConfig {
	const key = `${knobs.siblingGap}|${knobs.depthGap}|${orientation}`;
	if (key === lastKey && lastResult) return lastResult;
	const nodeSize =
		orientation === "LR"
			? { x: BASE_NODE_SIZE.x * knobs.depthGap, y: BASE_NODE_SIZE.y }
			: { x: BASE_NODE_SIZE.x, y: BASE_NODE_SIZE.y * knobs.depthGap };
	const result: TreeLayoutConfig = {
		separation: {
			siblings: knobs.siblingGap,
			nonSiblings: knobs.siblingGap * NONSIBLING_RATIO,
		},
		nodeSize,
	};
	lastKey = key;
	lastResult = result;
	return result;
}
