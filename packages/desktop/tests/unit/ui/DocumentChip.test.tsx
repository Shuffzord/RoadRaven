/** @vitest-environment jsdom */
// v0.8.2 D3 — the top-bar document chip: basename + save-state dot, the full
// path and linked files in the native tooltip, and the File menu on click.
import { fireEvent, render, screen } from "@testing-library/react";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import { DocumentChip } from "../../../src/mainview/components/DocumentChip";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

const noop = (): void => {
	/* jsdom polyfill no-op */
};

beforeAll(() => {
	if (!HTMLElement.prototype.hasPointerCapture) {
		HTMLElement.prototype.hasPointerCapture = () => false;
	}
	if (!HTMLElement.prototype.releasePointerCapture) {
		HTMLElement.prototype.releasePointerCapture = noop;
	}
	if (!HTMLElement.prototype.scrollIntoView) {
		HTMLElement.prototype.scrollIntoView = noop;
	}
});

beforeEach(() => {
	resetStore();
});

afterEach(() => {
	resetStore();
});

function chip(): HTMLElement {
	return screen.getByRole("button", { name: /^Current file: / });
}

function dot(): HTMLElement {
	const el = chip().querySelector<HTMLElement>("[data-save-state]");
	if (!el) throw new Error("no save-state dot");
	return el;
}

describe("DocumentChip — identity", () => {
	it("renders nothing without a document", () => {
		const { container } = render(<DocumentChip />);
		expect(container.innerHTML).toBe("");
	});

	it("shows the basename and the full path as the tooltip", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "C:\\work\\plan.json");
		render(<DocumentChip />);

		expect(chip().getAttribute("aria-label")).toBe("Current file: plan.json");
		expect(chip().textContent).toBe("plan.json");
		expect(chip().getAttribute("title")).toBe("C:\\work\\plan.json");
	});

	it("an untitled document reads Untitled and says it is not saved yet", () => {
		useRoadmapStore.getState().newUntitledSchema();
		render(<DocumentChip />);

		expect(chip().textContent).toBe("Untitled");
		expect(chip().getAttribute("title")).toBe("Untitled — not saved yet");
	});

	it("lists linked (ownership-split) files after the path", () => {
		useRoadmapStore
			.getState()
			.loadSchema(SCHEMA, "/a/root.json", ["/a/sub/one.json", "/a/two.json"]);
		render(<DocumentChip />);

		expect(chip().getAttribute("title")).toBe(
			"/a/root.json\nLinked files (2):\none.json\ntwo.json",
		);
	});

	it("truncates long names inside a bounded width", () => {
		useRoadmapStore
			.getState()
			.loadSchema(SCHEMA, "/x/a-very-long-roadmap-file-name-for-the-chip.json");
		render(<DocumentChip />);

		expect(chip().className).toContain("max-w-[240px]");
		expect(chip().querySelector(".truncate")?.textContent).toBe(
			"a-very-long-roadmap-file-name-for-the-chip.json",
		);
	});
});

describe("DocumentChip — save-state dot", () => {
	it("saved: filled green", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		render(<DocumentChip />);
		expect(dot().dataset.saveState).toBe("saved");
		expect(dot().className).toContain("bg-rv-status-completed");
	});

	it("untitled: hollow", () => {
		useRoadmapStore.getState().newUntitledSchema();
		render(<DocumentChip />);
		expect(dot().dataset.saveState).toBe("untitled");
		expect(dot().className).toContain("border-rv-text-tertiary");
	});

	it("error: blocked red", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		useRoadmapStore.setState({ saveState: "error-manual" });
		render(<DocumentChip />);
		expect(dot().dataset.saveState).toBe("error-manual");
		expect(dot().className).toContain("bg-rv-status-blocked");
	});
});

describe("DocumentChip — File menu", () => {
	it("a press on the chip opens the File menu", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		render(<DocumentChip />);
		expect(chip().getAttribute("aria-haspopup")).toBe("menu");

		fireEvent.pointerDown(chip(), { button: 0, ctrlKey: false });

		const menu = screen.getByRole("menu", { name: "File menu" });
		expect(menu.textContent).toContain("Save As…");
	});
});
