// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-02 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-04, D-05 in 04-CONTEXT.md, §2 in 04-RESEARCH.md.

import { describe, it } from "vitest";

// Implementation file does not exist yet — Wave 1 creates it.
// import type { writeSentinel, deleteSentinel } from "../../../src/bun/sentinel";

describe("Sentinel file lifecycle", () => {
	it.todo(
		"writes event-api.json atomically with correct shape { port, url, startedAt, pid }",
	);
	it.todo("deletes sentinel on clean shutdown");
	it.todo("embeds the current process pid");
});
