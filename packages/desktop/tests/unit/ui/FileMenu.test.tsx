/** @vitest-environment jsdom */
// v0.8.2 D2-A — the File menu is laid out FROM the fileCommands registry:
// order, shortcut hints, live enablement, Open Recent, and the same focus
// handoff contract as the canvas context menu.
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
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

const actions = vi.hoisted(() => ({
	newRoadmap: vi.fn(() => Promise.resolve()),
	openFile: vi.fn(() => Promise.resolve()),
	openRecent: vi.fn((_path: string) => Promise.resolve()),
	save: vi.fn(() => Promise.resolve()),
	saveAs: vi.fn(() => Promise.resolve({ filePath: null })),
	closeFile: vi.fn(() => Promise.resolve()),
	revealInFolder: vi.fn(() => Promise.resolve()),
	copyPath: vi.fn(() => Promise.resolve()),
}));
const recent = vi.hoisted(() => ({ files: [] as string[] }));
const focus = vi.hoisted(() => ({ trackMenuFocus: vi.fn() }));

vi.mock("../../../src/mainview/hooks/useFileActions", () => actions);
vi.mock("../../../src/mainview/hooks/useRecentFiles", () => ({
	useRecentFiles: () => recent.files,
}));
vi.mock("../../../src/mainview/lib/focusHandoff", () => focus);

import { FileMenu } from "../../../src/mainview/components/FileMenu";
import { getFileCommand } from "../../../src/mainview/lib/fileCommands";
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
	recent.files = [];
	vi.clearAllMocks();
});

afterEach(() => {
	resetStore();
});

function renderMenu() {
	render(
		<FileMenu>
			<button type="button">File</button>
		</FileMenu>,
	);
	return screen.getByRole("button", { name: "File" });
}

/** A left-button press on the trigger — what Radix's DropdownMenu opens on. */
function open(): HTMLElement {
	fireEvent.pointerDown(renderMenu(), { button: 0, ctrlKey: false });
	return screen.getByRole("menu", { name: "File menu" });
}

function items(menu: HTMLElement): HTMLElement[] {
	return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

function item(menu: HTMLElement, label: string): HTMLElement {
	const found = items(menu).find(
		(el) => el.querySelector("span")?.textContent === label,
	);
	if (!found) throw new Error(`no menu item "${label}"`);
	return found;
}

describe("FileMenu — structure", () => {
	it("trigger declares the popup and opens the menu on a left press", () => {
		const trigger = renderMenu();
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		expect(screen.queryByRole("menu")).toBeNull();

		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

		expect(screen.getByRole("menu", { name: "File menu" })).toBeTruthy();
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	it("lists the registry's verbs in the agreed order with 3 separators", () => {
		const menu = open();
		expect(
			items(menu).map((el) => el.querySelector("span")?.textContent),
		).toEqual([
			"New",
			"Open…",
			"Open Recent",
			"Save",
			"Save As…",
			"Reveal in Folder",
			"Copy Path",
			"Close File",
		]);
		expect(menu.querySelectorAll('[role="separator"]').length).toBe(3);
	});

	it("shows each verb's registry shortcut as its hint", () => {
		const menu = open();
		for (const id of ["new", "open", "save", "saveAs"] as const) {
			const command = getFileCommand(id);
			expect(item(menu, command.label).textContent).toContain(command.shortcut);
		}
		expect(item(menu, "Close File").querySelectorAll("span").length).toBe(1);
	});

	it("Open Recent is a submenu trigger", () => {
		const menu = open();
		expect(item(menu, "Open Recent").getAttribute("aria-haspopup")).toBe(
			"menu",
		);
	});
});

describe("FileMenu — enablement follows the store", () => {
	const disabled = (el: HTMLElement) =>
		el.getAttribute("aria-disabled") === "true";

	it("no document: Save / Save As / Close File / Reveal / Copy Path are disabled", () => {
		const menu = open();
		expect(disabled(item(menu, "New"))).toBe(false);
		expect(disabled(item(menu, "Open…"))).toBe(false);
		expect(disabled(item(menu, "Save"))).toBe(true);
		expect(disabled(item(menu, "Save As…"))).toBe(true);
		expect(disabled(item(menu, "Close File"))).toBe(true);
		expect(disabled(item(menu, "Reveal in Folder"))).toBe(true);
		expect(disabled(item(menu, "Copy Path"))).toBe(true);
	});

	it("untitled document: save verbs enabled, path verbs still disabled", () => {
		useRoadmapStore.getState().newUntitledSchema();
		const menu = open();
		expect(disabled(item(menu, "Save"))).toBe(false);
		expect(disabled(item(menu, "Close File"))).toBe(false);
		expect(disabled(item(menu, "Reveal in Folder"))).toBe(true);
		expect(disabled(item(menu, "Copy Path"))).toBe(true);
	});

	it("saved document: everything enabled", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		const menu = open();
		expect(items(menu).some(disabled)).toBe(false);
	});

	it("re-evaluates while open when the store changes", () => {
		const menu = open();
		expect(disabled(item(menu, "Save"))).toBe(true);

		act(() => {
			useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		});

		expect(disabled(item(menu, "Save"))).toBe(false);
	});
});

describe("FileMenu — actions", () => {
	it("an item runs its registry command", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		const menu = open();

		fireEvent.click(item(menu, "Save As…"));

		expect(actions.saveAs).toHaveBeenCalledTimes(1);
	});

	it("Open Recent lists recent basenames (full path as title) and opens the chosen one", () => {
		recent.files = ["C:\\work\\alpha.json", "/home/u/beta.json"];
		const menu = open();

		fireEvent.keyDown(item(menu, "Open Recent"), { key: "ArrowRight" });

		const sub = screen.getByRole("menu", { name: "Open Recent" });
		const entries = items(sub);
		expect(entries.map((el) => el.textContent)).toEqual([
			"alpha.json",
			"beta.json",
		]);
		expect(entries[0].getAttribute("title")).toBe("C:\\work\\alpha.json");

		fireEvent.click(entries[1]);

		expect(actions.openRecent).toHaveBeenCalledWith("/home/u/beta.json");
	});

	it("Open Recent with nothing recent shows one disabled placeholder", () => {
		const menu = open();

		fireEvent.keyDown(item(menu, "Open Recent"), { key: "ArrowRight" });

		const sub = screen.getByRole("menu", { name: "Open Recent" });
		const entries = items(sub);
		expect(entries.map((el) => el.textContent)).toEqual(["No recent files"]);
		expect(entries[0].getAttribute("aria-disabled")).toBe("true");
	});
});

describe("FileMenu — keyboard and focus handoff", () => {
	it("Escape closes the menu", async () => {
		const menu = open();

		fireEvent.keyDown(document.activeElement ?? menu, { key: "Escape" });

		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	});

	it("reports open and close to trackMenuFocus, like the context menu", async () => {
		const menu = open();
		expect(focus.trackMenuFocus).toHaveBeenLastCalledWith(true);

		fireEvent.keyDown(document.activeElement ?? menu, { key: "Escape" });

		await waitFor(() =>
			expect(focus.trackMenuFocus).toHaveBeenLastCalledWith(false),
		);
	});
});
