// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-03 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-25, D-11 in 04-CONTEXT.md.

import { describe, it } from "vitest";
// applyEventBatch action does not exist yet — Wave 2 adds it to roadmapStore.
// import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

describe("roadmapStore.applyEventBatch", () => {
	it.todo("applies 5 updates in one set() call");
	it.todo("does NOT increment dataKey");
	it.todo("increments statusTick exactly once per batch");
});
