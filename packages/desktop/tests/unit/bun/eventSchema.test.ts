// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 1.
// Sources: D-09, PLUG-02 in 04-CONTEXT.md, §2.1 + §2.2 in 04-RESEARCH.md.

import { describe, expect, it } from "vitest";
import {
	META_MAX_BYTES,
	classifyEventFrame,
	parseIncoming,
} from "../../../src/bun/eventSchema";

describe("EventSchema (Zod boundary validation)", () => {
	it("parses a valid event frame", () => {
		const result = parseIncoming(
			JSON.stringify({ nodeId: "node-abc", status: "in-progress" }),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.frame).toMatchObject({ nodeId: "node-abc", status: "in-progress" });
		}
	});

	it("rejects missing nodeId", () => {
		const result = parseIncoming(JSON.stringify({ status: "done" }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("malformed");
		}
	});

	it("rejects missing status", () => {
		const result = parseIncoming(JSON.stringify({ nodeId: "node-abc" }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("malformed");
		}
	});

	it("accepts hello frame", () => {
		const result = parseIncoming(
			JSON.stringify({ type: "hello", source: "claude-code", version: "1.0" }),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.frame).toMatchObject({ type: "hello", source: "claude-code" });
		}
	});

	it("caps meta at 8KB — classify as malformed when meta exceeds limit", () => {
		// Build a meta payload that exceeds META_MAX_BYTES when serialized
		const bigValue = "x".repeat(META_MAX_BYTES + 100);
		const result = parseIncoming(
			JSON.stringify({ nodeId: "n1", status: "done", meta: { data: bigValue } }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("malformed");
		}
		// Confirm the constant is correct
		expect(META_MAX_BYTES).toBe(8 * 1024);
	});

	it("classifies unknown_node when nodeId not in allowlist", () => {
		const frame = { nodeId: "unknown-node", status: "done" };
		const allowlist = {
			nodeIds: new Set(["known-node"]),
			statusIds: new Set(["done"]),
		};
		const result = classifyEventFrame(frame, allowlist);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("unknown_node");
		}
	});

	it("classifies invalid_status when status not in statusConfig", () => {
		const frame = { nodeId: "known-node", status: "not-a-real-status" };
		const allowlist = {
			nodeIds: new Set(["known-node"]),
			statusIds: new Set(["done", "in-progress"]),
		};
		const result = classifyEventFrame(frame, allowlist);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("invalid_status");
		}
	});
});
