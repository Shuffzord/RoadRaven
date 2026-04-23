// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-05 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-28, D-29 in 04-CONTEXT.md, §6 in 04-RESEARCH.md.

import { describe, it } from "vitest";

// wsClient module does not exist yet — Wave 4 creates it.
// import { createWsClient } from "../src/wsClient";

describe("WsClient reconnect strategy", () => {
	it.todo("reconnect backoff follows 500,1000,2000,4000,8000,16000,30000");
	it.todo("cap at 30s after exhausting schedule");
	it.todo("sends hello frame on open");
	it.todo(
		"fails tool call immediately when disconnected (no queueing per D-28)",
	);
});
