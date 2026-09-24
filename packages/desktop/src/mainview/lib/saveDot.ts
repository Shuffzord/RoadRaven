import type { SaveState } from "../store/roadmapStore";

/**
 * The 7px save-state dot shared by the footer SaveIndicator and the top-bar
 * DocumentChip (v0.8.2 D3): one colour table, so the two never disagree.
 * "untitled" is the no-disk-path case, hollow rather than coloured.
 */
export function saveDotClass(state: SaveState | "untitled"): string {
	const base = "w-[7px] h-[7px] rounded-full";
	switch (state) {
		case "untitled":
			return `${base} border border-rv-text-tertiary`;
		case "saved":
			return `${base} bg-rv-status-completed`;
		case "saving":
			return `${base} bg-rv-text-secondary motion-safe:animate-pulse`;
		default:
			return `${base} bg-rv-status-blocked`;
	}
}
