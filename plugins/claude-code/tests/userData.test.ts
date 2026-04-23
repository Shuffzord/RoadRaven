// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-05 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-27 in 04-CONTEXT.md, §6.6 in 04-RESEARCH.md.

import { describe, it } from "vitest";

// userData module does not exist yet — Wave 4 creates it.
// import { getUserDataPath } from "../src/userData";

describe("userData path resolution", () => {
	it.todo("returns LOCALAPPDATA/RoadRaven on win32");
	it.todo("returns ~/Library/Application Support/RoadRaven on darwin");
	it.todo("returns XDG_CONFIG_HOME/RoadRaven on linux");
});
