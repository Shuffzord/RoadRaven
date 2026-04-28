// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 3.
// Sources: D-08..D-13 in 04-CONTEXT.md, §4 in 04-RESEARCH.md.

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	appendEventLine,
	replayEventLog,
	synthesizeMalformedLine,
} from "../../../src/bun/eventsLog";

function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), "eventslog-test-"));
}

describe("EventsLog (sidecar .events.jsonl)", () => {
	it("appends one JSON line per event", async () => {
		const dir = makeTempDir();
		const sidecarPath = join(dir, "test.events.jsonl");
		const line = {
			t: new Date().toISOString(),
			nodeId: "node-1",
			status: "in-progress",
			source: "test",
		};
		await appendEventLine(sidecarPath, line);
		const raw = readFileSync(sidecarPath, "utf-8");
		const parsed = JSON.parse(raw.trim());
		expect(parsed.nodeId).toBe("node-1");
		expect(parsed.status).toBe("in-progress");
		expect(raw.endsWith("\n")).toBe(true);
	});

	it("replays log into a last-event-per-nodeId Map", async () => {
		const dir = makeTempDir();
		const sidecarPath = join(dir, "replay.events.jsonl");
		const t1 = new Date(1000).toISOString();
		const t2 = new Date(2000).toISOString();
		const t3 = new Date(3000).toISOString();
		await appendEventLine(sidecarPath, {
			t: t1,
			nodeId: "a",
			status: "not-started",
		});
		await appendEventLine(sidecarPath, {
			t: t2,
			nodeId: "a",
			status: "in-progress",
		});
		await appendEventLine(sidecarPath, {
			t: t3,
			nodeId: "b",
			status: "completed",
		});

		const { overlay, events } = await replayEventLog(sidecarPath);
		// Overlay has 2 entries (one per nodeId)
		expect(overlay.size).toBe(2);
		// Last-write-wins for node "a"
		expect(overlay.get("a")?.status).toBe("in-progress");
		expect(overlay.get("b")?.status).toBe("completed");
		// Events array has all 3 entries
		expect(events).toHaveLength(3);
	});

	it("preserves _error field on disk", async () => {
		const dir = makeTempDir();
		const sidecarPath = join(dir, "errors.events.jsonl");
		const line = {
			t: new Date().toISOString(),
			nodeId: "unknown-node",
			status: "done",
			_error: "unknown_node" as const,
		};
		await appendEventLine(sidecarPath, line);
		const raw = readFileSync(sidecarPath, "utf-8");
		const parsed = JSON.parse(raw.trim());
		expect(parsed._error).toBe("unknown_node");

		// Replaying: _error entries go to events[] but NOT to overlay
		const { overlay, events } = await replayEventLog(sidecarPath);
		expect(overlay.size).toBe(0); // filtered out
		expect(events).toHaveLength(1);
		expect(events[0]._error).toBe("unknown_node");
	});

	it("synthesises line for unparseable JSON with _error: malformed", () => {
		const raw = '{ broken json "here"';
		const line = synthesizeMalformedLine(raw, "test-source");
		expect(line._error).toBe("malformed");
		expect(line.nodeId).toBe("__malformed__");
		expect(line.status).toBe("__malformed__");
		expect(line.source).toBe("test-source");
		// Meta should contain truncated raw
		expect((line.meta as { raw: string }).raw).toBe(raw);
	});
});
