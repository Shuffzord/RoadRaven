// @vitest-environment jsdom
// v0.8.3 Phase 5 (RC1 / RC2): the in-app theme editor — a non-modal dialog
// that edits a user theme through the store draft (ThemeProvider paints it),
// shows the registry's WCAG verdicts live, autosaves through the writeTheme
// RPC and collapses to a pill.
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeFile } from "../../../../../shared/themeSchema";

const rpc = vi.hoisted(() => ({
	saveSettings: vi.fn(() => Promise.resolve({ success: true })),
	loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
	listThemes: vi.fn(() => Promise.resolve({ themes: [], dir: "/themes" })),
	writeTheme: vi.fn(() => Promise.resolve({ ok: true, id: "mine" })),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpc } },
	onThemesChanged: vi.fn(() => () => {
		/* unsubscribe */
	}),
}));

import {
	openThemeEditor,
	ThemeEditor,
} from "../../../src/mainview/components/ThemeEditor/ThemeEditorDialog";
import {
	EDITOR_ADVANCED_LABEL,
	EDITOR_CHIP_PAIR_ATTR,
	EDITOR_CHIP_STATUS_ATTR,
	EDITOR_CHIP_TESTID,
	EDITOR_CLOSE_LABEL,
	EDITOR_COUNTS_TESTID,
	EDITOR_DERIVED_TAG,
	EDITOR_DIALOG_LABEL,
	EDITOR_DISCARD_LABEL,
	EDITOR_FIELD_ATTR,
	EDITOR_HIDE_LABEL,
	EDITOR_PEEK_LABEL,
	EDITOR_RESET_LABEL,
	EDITOR_SAVE_STATUS_TESTID,
	EDITOR_SUGGEST_FIX_LABEL,
	editorPillLabel,
} from "../../../src/mainview/lib/domContract";
import { REQUIRED_FIELDS } from "../../../src/mainview/lib/themeEditor";
import { usePreferencesStore } from "../../../src/mainview/store/preferencesStore";
import { useThemeStore } from "../../../src/mainview/store/themeStore";
import { THEME_IDS, themeForId } from "../../../src/mainview/themes";

/** A twelve-colour user theme: every optional token is derived. */
const mine: ThemeFile = {
	id: "mine",
	meta: { name: "Mine", mode: "dark" },
	colors: Object.fromEntries(
		REQUIRED_FIELDS.map((f) => [f.key, themeForId("dark").colors[f.key]]),
	),
};

const dialog = () => screen.getByRole("dialog", { name: EDITOR_DIALOG_LABEL });
const hexInput = (token: string) =>
	document.querySelector(
		`input[${EDITOR_FIELD_ATTR}="${token}"]`,
	) as HTMLInputElement;
// The wrapper carries the same attribute as its text input; walk up from the
// input's parent so the wrapper, not the input, is returned.
const fieldOf = (token: string) =>
	hexInput(token).parentElement?.closest(
		`[${EDITOR_FIELD_ATTR}]`,
	) as HTMLElement;
const chip = (root: HTMLElement, pairId: string) =>
	root.querySelector(
		`[data-testid="${EDITOR_CHIP_TESTID}"][${EDITOR_CHIP_PAIR_ATTR}="${pairId}"]`,
	) as HTMLElement;
const draft = () => useThemeStore.getState().draft;
const type = (token: string, value: string) =>
	fireEvent.change(hexInput(token), { target: { value } });

function open(file: ThemeFile = mine) {
	render(<ThemeEditor />);
	act(() => {
		useThemeStore
			.getState()
			.setUserThemes([{ id: file.id, file, requiredFailures: 0 }]);
		openThemeEditor(file);
	});
	return dialog();
}

beforeEach(() => {
	vi.clearAllMocks();
	rpc.writeTheme.mockResolvedValue({ ok: true, id: "mine" });
	useThemeStore.setState({
		preference: "dark",
		resolvedTheme: "dark",
		userThemes: [],
		draft: null,
	});
	usePreferencesStore.setState({ open: false });
});

afterEach(() => {
	cleanup();
	useThemeStore.setState({ draft: null });
});

describe("ThemeEditor", () => {
	it("stays unmounted until a draft is opened, then is a labelled non-modal dialog on the draft", () => {
		render(<ThemeEditor />);
		expect(screen.queryByRole("dialog")).toBeNull();
		act(() => openThemeEditor(mine));
		const d = dialog();
		expect(d.getAttribute("aria-modal")).not.toBe("true");
		expect(draft()).toEqual(mine);
		expect(within(d).getByText("Editing Mine")).toBeTruthy();
	});

	it("renders the twelve required fields first, in contract order, each with a swatch and a labelled hex input", () => {
		open();
		const inputs = [
			...document.querySelectorAll(`input[${EDITOR_FIELD_ATTR}]`),
		];
		expect(
			inputs.slice(0, 12).map((i) => i.getAttribute(EDITOR_FIELD_ATTR)),
		).toEqual(REQUIRED_FIELDS.map((f) => f.token));
		for (const f of REQUIRED_FIELDS) {
			expect(screen.getByLabelText(f.label)).toBe(hexInput(f.token));
			const row = fieldOf(f.token);
			expect(row.querySelector('input[type="color"]')).toBeTruthy();
		}
		expect(hexInput("--rv-text-primary").value).toBe(
			mine.colors["text-primary"],
		);
	});

	it("typing a valid hex updates the draft; an invalid one does not and marks the field", () => {
		open();
		type("--rv-text-primary", "#ff0000");
		expect(draft()?.colors["text-primary"]).toBe("#ff0000");
		expect(hexInput("--rv-text-primary").getAttribute("aria-invalid")).not.toBe(
			"true",
		);

		type("--rv-text-primary", "#12");
		expect(draft()?.colors["text-primary"]).toBe("#ff0000");
		expect(hexInput("--rv-text-primary").getAttribute("aria-invalid")).toBe(
			"true",
		);
		// Leaving the field restores the last good value.
		fireEvent.blur(hexInput("--rv-text-primary"));
		expect(hexInput("--rv-text-primary").value).toBe("#ff0000");
		expect(hexInput("--rv-text-primary").getAttribute("aria-invalid")).not.toBe(
			"true",
		);
	});

	it("the swatch picker writes the hex too", () => {
		open();
		const swatch = fieldOf("--rv-accent").querySelector(
			'input[type="color"]',
		) as HTMLInputElement;
		fireEvent.change(swatch, { target: { value: "#00ff00" } });
		expect(draft()?.colors.accent).toBe("#00ff00");
		expect(hexInput("--rv-accent").value).toBe("#00ff00");
	});

	it("Advanced shows every optional token with its derived value and a derived tag; Reset removes an edited key", () => {
		open();
		expect(hexInput("--rv-text-tertiary")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: EDITOR_ADVANCED_LABEL }),
		);

		const tertiary = fieldOf("--rv-text-tertiary");
		expect(within(tertiary).getByText(EDITOR_DERIVED_TAG)).toBeTruthy();
		// Derived from text-secondary (themeSchema rule).
		expect(hexInput("--rv-text-tertiary").value).toBe(
			mine.colors["text-secondary"],
		);
		expect(
			within(tertiary).queryByRole("button", { name: EDITOR_RESET_LABEL }),
		).toBeNull();

		type("--rv-text-tertiary", "#ff00ff");
		expect(draft()?.colors["text-tertiary"]).toBe("#ff00ff");
		expect(
			within(fieldOf("--rv-text-tertiary")).queryByText(EDITOR_DERIVED_TAG),
		).toBeNull();

		fireEvent.click(
			within(fieldOf("--rv-text-tertiary")).getByRole("button", {
				name: EDITOR_RESET_LABEL,
			}),
		);
		expect("text-tertiary" in (draft()?.colors ?? {})).toBe(false);
		expect(hexInput("--rv-text-tertiary").value).toBe(
			mine.colors["text-secondary"],
		);
		expect(
			within(fieldOf("--rv-text-tertiary")).getByText(EDITOR_DERIVED_TAG),
		).toBeTruthy();

		// Non-colour knobs are plain text inputs validated by their grammar.
		type("--rv-radius-md", "12");
		expect(draft()?.shape).toBeUndefined();
		type("--rv-radius-md", "12px");
		expect(draft()?.shape).toEqual({ "radius-md": "12px" });
	});

	it("the header counts and the field chips follow the draft; Suggest fix applies a passing ink", () => {
		open();
		const counts = () =>
			screen.getByTestId(EDITOR_COUNTS_TESTID).textContent ?? "";
		expect(counts()).toMatch(/^0 required failures · \d+ advisory$/);

		// Text the same colour as the app background: every text-primary pair fails.
		type("--rv-text-primary", mine.colors["bg-base"]);
		expect(counts()).not.toMatch(/^0 required/);
		const row = fieldOf("--rv-text-primary");
		const onBase = chip(row, "text-primary-on-base");
		expect(onBase.getAttribute(EDITOR_CHIP_STATUS_ATTR)).toBe("fail");
		expect(onBase.textContent).toBe("fail");

		const fix = within(onBase.closest("li") as HTMLElement).getByRole(
			"button",
			{ name: EDITOR_SUGGEST_FIX_LABEL },
		);
		fireEvent.click(fix);
		expect(draft()?.colors["text-primary"]).not.toBe(mine.colors["bg-base"]);
		expect(
			chip(fieldOf("--rv-text-primary"), "text-primary-on-base").getAttribute(
				EDITOR_CHIP_STATUS_ATTR,
			),
		).toBe("pass");
	});

	it("a surface field lists its pairs without a Suggest fix button", () => {
		open();
		type("--rv-bg-node", mine.colors["text-primary"]);
		const card = fieldOf("--rv-bg-node");
		const title = chip(card, "node-title");
		expect(title.getAttribute(EDITOR_CHIP_STATUS_ATTR)).toBe("fail");
		expect(
			within(card).queryByRole("button", { name: EDITOR_SUGGEST_FIX_LABEL }),
		).toBeNull();
	});

	it("autosaves 500 ms after the last accepted change through writeTheme and reports it", async () => {
		open();
		type("--rv-accent", "#00ff00");
		type("--rv-accent", "#00ff01");
		expect(rpc.writeTheme).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(rpc.writeTheme).toHaveBeenCalledTimes(1));
		expect(rpc.writeTheme).toHaveBeenCalledWith({
			file: { ...mine, colors: { ...mine.colors, accent: "#00ff01" } },
			reservedIds: [...THEME_IDS],
		});
		await vi.waitFor(() =>
			expect(screen.getByTestId(EDITOR_SAVE_STATUS_TESTID).textContent).toBe(
				"Saved · just now",
			),
		);
		// The store's list entry follows the write, so the picker badge and the
		// paint after close agree with the file on disk.
		expect(useThemeStore.getState().userThemes[0].file?.colors.accent).toBe(
			"#00ff01",
		);
	});

	it("a failed write is reported and the draft stays as typed", async () => {
		rpc.writeTheme.mockResolvedValue({
			ok: false,
			error: "disk full",
		} as never);
		open();
		type("--rv-accent", "#00ff00");
		await vi.waitFor(() =>
			expect(screen.getByTestId(EDITOR_SAVE_STATUS_TESTID).textContent).toBe(
				"Could not save: disk full",
			),
		);
		expect(draft()?.colors.accent).toBe("#00ff00");
		expect(hexInput("--rv-accent").value).toBe("#00ff00");
	});

	// RC1 (D-10): with a 500 ms autosave, `saved` equalled the draft by the
	// time "Revert to saved" could be pressed, so it never reverted anything
	// (the RED case changed a field, waited for "Saved · just now", pressed
	// Revert and found the field unchanged). The button is gone.
	it("has no Revert button; the save status and autosave are unchanged", async () => {
		open();
		expect(screen.queryByRole("button", { name: /revert/i })).toBeNull();
		type("--rv-accent", "#00ff00");
		await vi.waitFor(() =>
			expect(screen.getByTestId(EDITOR_SAVE_STATUS_TESTID).textContent).toBe(
				"Saved · just now",
			),
		);
		expect(screen.queryByRole("button", { name: /revert/i })).toBeNull();
		expect(hexInput("--rv-accent").value).toBe("#00ff00");
	});

	it("Hide collapses to a pill that names the theme and keeps the draft painted; the pill restores the dialog", () => {
		open();
		type("--rv-accent", "#00ff00");
		fireEvent.click(screen.getByRole("button", { name: EDITOR_HIDE_LABEL }));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(draft()?.colors.accent).toBe("#00ff00");
		const pill = screen.getByRole("button", { name: editorPillLabel("Mine") });
		fireEvent.click(pill);
		expect(dialog()).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: editorPillLabel("Mine") }),
		).toBeNull();
		expect(hexInput("--rv-accent").value).toBe("#00ff00");
	});

	it("Peek makes the dialog translucent while the eye button or Alt is held", () => {
		const d = open();
		const eye = screen.getByRole("button", { name: EDITOR_PEEK_LABEL });
		fireEvent.pointerDown(eye);
		expect(d.style.opacity).toBe("0.12");
		expect(d.style.pointerEvents).toBe("none");
		fireEvent.pointerUp(eye);
		expect(d.style.opacity).toBe("1");

		fireEvent.keyDown(eye, { key: " " });
		expect(d.style.opacity).toBe("0.12");
		fireEvent.keyUp(eye, { key: " " });
		expect(d.style.opacity).toBe("1");

		hexInput("--rv-accent").focus();
		fireEvent.keyDown(hexInput("--rv-accent"), { key: "Alt" });
		expect(d.style.opacity).toBe("0.12");
		fireEvent.keyUp(hexInput("--rv-accent"), { key: "Alt" });
		expect(d.style.opacity).toBe("1");
	});

	it("Escape closes only when focus is inside the dialog; closing clears the draft and returns to Preferences", async () => {
		open();
		// The user clicked the canvas: focus is outside the dialog.
		act(() => {
			(document.activeElement as HTMLElement | null)?.blur();
			fireEvent.keyDown(document.body, { key: "Escape" });
		});
		expect(dialog()).toBeTruthy();
		expect(draft()).not.toBeNull();

		hexInput("--rv-accent").focus();
		act(() => {
			fireEvent.keyDown(hexInput("--rv-accent"), { key: "Escape" });
		});
		await vi.waitFor(() => expect(draft()).toBeNull());
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(usePreferencesStore.getState().open).toBe(true);
	});

	it("closing flushes a pending change first; a change that cannot be saved asks before discarding", async () => {
		open();
		type("--rv-accent", "#00ff00");
		fireEvent.click(screen.getByRole("button", { name: EDITOR_CLOSE_LABEL }));
		await vi.waitFor(() => expect(draft()).toBeNull());
		expect(rpc.writeTheme).toHaveBeenCalledTimes(1);
		cleanup();

		rpc.writeTheme.mockResolvedValue({
			ok: false,
			error: "read-only",
		} as never);
		open();
		type("--rv-accent", "#0000ff");
		fireEvent.click(screen.getByRole("button", { name: EDITOR_CLOSE_LABEL }));
		const discard = await screen.findByRole("button", {
			name: EDITOR_DISCARD_LABEL,
		});
		expect(draft()).not.toBeNull();
		fireEvent.click(discard);
		expect(draft()).toBeNull();
	});
});
