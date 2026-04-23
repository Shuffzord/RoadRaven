// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 Task 6 (standalone Bun entry + sentinel write).
// Sources: D-04, D-29 in 04-CONTEXT.md, §7.3 in 04-RESEARCH.md.

import { describe, it } from "vitest";
// This test requires a standalone Bun launcher — Wave 1 (Plan 04-02 Task 6) creates it.
// import { spawnEventServerProcess } from "../../helpers/eventServerHelper";

describe("Event API end-to-end", () => {
	it.todo(
		"standalone bun entry boots event server, writes sentinel, accepts ws connection",
	);
});
