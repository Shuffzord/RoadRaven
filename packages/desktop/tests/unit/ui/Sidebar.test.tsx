/** @vitest-environment jsdom */
// v0.8.2 Phase 3 — the Files sidebar: header, two-icon rail, current-file
// highlight, the recent-row context menu (A4) and no bottom buttons.
import {
	act,
	fireEvent,
	render,
	renderHook,
	screen,
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

const rpc = vi.hoisted(() => ({
	revealInFolder: vi.fn(),
	saveSettings: vi.fn(),
	loadSettings: vi.fn(),
}));
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpc } },
}));

// Only the load is stubbed; the recent-files helpers run for real against
// the mocked rpc so the menu's writes are observed as saveSettings calls.
const actions = vi.hoisted(() => ({
	openRecent: vi.fn((_path: string) => Promise.resolve()),
}));
vi.mock(
	"../../../src/mainview/hooks/useFileActions",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("../../../src/mainview/hooks/useFileActions")
		>()),
		openRecent: actions.openRecent,
	}),
);

// useRecentFiles is overridden per-test via the mock below.
const recent = vi.hoisted(() => ({ files: [] as string[] }));
vi.mock("../../../src/mainview/hooks/useRecentFiles", () => ({
	useRecentFiles: () => recent.files,
}));

const focus = vi.hoisted(() => ({ trackMenuFocus: vi.fn() }));
vi.mock("../../../src/mainview/lib/focusHandoff", () => focus);

import { Sidebar } from "../../../src/mainview/components/Sidebar";
import { RECENT_FILES_CHANGED_EVENT } from "../../../src/mainview/hooks/useFileActions";
import { useUiSettingsHydration } from "../../../src/mainview/hooks/useUiSettingsHydration";
import { formatShortcut } from "../../../src/mainview/lib/fileCommands";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useToastStore } from "../../../src/mainview/store/toastStore";
import {
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MAX_WIDTH,
	useUiStore,
} from "../../../src/mainview/store/uiStore";
import { resetStore } from "../../helpers/resetStore";

const A = "/path/to/roadmap.json";
const B = "C:\\work\\plan.json";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [
		{
			id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			title: "Root",
			status: "not-started",
		},
	],
};

let scrollIntoView: ReturnType<typeof vi.fn>;

beforeAll(() => {
	// Radix relies on PointerEvent APIs that jsdom does not implement.
	if (!HTMLElement.prototype.hasPointerCapture) {
		HTMLElement.prototype.hasPointerCapture = () => false;
	}
	if (!HTMLElement.prototype.releasePointerCapture) {
		HTMLElement.prototype.releasePointerCapture = (): void => {
			/* jsdom polyfill no-op */
		};
	}
});

beforeEach(() => {
	scrollIntoView = vi.fn();
	Element.prototype.scrollIntoView = scrollIntoView as never;
	rpc.revealInFolder.mockResolvedValue({ ok: true });
	rpc.saveSettings.mockResolvedValue({ success: true });
	rpc.loadSettings.mockResolvedValue({ settings: { recentFiles: [] } });
});

afterEach(() => {
	vi.clearAllMocks();
	recent.files = [];
	resetStore();
	useToastStore.setState({ toasts: [] });
	useUiStore.setState({
		sidebarCollapsed: false,
		sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
	});
});

const rowButton = (name: string): HTMLButtonElement => {
	const button = screen.getByText(name).closest("button");
	if (!button) throw new Error(`no row for ${name}`);
	return button;
};

/** Right-click a recent row and return its menu. */
function openRowMenu(name: string): HTMLElement {
	fireEvent.contextMenu(rowButton(name), {
		clientX: 40,
		clientY: 80,
		button: 2,
	});
	return screen.getByRole("menu", { name: "Recent file actions" });
}

function menuItem(menu: HTMLElement, label: string): HTMLElement {
	const found = Array.from(
		menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
	).find((el) => el.querySelector("span")?.textContent === label);
	if (!found) throw new Error(`no menu item "${label}"`);
	return found;
}

describe("Sidebar — header", () => {
	it("is titled Files and shows the real collapse shortcut", () => {
		render(<Sidebar />);
		expect(screen.getByText("Files")).toBeTruthy();
		expect(screen.queryByText("Explorer")).toBeNull();
		expect(screen.getByRole("button", { name: "Collapse sidebar" }).title).toBe(
			formatShortcut("B"),
		);
	});

	it("has no Preferences or Help buttons", () => {
		render(<Sidebar />);
		expect(screen.queryByText("Preferences")).toBeNull();
		expect(screen.queryByText("Help")).toBeNull();
	});
});

describe("Sidebar — collapsed rail", () => {
	beforeEach(() => {
		useUiStore.setState({ sidebarCollapsed: true });
		recent.files = [A];
	});

	it("renders only the two section icons and the expand button", () => {
		render(<Sidebar />);
		expect(screen.getByRole("button", { name: "Recent Files" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Outline" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
		expect(screen.getAllByRole("button")).toHaveLength(3);
		expect(screen.queryByText("roadmap.json")).toBeNull();
		expect(screen.queryByText("No recent files")).toBeNull();
		expect(screen.queryByText("Files")).toBeNull();
	});

	it("a rail icon expands the sidebar and reveals its section", () => {
		render(<Sidebar />);
		fireEvent.click(screen.getByRole("button", { name: "Outline" }));
		expect(useUiStore.getState().sidebarCollapsed).toBe(false);
		expect(screen.getByText("Outline")).toBeTruthy();
		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrollIntoView.mock.instances[0]).toBe(screen.getByText("Outline"));
	});
});

describe("Sidebar — Recent Files", () => {
	it("shows 'No recent files' placeholder when list is empty", () => {
		render(<Sidebar />);
		expect(screen.getByText("No recent files")).toBeTruthy();
	});

	it("renders basenames and uses full path as tooltip", () => {
		recent.files = [A, B];
		render(<Sidebar />);
		expect(rowButton("roadmap.json").getAttribute("title")).toBe(A);
		expect(screen.getByText("plan.json")).toBeTruthy();
	});

	it("calls openRecent with the full path when a recent file is clicked", () => {
		recent.files = [A];
		render(<Sidebar />);
		fireEvent.click(screen.getByText("roadmap.json"));
		expect(actions.openRecent).toHaveBeenCalledWith(A);
	});

	it("marks the open file's row as current", () => {
		recent.files = [A, B];
		useRoadmapStore.getState().loadSchema(SCHEMA, A);
		render(<Sidebar />);
		const current = rowButton("roadmap.json");
		expect(current.getAttribute("aria-current")).toBe("true");
		expect(current.className).toContain("bg-rv-bg-hover text-rv-text-primary");
		expect(rowButton("plan.json").getAttribute("aria-current")).toBeNull();
	});

	it("highlights nothing for an untitled document", () => {
		recent.files = [A];
		act(() => useRoadmapStore.getState().newUntitledSchema());
		render(<Sidebar />);
		expect(rowButton("roadmap.json").getAttribute("aria-current")).toBeNull();
	});
});

describe("Sidebar — recent row context menu (A4)", () => {
	beforeEach(() => {
		recent.files = [A, B];
		rpc.loadSettings.mockResolvedValue({ settings: { recentFiles: [A, B] } });
	});

	it("lists Open, Reveal, Remove and Clear with one separator", () => {
		render(<Sidebar />);
		const menu = openRowMenu("roadmap.json");
		expect(
			Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
				(el) => el.querySelector("span")?.textContent,
			),
		).toEqual([
			"Open",
			"Reveal in Folder",
			"Remove from Recent",
			"Clear Recent",
		]);
		expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
		expect(focus.trackMenuFocus).toHaveBeenCalledWith(true);
	});

	it("Open runs the openRecent command for that path", () => {
		render(<Sidebar />);
		fireEvent.click(menuItem(openRowMenu("plan.json"), "Open"));
		expect(actions.openRecent).toHaveBeenCalledWith(B);
	});

	it("Reveal in Folder calls the RPC and stays quiet on success", async () => {
		render(<Sidebar />);
		fireEvent.click(menuItem(openRowMenu("plan.json"), "Reveal in Folder"));
		await vi.waitFor(() =>
			expect(rpc.revealInFolder).toHaveBeenCalledWith({ path: B }),
		);
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it("Reveal in Folder toasts a file error when the file is gone", async () => {
		rpc.revealInFolder.mockResolvedValue({ ok: false });
		render(<Sidebar />);
		fireEvent.click(menuItem(openRowMenu("plan.json"), "Reveal in Folder"));
		await vi.waitFor(() =>
			expect(useToastStore.getState().toasts).toHaveLength(1),
		);
		const [toast] = useToastStore.getState().toasts;
		expect(toast.type).toBe("file_error");
		expect(toast.detail).toContain("File not found on disk");
	});

	it("Remove from Recent saves the list without that path and announces the change", async () => {
		const changed = vi.fn();
		window.addEventListener(RECENT_FILES_CHANGED_EVENT, changed);
		render(<Sidebar />);
		fireEvent.click(
			menuItem(openRowMenu("roadmap.json"), "Remove from Recent"),
		);
		await vi.waitFor(() =>
			expect(rpc.saveSettings).toHaveBeenCalledWith({
				settings: { recentFiles: [B] },
			}),
		);
		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
		window.removeEventListener(RECENT_FILES_CHANGED_EVENT, changed);
	});

	it("Clear Recent saves an empty list", async () => {
		render(<Sidebar />);
		fireEvent.click(menuItem(openRowMenu("roadmap.json"), "Clear Recent"));
		await vi.waitFor(() =>
			expect(rpc.saveSettings).toHaveBeenCalledWith({
				settings: { recentFiles: [] },
			}),
		);
	});
});

describe("Sidebar — resizable width", () => {
	const nav = (): HTMLElement =>
		screen.getByRole("navigation", { name: "Sidebar navigation" });

	it("renders the handle with the current width when expanded", () => {
		useUiStore.setState({ sidebarWidth: 300 });
		render(<Sidebar />);
		const handle = screen.getByRole("separator", { name: "Resize sidebar" });
		expect(handle.getAttribute("aria-valuenow")).toBe("300");
		expect(nav().style.width).toBe("300px");
		expect(nav().style.transitionProperty).toBe("width");
	});

	it("has no handle and a 48px rail when collapsed", () => {
		useUiStore.setState({ sidebarCollapsed: true });
		render(<Sidebar />);
		expect(screen.queryByRole("separator")).toBeNull();
		expect(nav().style.width).toBe("48px");
	});

	it("drag updates the store width, suspends the transition and saves on mouseup", async () => {
		render(<Sidebar />);
		nav().getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
		const handle = screen.getByRole("separator", { name: "Resize sidebar" });
		fireEvent.mouseDown(handle);
		fireEvent.mouseMove(window, { clientX: 350 });
		expect(useUiStore.getState().sidebarWidth).toBe(350);
		expect(nav().style.transitionProperty).toBe("none");
		expect(rpc.saveSettings).not.toHaveBeenCalled();
		fireEvent.mouseUp(window);
		expect(nav().style.transitionProperty).toBe("width");
		await vi.waitFor(() =>
			expect(rpc.saveSettings).toHaveBeenCalledWith({
				settings: { sidebarWidth: 350 },
			}),
		);
	});

	it("keyboard steps update the store and save", () => {
		render(<Sidebar />);
		const handle = screen.getByRole("separator", { name: "Resize sidebar" });
		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH + 16);
		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { sidebarWidth: SIDEBAR_DEFAULT_WIDTH + 16 },
		});
	});

	it("double-click resets to the default width and saves it", () => {
		useUiStore.setState({ sidebarWidth: 400 });
		render(<Sidebar />);
		fireEvent.doubleClick(
			screen.getByRole("separator", { name: "Resize sidebar" }),
		);
		expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { sidebarWidth: SIDEBAR_DEFAULT_WIDTH },
		});
	});

	it("hydration clamps the saved width", async () => {
		rpc.loadSettings.mockResolvedValue({ settings: { sidebarWidth: 9999 } });
		renderHook(() => useUiSettingsHydration());
		await vi.waitFor(() =>
			expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_MAX_WIDTH),
		);
	});

	it("hydration ignores a non-numeric saved width", async () => {
		rpc.loadSettings.mockResolvedValue({ settings: { sidebarWidth: "abc" } });
		renderHook(() => useUiSettingsHydration());
		await vi.waitFor(() => expect(rpc.loadSettings).toHaveBeenCalled());
		await Promise.resolve();
		expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
	});
});

describe("Sidebar — Outline", () => {
	it("renders the Outline section header with the empty state when no roadmap is open", () => {
		render(<Sidebar />);
		expect(screen.getByText("Outline")).toBeTruthy();
		expect(screen.getByText("No roadmap open")).toBeTruthy();
	});
});
