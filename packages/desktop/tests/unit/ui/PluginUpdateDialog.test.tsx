/** @vitest-environment jsdom */
// v0.9 Phase 2 — the plugin install / update dialog runs the fixed commands.
import "@testing-library/jest-dom";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	commandLine,
	PLUGIN_UPDATE_STEPS,
} from "../../../../../shared/claudePlugin";

const rpc = vi.hoisted(() => ({
	getSetupStatus: vi.fn(),
	runPluginCommands: vi.fn(),
	dismissPluginInstall: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpc } },
}));

import {
	openPluginDialog,
	PLUGIN_AUTO_UPDATE_TEXT,
	PLUGIN_DIALOG_COPY,
	PLUGIN_RESTART_TEXT,
	PluginUpdateDialog,
} from "../../../src/mainview/components/PluginUpdateDialog";

const step = (i: number, status: "ok" | "error", detail?: string) => ({
	id: `plugin-${i}`,
	label: commandLine([PLUGIN_UPDATE_STEPS[i]]),
	status,
	detail,
	host: "claude" as const,
});

async function renderDialog(offerPluginInstall = false) {
	rpc.getSetupStatus.mockResolvedValue({ offerPluginInstall });
	await act(async () => {
		render(<PluginUpdateDialog />);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
		writable: true,
		configurable: true,
	});
});

afterEach(() => {
	cleanup();
	act(() => openPluginDialog(null));
});

describe("PluginUpdateDialog", () => {
	it("update: runs kind 'update', shows each step, then the restart line", async () => {
		rpc.runPluginCommands.mockResolvedValue({
			ok: true,
			steps: [0, 1, 2, 3].map((i) => step(i, "ok")),
		});
		await renderDialog();
		act(() => openPluginDialog("update"));
		expect(screen.getByText(PLUGIN_DIALOG_COPY.update.title)).toBeVisible();
		expect(screen.getByText(PLUGIN_AUTO_UPDATE_TEXT)).toBeInTheDocument();
		expect(screen.queryByText(PLUGIN_RESTART_TEXT)).not.toBeInTheDocument();

		await act(async () => {
			fireEvent.click(screen.getByText(PLUGIN_DIALOG_COPY.update.button));
		});
		expect(rpc.runPluginCommands).toHaveBeenCalledWith({ kind: "update" });
		for (const args of PLUGIN_UPDATE_STEPS) {
			expect(screen.getByText(commandLine([args]))).toBeInTheDocument();
		}
		expect(screen.getByText(PLUGIN_RESTART_TEXT)).toBeInTheDocument();
	});

	it("a failed step shows its error and the commands to copy", async () => {
		rpc.runPluginCommands.mockResolvedValue({
			ok: false,
			steps: [step(0, "ok"), step(1, "error", "git clone failed")],
		});
		await renderDialog();
		act(() => openPluginDialog("update"));
		await act(async () => {
			fireEvent.click(screen.getByText(PLUGIN_DIALOG_COPY.update.button));
		});
		expect(screen.getByText("git clone failed")).toBeInTheDocument();
		const all = commandLine(PLUGIN_UPDATE_STEPS);
		expect(screen.getByText(all)).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByText("Copy"));
		});
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(all);
		expect(screen.queryByText(PLUGIN_RESTART_TEXT)).not.toBeInTheDocument();
	});

	it("a failed request shows the error and the commands", async () => {
		rpc.runPluginCommands.mockRejectedValue(new Error("RPC timed out"));
		await renderDialog();
		act(() => openPluginDialog("update"));
		await act(async () => {
			fireEvent.click(screen.getByText(PLUGIN_DIALOG_COPY.update.button));
		});
		expect(screen.getByText(/RPC timed out/)).toBeInTheDocument();
		expect(
			screen.getByText(commandLine(PLUGIN_UPDATE_STEPS)),
		).toBeInTheDocument();
	});

	it("offers the install when Bun says so; closing it is remembered", async () => {
		rpc.runPluginCommands.mockResolvedValue({ ok: true, steps: [] });
		await renderDialog(true);
		expect(screen.getByText(PLUGIN_DIALOG_COPY.install.title)).toBeVisible();
		await act(async () => {
			fireEvent.click(screen.getByText(PLUGIN_DIALOG_COPY.install.button));
		});
		expect(rpc.runPluginCommands).toHaveBeenCalledWith({ kind: "install" });
		fireEvent.click(screen.getByText("Close"));
		expect(rpc.dismissPluginInstall).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByText(PLUGIN_DIALOG_COPY.install.title),
		).not.toBeInTheDocument();
	});

	it("stays closed when there is nothing to offer", async () => {
		await renderDialog(false);
		expect(
			screen.queryByText(PLUGIN_DIALOG_COPY.install.title),
		).not.toBeInTheDocument();
		expect(rpc.dismissPluginInstall).not.toHaveBeenCalled();
	});
});
