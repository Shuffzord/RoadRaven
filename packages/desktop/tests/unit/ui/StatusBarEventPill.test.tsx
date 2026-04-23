// Phase 4 Wave 0 test scaffold — failing stubs.
// Implementation lands in Plan 04-04 (see `.planning/phases/04-event-api/04-VALIDATION.md`).
// Sources: D-06 in 04-CONTEXT.md, PLUG-01.

import { describe, it } from "vitest";

// import { render } from "@testing-library/react";
// StatusBarEventPill component does not exist yet — Wave 3 creates it.
// import { StatusBarEventPill } from "../../../src/mainview/components/StatusBarEventPill";

describe("StatusBarEventPill (D-06)", () => {
	it.todo("off state renders ○ Event API off");
	it.todo("listening 0 producers renders ● :47921");
	it.todo("listening N producers renders ● :47921 · N (count)");
	it.todo("error state renders ● Port :47921 in use with red style");
	it.todo("click copies ws://127.0.0.1:47921 when idle");
	it.todo("click opens drawer when connected>0");
});
