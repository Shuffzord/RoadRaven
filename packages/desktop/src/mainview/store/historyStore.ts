import { create } from "zustand";
import {
	coalesce,
	HISTORY_LIMIT,
	type HistoryDirection,
	type HistoryEntry,
	invert,
} from "../lib/historyEntries";

/**
 * The undo/redo ring (v0.8.4 Phase 6) — the user's own edits only.
 *
 * roadmapStore pushes an entry from inside each user-facing mutation, after
 * it succeeded. Agents and live events run inside `withoutHistory`, so their
 * pushes are ignored: they never enter the ring and never clear the redo
 * stack (D-15). View state (collapse, layout knobs, offsets, camera) never
 * comes here at all (D-12).
 */

let suspendDepth = 0;

/**
 * Run `fn` with recording suspended. Re-entrant (a depth counter) and
 * exception-safe. Synchronous: wrap the mutation call itself.
 */
export function withoutHistory<T>(fn: () => T): T {
	suspendDepth++;
	try {
		return fn();
	} finally {
		suspendDepth--;
	}
}

export function isHistorySuspended(): boolean {
	return suspendDepth > 0;
}

function capped(entries: HistoryEntry[]): HistoryEntry[] {
	return entries.length > HISTORY_LIMIT
		? entries.slice(entries.length - HISTORY_LIMIT)
		: entries;
}

interface HistoryState {
	past: HistoryEntry[];
	future: HistoryEntry[];
	/** Record a user edit: coalesce or append, cap, clear the redo stack.
	 *  Ignored inside `withoutHistory`. */
	push: (entry: HistoryEntry) => void;
	/**
	 * Pop the newest entry of the `direction` stack and hand `apply` what
	 * running it means (its inverse for undo, the entry itself for redo).
	 * When `apply` returns false the entry is stale — dropped, and the next
	 * one is tried. `apply` runs inside `withoutHistory`. Returns what was
	 * applied, or null when nothing was.
	 */
	step: (
		direction: HistoryDirection,
		apply: (effect: HistoryEntry) => boolean,
	) => HistoryEntry | null;
	clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
	past: [],
	future: [],

	push: (entry) => {
		if (isHistorySuspended()) return;
		const past = get().past;
		const merged = coalesce(past[past.length - 1], entry);
		set({
			past: merged ? [...past.slice(0, -1), merged] : capped([...past, entry]),
			future: [],
		});
	},

	step: (direction, apply) => {
		const from = direction === "undo" ? "past" : "future";
		const to = direction === "undo" ? "future" : "past";
		const source = [...get()[from]];
		for (let entry = source.pop(); entry; entry = source.pop()) {
			const effect = direction === "undo" ? invert(entry) : entry;
			// Running an entry goes through the ordinary mutations, which
			// would otherwise record it as a fresh edit.
			if (!withoutHistory(() => apply(effect))) continue;
			set({ [from]: source, [to]: capped([...get()[to], entry]) } as Pick<
				HistoryState,
				"past" | "future"
			>);
			return effect;
		}
		set({ [from]: source } as Pick<HistoryState, "past" | "future">);
		return null;
	},

	clear: () => set({ past: [], future: [] }),
}));
