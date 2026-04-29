import { create } from "zustand";
import type { IntegrationEvent } from "../../../../../shared/types";

export type EventLogRow = IntegrationEvent;
export const EVENT_LOG_ROW_CAP = 1000;

export interface EventLogFilter {
	source: string | null;
	selectedNodeOnly: boolean;
	status: string | null;
}

export interface EventLogState {
	rows: EventLogRow[];
	filter: EventLogFilter;
	isOpen: boolean;
	drawerHeightPx: number;
	appendEvents: (events: IntegrationEvent[]) => void;
	setOpen: (open: boolean) => void;
	toggleOpen: () => void;
	setDrawerHeightPx: (px: number) => void;
	setFilterSource: (source: string | null) => void;
	setFilterSelectedNodeOnly: (on: boolean) => void;
	setFilterStatus: (status: string | null) => void;
	clearFilters: () => void;
}

export function getClampedHeight(px: number, viewportPx: number): number {
	const min = 24;
	const max = Math.floor(viewportPx * 0.7);
	return Math.max(min, Math.min(max, px));
}

function defaultHeight(): number {
	if (typeof window === "undefined") return 300;
	return Math.floor(window.innerHeight * 0.3);
}

export const useEventLogStore = create<EventLogState>((set) => ({
	rows: [],
	filter: { source: null, selectedNodeOnly: false, status: null },
	isOpen: false,
	drawerHeightPx: defaultHeight(),

	appendEvents: (events) =>
		set((s) => {
			const merged = [...s.rows, ...events];
			const capped =
				merged.length > EVENT_LOG_ROW_CAP
					? merged.slice(merged.length - EVENT_LOG_ROW_CAP)
					: merged;
			return { rows: capped };
		}),

	setOpen: (isOpen) => set({ isOpen }),

	toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

	setDrawerHeightPx: (px) =>
		set({
			drawerHeightPx: getClampedHeight(
				px,
				typeof window === "undefined" ? 1000 : window.innerHeight,
			),
		}),

	setFilterSource: (source) =>
		set((s) => ({ filter: { ...s.filter, source } })),

	setFilterSelectedNodeOnly: (selectedNodeOnly) =>
		set((s) => ({ filter: { ...s.filter, selectedNodeOnly } })),

	setFilterStatus: (status) =>
		set((s) => ({ filter: { ...s.filter, status } })),

	clearFilters: () =>
		set({ filter: { source: null, selectedNodeOnly: false, status: null } }),
}));

/**
 * Returns filtered rows from the log. When `selectedNodeOnly` is true and
 * `selectedNodeId` is null, returns [] — T-04-04-04 mitigation.
 */
export function getFilteredRows(
	rows: EventLogRow[],
	filter: EventLogFilter,
	selectedNodeId: string | null,
): EventLogRow[] {
	return rows.filter((r) => {
		if (filter.source !== null && r.source !== filter.source) return false;
		// T-04-04-04: no selection + selectedNodeOnly = empty result (not all rows)
		if (filter.selectedNodeOnly && selectedNodeId === null) return false;
		if (
			filter.selectedNodeOnly &&
			selectedNodeId !== null &&
			r.nodeId !== selectedNodeId
		)
			return false;
		if (filter.status !== null && r.status !== filter.status) return false;
		return true;
	});
}

/** Returns unique source values (excluding undefined/null) in stable insertion order. */
export function getDistinctSources(rows: EventLogRow[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const r of rows) {
		if (r.source && !seen.has(r.source)) {
			seen.add(r.source);
			out.push(r.source);
		}
	}
	return out;
}
