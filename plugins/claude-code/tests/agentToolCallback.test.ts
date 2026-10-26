// agentToolCallback transport-failure path: when the WebSocket request fails
// without a structured code and the sentinel says the app is down, the tool
// result must use the same `Error (<code>): <message>` shape as every other
// structured error, so agents and docs can rely on `app_not_running`.
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/sentinel", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/sentinel")>()),
	readSentinel: vi.fn(async () => ({ ok: false, error: "sentinel missing" })),
}));

import { APP_NOT_RUNNING_MESSAGE } from "../src/sentinel";
import {
	agentToolCallback,
	getRoadmapCallback,
} from "../src/tools/agentToolCallback";

describe("agentToolCallback when the app is not running", () => {
	it("returns a structured app_not_running error naming RoadRaven", async () => {
		const client = {
			request: vi.fn().mockRejectedValue(new Error("socket closed")),
		};

		const result = await agentToolCallback("getRoadmap", client)({});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(
			/^Error \(app_not_running\): RoadRaven/,
		);
		expect(result.content[0].text).toBe(
			`Error (app_not_running): ${APP_NOT_RUNNING_MESSAGE}`,
		);
	});
});

describe("agentToolCallback success", () => {
	it("returns compact JSON", async () => {
		const result = { a: 1, b: [{ c: "d" }] };
		const client = { request: vi.fn().mockResolvedValue(result) };
		const out = await agentToolCallback("getNode", client)({});
		expect(out.content[0].text).toBe(JSON.stringify(result));
		expect(out.content[0].text).not.toContain("\n");
	});
});

// An answer whose compact JSON (`"xxx"`) is exactly `n` characters.
const answerOfLength = (n: number) => "x".repeat(n - 2);
const callWith = (
	method: string,
	n: number,
	env: Record<string, string | undefined> = {},
) =>
	agentToolCallback(
		method,
		{ request: vi.fn().mockResolvedValue(answerOfLength(n)) },
		(r) => r,
		env,
	)({});

describe("agentToolCallback result_too_large guard", () => {
	it("refuses an answer over the 40,000-character limit", async () => {
		const out = await callWith("getNode", 40_001);
		expect(out.isError).toBe(true);
		expect(out.content[0].text).toMatch(
			/^Error \(result_too_large\): The answer is 40,001 characters, over the 40,000-character limit for one tool result\. /,
		);
	});

	it("returns an answer of exactly 40,000 characters", async () => {
		const out = await callWith("getNode", 40_000);
		expect(out.isError).toBeUndefined();
		expect(out.content[0].text).toBe(JSON.stringify(answerOfLength(40_000)));
	});

	it.each([
		[
			"getRoadmap",
			"Pass omitNotes: true and hideCompleted: true, or read one branch with rootId and depth.",
		],
		[
			"findNodes",
			"Narrow the filter (status list, type, parentId) or pass omitNotes: true.",
		],
		["getNode", "Ask for less, for example one node with getNode."],
	])("%s gets its own hint", async (method, hint) => {
		const out = await callWith(method, 40_001);
		expect(out.content[0].text.endsWith(` ${hint}`)).toBe(true);
	});

	it("raises the limit to MAX_MCP_OUTPUT_TOKENS x 1.6", async () => {
		const env = { MAX_MCP_OUTPUT_TOKENS: "50000" };
		expect((await callWith("getNode", 60_000, env)).isError).toBeUndefined();
		expect((await callWith("getNode", 80_000, env)).isError).toBeUndefined();
		const out = await callWith("getNode", 80_001, env);
		expect(out.content[0].text).toContain("over the 80,000-character limit");
	});

	it.each([
		"",
		"abc",
		"0",
		"-5",
	])("falls back to 40,000 when MAX_MCP_OUTPUT_TOKENS is %j", async (value) => {
		const out = await callWith("getNode", 40_001, {
			MAX_MCP_OUTPUT_TOKENS: value,
		});
		expect(out.content[0].text).toContain("over the 40,000-character limit");
	});

	it("measures getRoadmap after its options are applied", async () => {
		vi.stubEnv("MAX_MCP_OUTPUT_TOKENS", "");
		const bulk = "n".repeat(300);
		const nodes = Array.from({ length: 150 }, (_, i) => ({
			id: `n${i}`,
			title: `Node ${i}`,
			status: "completed",
			notes: bulk,
			children: [],
		}));
		const client = {
			request: vi.fn().mockResolvedValue({
				revision: 1,
				schema: { nodes: [{ id: "r", title: "R", children: nodes }] },
			}),
		};
		const refused = await getRoadmapCallback(client)(undefined);
		expect(refused.isError).toBe(true);
		expect(refused.content[0].text).toMatch(/^Error \(result_too_large\)/);
		const fitted = await getRoadmapCallback(client)({
			omitNotes: true,
			hideCompleted: true,
		});
		expect(fitted.isError).toBeUndefined();
		vi.unstubAllEnvs();
	});
});
