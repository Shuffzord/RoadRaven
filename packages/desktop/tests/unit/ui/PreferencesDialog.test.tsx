/** @vitest-environment jsdom */
// v0.8.2 Phase 4 (D5-A / F8 / A8) — the Preferences dialog: every control
// persists on change through saveSettings; nested objects are sent whole.
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
	loadSettings: vi.fn(),
	saveSettings: vi.fn(() => Promise.resolve({ success: true })),
	openExternal: vi.fn(() => Promise.resolve({ ok: true })),
	// v0.8.3 Phase 4 theme file RPCs
	listThemes: vi.fn(() => Promise.resolve({ themes: [], dir: "/themes" })),
	duplicateTheme: vi.fn(() => Promise.resolve({ ok: true, id: "dark-copy" })),
	importTheme: vi.fn(() => Promise.resolve({ ok: true, id: "imported" })),
	revealThemesFolder: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpc } },
}));

import pkg from "../../../package.json" with { type: "json" };
import {
	DUPLICATE_THEME_LABEL,
	IMPORT_THEME_LABEL,
	OPEN_THEMES_FOLDER_LABEL,
	PreferencesDialog,
	THEME_NAME_LABEL,
} from "../../../src/mainview/components/PreferencesDialog";
import {
	CREATE_THEME_LABEL,
	EDIT_THEME_LABEL,
} from "../../../src/mainview/lib/domContract";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";
import { usePreferencesStore } from "../../../src/mainview/store/preferencesStore";
import { useSetupStore } from "../../../src/mainview/store/setupStore";
import { useThemeStore } from "../../../src/mainview/store/themeStore";
import { THEME_IDS, themeForId } from "../../../src/mainview/themes";

async function openDialog(settings: Record<string, unknown> = {}) {
	rpc.loadSettings.mockResolvedValue({ settings });
	render(<PreferencesDialog />);
	act(() => {
		usePreferencesStore.getState().openPreferences();
	});
	// Controls mount once loadSettings resolves.
	await screen.findByLabelText("WebSocket port");
}

const portInput = () =>
	screen.getByLabelText("WebSocket port") as HTMLInputElement;
const reopenBox = () =>
	screen.getByLabelText("Reopen last roadmap on launch") as HTMLInputElement;
const agentBox = () =>
	screen.getByLabelText(
		"Allow AI agents to edit roadmaps (MCP)",
	) as HTMLInputElement;

beforeEach(() => {
	vi.clearAllMocks();
	useEventApiStore.setState({
		status: "off",
		port: null,
		connectedCount: 0,
		errorMessage: null,
	});
});

afterEach(() => {
	cleanup();
	usePreferencesStore.setState({ open: false });
	useSetupStore.setState({ open: false });
	useThemeStore.setState({
		preference: "dark",
		resolvedTheme: "dark",
		userThemes: [],
		draft: null,
	});
});

describe("PreferencesDialog", () => {
	it("stays closed until the store opens it, then is labelled by its title", async () => {
		render(<PreferencesDialog />);
		expect(screen.queryByRole("dialog")).toBeNull();

		rpc.loadSettings.mockResolvedValue({ settings: {} });
		act(() => {
			usePreferencesStore.getState().openPreferences();
		});

		expect(
			await screen.findByRole("dialog", { name: "Preferences" }),
		).toBeTruthy();
		expect(rpc.loadSettings).toHaveBeenCalledTimes(1);
	});

	it("shows the loaded values", async () => {
		await openDialog({
			reopenLastFile: false,
			eventApi: { port: 9000 },
			agentApi: { enabled: false },
		});

		expect(reopenBox().checked).toBe(false);
		expect(portInput().value).toBe("9000");
		expect(agentBox().checked).toBe(false);
	});

	it("defaults to reopen on, automatic port and agents allowed", async () => {
		await openDialog({});

		expect(reopenBox().checked).toBe(true);
		expect(portInput().value).toBe("");
		expect(agentBox().checked).toBe(true);
	});

	it("changing the theme goes through the theme store", async () => {
		await openDialog();

		fireEvent.click(screen.getByLabelText(/^Theme: /));
		fireEvent.click(screen.getByRole("menuitem", { name: "Light" }));

		expect(useThemeStore.getState().preference).toBe("light");
		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { theme: "light" },
		});
	});

	it("saves the port on blur as the whole eventApi object", async () => {
		await openDialog();

		fireEvent.change(portInput(), { target: { value: "8765" } });
		expect(rpc.saveSettings).not.toHaveBeenCalled();
		fireEvent.blur(portInput());

		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { eventApi: { port: 8765 } },
		});
	});

	it("saves the port on Enter", async () => {
		await openDialog();

		fireEvent.change(portInput(), { target: { value: "9001" } });
		fireEvent.keyDown(portInput(), { key: "Enter" });

		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { eventApi: { port: 9001 } },
		});
	});

	it("an emptied port saves eventApi: {} (back to automatic)", async () => {
		await openDialog({ eventApi: { port: 9000 } });

		fireEvent.change(portInput(), { target: { value: "" } });
		fireEvent.blur(portInput());

		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { eventApi: {} },
		});
	});

	it("rejects a port outside 1024–65535 inline and does not save it", async () => {
		await openDialog();

		fireEvent.change(portInput(), { target: { value: "80" } });
		fireEvent.blur(portInput());

		expect(screen.getByRole("alert").textContent).toContain("1024");
		expect(portInput().getAttribute("aria-invalid")).toBe("true");
		expect(rpc.saveSettings).not.toHaveBeenCalled();

		// A valid value clears the message.
		fireEvent.change(portInput(), { target: { value: "2048" } });
		fireEvent.blur(portInput());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { eventApi: { port: 2048 } },
		});
	});

	it("shows the live Event API status and the restart note", async () => {
		useEventApiStore.setState({ status: "listening", port: 8765 });
		await openDialog();

		expect(
			screen.getByText("Listening on 8765. Changes apply after restart."),
		).toBeTruthy();
	});

	it("the agent toggle saves the whole agentApi object", async () => {
		await openDialog();

		fireEvent.click(agentBox());

		expect(agentBox().checked).toBe(false);
		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { agentApi: { enabled: false } },
		});
		expect(screen.getByText("Takes effect immediately.")).toBeTruthy();
	});

	it("the reopen checkbox saves reopenLastFile", async () => {
		await openDialog();

		fireEvent.click(reopenBox());

		expect(rpc.saveSettings).toHaveBeenCalledWith({
			settings: { reopenLastFile: false },
		});
	});

	it("Integrations closes Preferences and opens the setup wizard", async () => {
		await openDialog();

		fireEvent.click(
			screen.getByRole("button", { name: /set up claude code/i }),
		);

		expect(usePreferencesStore.getState().open).toBe(false);
		expect(useSetupStore.getState().open).toBe(true);
	});

	it("About shows the app version and opens the links externally", async () => {
		await openDialog();

		expect(await screen.findByText(`RoadRaven ${pkg.version}`)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Documentation" }));
		fireEvent.click(screen.getByRole("button", { name: "Releases" }));

		expect(rpc.openExternal.mock.calls).toEqual([
			[{ url: "https://github.com/Shuffzord/RoadRaven#readme" }],
			[{ url: "https://github.com/Shuffzord/RoadRaven/releases/latest" }],
		]);
	});

	// v0.8.3 Phase 4: the Theme row's file actions.
	it("Open themes folder reveals the folder through its RPC", async () => {
		await openDialog();
		fireEvent.click(
			screen.getByRole("button", { name: OPEN_THEMES_FOLDER_LABEL }),
		);
		expect(rpc.revealThemesFolder).toHaveBeenCalledWith({});
	});

	it("Import theme file… imports through its RPC and refreshes the list", async () => {
		await openDialog();
		fireEvent.click(screen.getByRole("button", { name: IMPORT_THEME_LABEL }));
		expect(rpc.importTheme).toHaveBeenCalledWith({
			reservedIds: [...THEME_IDS],
		});
		await screen.findByText(/Imported 'imported'/);
		expect(rpc.listThemes).toHaveBeenCalled();
	});

	it("an import error is shown inline", async () => {
		rpc.importTheme.mockResolvedValueOnce({
			ok: false,
			error: "not a valid theme file",
		} as never);
		await openDialog();
		fireEvent.click(screen.getByRole("button", { name: IMPORT_THEME_LABEL }));
		expect((await screen.findByRole("alert")).textContent).toContain(
			"not a valid theme file",
		);
	});

	it("Duplicate current theme… asks for a name, writes the copy and selects it", async () => {
		useThemeStore.setState({ preference: "dark", resolvedTheme: "dark" });
		await openDialog();
		fireEvent.click(
			screen.getByRole("button", { name: DUPLICATE_THEME_LABEL }),
		);

		const name = screen.getByLabelText(THEME_NAME_LABEL) as HTMLInputElement;
		expect(name.value).toBe("Dark copy");
		fireEvent.change(name, { target: { value: "Dark copy" } });
		fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(rpc.duplicateTheme).toHaveBeenCalledWith({
			source: themeForId("dark"),
			name: "Dark copy",
			reservedIds: [...THEME_IDS],
		});
		await vi.waitFor(() =>
			expect(useThemeStore.getState().preference).toBe("dark-copy"),
		);
		expect(rpc.listThemes).toHaveBeenCalled();
		expect(screen.queryByLabelText(THEME_NAME_LABEL)).toBeNull();
	});

	// v0.8.3 Phase 5: "Edit…" opens the theme editor. Preferences is modal, so
	// it closes while the editor is open; a built-in is duplicated first.
	it("Edit… on a user theme closes Preferences and opens the editor on that file", async () => {
		const mine = {
			id: "mine",
			meta: { name: "Mine", mode: "dark" as const },
			colors: themeForId("dark").colors,
		};
		useThemeStore
			.getState()
			.setUserThemes([{ id: "mine", file: mine, requiredFailures: 0 }]);
		useThemeStore.setState({ preference: "mine", resolvedTheme: "mine" });
		await openDialog();

		fireEvent.click(screen.getByRole("button", { name: EDIT_THEME_LABEL }));

		expect(rpc.duplicateTheme).not.toHaveBeenCalled();
		expect(usePreferencesStore.getState().open).toBe(false);
		expect(useThemeStore.getState().draft).toEqual(mine);
	});

	it("Edit… on a built-in asks for a name, duplicates it, selects the copy and opens the editor on it", async () => {
		const copy = {
			...themeForId("dark"),
			id: "dark-copy",
			meta: { name: "Dark copy", mode: "dark" as const },
		};
		rpc.listThemes.mockResolvedValue({
			themes: [{ id: "dark-copy", file: copy, requiredFailures: 0 }],
			dir: "/themes",
		} as never);
		useThemeStore.setState({ preference: "dark", resolvedTheme: "dark" });
		await openDialog();

		fireEvent.click(screen.getByRole("button", { name: EDIT_THEME_LABEL }));
		expect(useThemeStore.getState().draft).toBeNull();
		const name = screen.getByLabelText(THEME_NAME_LABEL) as HTMLInputElement;
		expect(name.value).toBe("Dark copy");
		fireEvent.click(screen.getByRole("button", { name: CREATE_THEME_LABEL }));

		expect(rpc.duplicateTheme).toHaveBeenCalledWith({
			source: themeForId("dark"),
			name: "Dark copy",
			reservedIds: [...THEME_IDS],
		});
		await vi.waitFor(() =>
			expect(useThemeStore.getState().draft?.id).toBe("dark-copy"),
		);
		expect(useThemeStore.getState().preference).toBe("dark-copy");
		expect(usePreferencesStore.getState().open).toBe(false);
	});

	it("Escape closes the dialog", async () => {
		await openDialog();

		act(() => {
			fireEvent.keyDown(document, { key: "Escape" });
		});

		expect(usePreferencesStore.getState().open).toBe(false);
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
