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
import { agentToolCallback } from "../src/tools/agentToolCallback";

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
