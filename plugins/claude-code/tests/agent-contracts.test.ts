// Phase 6 contract tests — frozen at 5 cases. Anti-sprawl: every test pins one
// public-API truth that downstream plans (06-02..06-06) build on. Adding a sixth
// case for "completeness" violates the test budget — split into a follow-up plan instead.
import { describe, expect, it } from "vitest";
import { agentToolCallback } from "../src/tools/agentToolCallback";
import { AGENT_ERROR_CODES, type AgentErrorCode } from "../src/tools/errors";
import {
	DeleteNodeInputSchema,
	FindNodesInputSchema,
	UpdateNodeMetadataInputSchema,
} from "../src/tools/schemas";

describe("AgentErrorCode enum (RESEARCH §9 / D-11/D-12/D-13 + WR-01/WR-04)", () => {
	it("contains exactly 15 codes: 13 originals + invalid_input (WR-01) + autosave_timeout (WR-04)", () => {
		const expected = new Set<AgentErrorCode>([
			"app_not_running",
			"no_file_loaded",
			"node_not_found",
			"cascade_required",
			"cannot_delete_last_root",
			"path_not_permitted",
			"cross_ref_boundary",
			"move_would_create_cycle",
			"file_read_error",
			"save_error",
			"agent_api_disabled",
			"unknown_tool",
			"internal_error",
			"invalid_input",
			"autosave_timeout",
		] as const);
		expect(new Set(AGENT_ERROR_CODES)).toEqual(expected);
		expect(AGENT_ERROR_CODES.length).toBe(15);
	});
});

describe("FindNodesInputSchema (D-03 AND-combined filter)", () => {
	it("accepts every D-03 field as optional and rejects type-mismatched inputs", () => {
		// Empty object is valid (D-03: every field optional)
		expect(FindNodesInputSchema.safeParse({}).success).toBe(true);
		// All 6 fields populated is valid
		const full = {
			titleContains: "auth",
			status: "in-progress",
			type: "milestone",
			metaKey: "owner",
			metaValue: "alice",
			parentId: "00000000-0000-0000-0000-000000000000",
		};
		expect(FindNodesInputSchema.safeParse(full).success).toBe(true);
		// titleContains must be a string (rejects number)
		expect(FindNodesInputSchema.safeParse({ titleContains: 42 }).success).toBe(
			false,
		);
		// parentId must be a UUID
		expect(
			FindNodesInputSchema.safeParse({ parentId: "not-a-uuid" }).success,
		).toBe(false);
	});
});

describe("UpdateNodeMetadataInputSchema (D-04 PATCH semantics: null = delete)", () => {
	it("accepts patch values of null and any unknown shape, keyed by string", () => {
		const ok1 = UpdateNodeMetadataInputSchema.safeParse({
			nodeId: "00000000-0000-0000-0000-000000000000",
			patch: { priority: "P0", owner: null, count: 5 }, // null = delete owner
		});
		expect(ok1.success).toBe(true);
		// patch is required (cannot be undefined)
		const ok2 = UpdateNodeMetadataInputSchema.safeParse({
			nodeId: "00000000-0000-0000-0000-000000000000",
		});
		expect(ok2.success).toBe(false);
	});
});

describe("DeleteNodeInputSchema (D-11 cascade gate)", () => {
	it("makes cascade an optional boolean (omitted = false at runtime per D-11)", () => {
		expect(
			DeleteNodeInputSchema.safeParse({
				nodeId: "00000000-0000-0000-0000-000000000000",
			}).success,
		).toBe(true);
		expect(
			DeleteNodeInputSchema.safeParse({
				nodeId: "00000000-0000-0000-0000-000000000000",
				cascade: true,
			}).success,
		).toBe(true);
		expect(
			DeleteNodeInputSchema.safeParse({
				nodeId: "00000000-0000-0000-0000-000000000000",
				cascade: "yes",
			}).success,
		).toBe(false);
	});
});

describe("agentToolCallback (RESEARCH §9 MCP-result shape)", () => {
	it("returns success as { content:[{type:'text',text:JSON}] } and errors as { content, isError:true }", async () => {
		// Stub wsClient: success path
		const wsOk = {
			request: async () => ({ tree: "ok-data" }) as unknown,
		};
		const okCb = agentToolCallback("getRoadmap", wsOk);
		const okResult = await okCb({ irrelevant: true });
		expect(okResult.isError).toBeFalsy();
		expect(okResult.content[0].type).toBe("text");
		expect(okResult.content[0].text).toContain("ok-data");

		// Stub wsClient: error path with a code+hint (RESEARCH §9 shape)
		const wsErr = {
			request: async () => {
				const e = new Error("Node 'x' not found.") as Error & {
					code?: string;
					hint?: string;
				};
				e.code = "node_not_found";
				e.hint = "Call getRoadmap or findNodes to discover node IDs.";
				throw e;
			},
		};
		const errCb = agentToolCallback("getNode", wsErr);
		const errResult = await errCb({ nodeId: "x" });
		expect(errResult.isError).toBe(true);
		// Format from RESEARCH §9: `Error (${code}): ${message}${hint ? ` ${hint}` : ""}`
		expect(errResult.content[0].text).toContain("(node_not_found)");
		expect(errResult.content[0].text).toContain("Call getRoadmap");
	});
});

// INTENTIONALLY 5 TESTS. Do not add more in this plan. The transport, gate, dispatcher,
// and store-action contracts are tested in 06-02 (3 tests), 06-03 (6 tests), 06-04 (5-7 tests).
