import { beforeEach, describe, expect, it } from "vitest";
import {
	COALESCE_MS,
	HISTORY_LIMIT,
	type HistoryEntry,
} from "../../../src/mainview/lib/historyEntries";
import {
	isHistorySuspended,
	useHistoryStore,
	withoutHistory,
} from "../../../src/mainview/store/historyStore";

const status = (nodeId: string, at = 0): HistoryEntry => ({
	kind: "status",
	at,
	nodeId,
	before: "not-started",
	after: "completed",
});

const history = () => useHistoryStore.getState();

beforeEach(() => {
	history().clear();
});

describe("historyStore — push and limit", () => {
	it("appends to past and clears future", () => {
		history().push(status("a"));
		history().step("undo", () => true);
		expect(history().future).toHaveLength(1);
		history().push(status("b"));
		expect(history().past.map((e) => "nodeId" in e && e.nodeId)).toEqual(["b"]);
		expect(history().future).toEqual([]);
	});

	it(`keeps at most HISTORY_LIMIT entries: the ${HISTORY_LIMIT + 1}st push drops the oldest`, () => {
		for (let i = 0; i <= HISTORY_LIMIT; i++) history().push(status(`n${i}`));
		const past = history().past;
		expect(past).toHaveLength(HISTORY_LIMIT);
		expect(past[0]).toMatchObject({ nodeId: "n1" });
		expect(past[HISTORY_LIMIT - 1]).toMatchObject({
			nodeId: `n${HISTORY_LIMIT}`,
		});
	});

	it("coalesces consecutive notes edits of one node into one entry", () => {
		const notes = (
			at: number,
			before: string,
			after: string,
		): HistoryEntry => ({
			kind: "notes",
			at,
			nodeId: "a",
			before,
			after,
		});
		history().push(notes(0, "", "h"));
		history().push(notes(COALESCE_MS - 1, "h", "hi"));
		expect(history().past).toEqual([notes(COALESCE_MS - 1, "", "hi")]);
	});

	it("clear empties both stacks", () => {
		history().push(status("a"));
		history().push(status("b"));
		history().step("undo", () => true);
		history().clear();
		expect(history().past).toEqual([]);
		expect(history().future).toEqual([]);
	});
});

describe("historyStore — step", () => {
	it("undo hands apply the INVERSE and moves the entry to future; redo hands the entry back", () => {
		const entry = status("a");
		history().push(entry);
		const seen: HistoryEntry[] = [];
		history().step("undo", (e) => {
			seen.push(e);
			return true;
		});
		expect(seen[0]).toMatchObject({
			before: "completed",
			after: "not-started",
		});
		expect(history().past).toEqual([]);
		expect(history().future).toEqual([entry]);

		history().step("redo", (e) => {
			seen.push(e);
			return true;
		});
		expect(seen[1]).toEqual(entry);
		expect(history().past).toEqual([entry]);
		expect(history().future).toEqual([]);
	});

	it("an entry apply refuses (stale) is dropped and the next one is tried", () => {
		history().push(status("keep"));
		history().push(status("stale"));
		const applied = history().step(
			"undo",
			(e) => "nodeId" in e && e.nodeId === "keep",
		);
		expect(applied).toMatchObject({ nodeId: "keep" });
		expect(history().past).toEqual([]);
		expect(history().future).toEqual([status("keep")]);
	});

	it("returns null on an empty stack", () => {
		expect(history().step("undo", () => true)).toBe(null);
		expect(history().step("redo", () => true)).toBe(null);
	});
});

describe("historyStore — withoutHistory", () => {
	it("push is ignored inside the scope and the scope returns fn's value", () => {
		const out = withoutHistory(() => {
			history().push(status("agent"));
			return 42;
		});
		expect(out).toBe(42);
		expect(history().past).toEqual([]);
	});

	it("is re-entrant: an inner scope ending does not resume recording", () => {
		withoutHistory(() => {
			withoutHistory(() => undefined);
			expect(isHistorySuspended()).toBe(true);
			history().push(status("agent"));
		});
		expect(history().past).toEqual([]);
		expect(isHistorySuspended()).toBe(false);
	});

	it("a throw inside still ends the scope", () => {
		expect(() =>
			withoutHistory(() => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		expect(isHistorySuspended()).toBe(false);
		history().push(status("user"));
		expect(history().past).toHaveLength(1);
	});

	it("does not clear the redo stack", () => {
		history().push(status("a"));
		history().step("undo", () => true);
		withoutHistory(() => history().push(status("agent")));
		expect(history().future).toHaveLength(1);
	});
});
