/** @vitest-environment jsdom */
// v0.9 Phase 1 — the Setup Wizard installs the RoadRaven Claude Code plugin.
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
	PLUGIN_INSTALL_STEPS,
} from "../../../../../shared/claudePlugin";

const rpc = vi.hoisted(() => ({
	getSetupStatus: vi.fn(),
	installMcpIntegration: vi.fn(),
	completeSetup: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpc } },
}));

import {
	CLAUDE_REINSTALL_LABEL,
	DONE_PLUGIN_TEXT,
	SetupWizard,
} from "../../../src/mainview/components/SetupWizard";

const baseStatus = {
	firstRun: true,
	claudeDetected: true,
	mcpServerAvailable: true,
	mcpInstalled: false,
	appVersion: "0.9.0",
	openCodeDetected: false,
	openCodeInstalled: false,
	pluginInstalled: true,
};

const pluginSteps = [
	{
		id: "plugin-0",
		label: "claude plugin marketplace add Shuffzord/RoadRaven",
		status: "ok",
		host: "claude",
	},
	{
		id: "plugin-1",
		label: "claude plugin install roadraven@roadraven",
		status: "ok",
		host: "claude",
	},
];

async function openMcpStep() {
	render(<SetupWizard />);
	fireEvent.click(await screen.findByText("Get started"));
}

beforeEach(() => {
	vi.clearAllMocks();
	rpc.getSetupStatus.mockResolvedValue(baseStatus);
	rpc.installMcpIntegration.mockResolvedValue({ ok: true, steps: pluginSteps });
});

afterEach(() => cleanup());

describe("SetupWizard — Claude Code plugin", () => {
	it("keeps the Claude row selectable when the plugin is already installed", async () => {
		await openMcpStep();
		const box = screen.getByLabelText(
			CLAUDE_REINSTALL_LABEL,
		) as HTMLInputElement;
		expect(box.disabled).toBe(false);
		fireEvent.click(box);
		expect(box.checked).toBe(true);
	});

	it("installs for Claude and shows the plugin steps in the log", async () => {
		await openMcpStep();
		fireEvent.click(screen.getByLabelText(CLAUDE_REINSTALL_LABEL));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /install/i }));
		});
		expect(rpc.installMcpIntegration).toHaveBeenCalledWith({
			hosts: ["claude"],
		});
		for (const s of pluginSteps) expect(screen.getByText(s.label)).toBeTruthy();
	});

	it("shows Installing… while the install runs", async () => {
		const pending = Promise.withResolvers<unknown>();
		rpc.installMcpIntegration.mockReturnValue(pending.promise);
		await openMcpStep();
		fireEvent.click(screen.getByLabelText(CLAUDE_REINSTALL_LABEL));
		fireEvent.click(screen.getByRole("button", { name: /install/i }));
		expect(screen.getByRole("button", { name: "Installing…" })).toBeTruthy();
		await act(async () => pending.resolve({ ok: true, steps: pluginSteps }));
	});

	it("shows a step detail's commands one per line", async () => {
		const detail = `Run these in a terminal:\n${commandLine(PLUGIN_INSTALL_STEPS)}`;
		rpc.installMcpIntegration.mockResolvedValue({
			ok: true,
			steps: [
				{
					id: "plugin-fallback",
					label: "Install the RoadRaven plugin yourself",
					status: "skipped",
					detail,
					host: "claude",
				},
			],
		});
		await openMcpStep();
		fireEvent.click(screen.getByLabelText(CLAUDE_REINSTALL_LABEL));
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /install/i }));
		});
		const el = screen.getByText((_, e) => e?.textContent === detail);
		for (const command of commandLine(PLUGIN_INSTALL_STEPS).split("\n")) {
			expect(el.textContent).toContain(command);
		}
		expect(el).toHaveStyle({ whiteSpace: "pre-line" });
	});

	it("counts the plugin as installed on the last step", async () => {
		await openMcpStep();
		fireEvent.click(screen.getByText("Continue"));
		expect(screen.getByText(DONE_PLUGIN_TEXT)).toBeTruthy();
	});
});
