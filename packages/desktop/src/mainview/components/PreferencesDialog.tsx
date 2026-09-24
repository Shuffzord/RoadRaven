import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState } from "react";
import type { AppSettings } from "../../../../../shared/types";
import { APP_VERSION } from "../lib/appVersion";
import { electroview } from "../rpc";
import { useEventApiStore } from "../store/eventApiStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useSetupStore } from "../store/setupStore";
import {
	dialogActionRowStyle,
	dialogButtonRowStyle,
	dialogDescriptionStyle,
	dialogErrorTextStyle,
	dialogFieldLabelStyle,
	dialogFieldRowStyle,
	dialogHelperTextStyle,
	dialogInputStyle,
	dialogPrimaryButtonStyle,
	dialogScrollContentStyle,
	dialogSecondaryButtonStyle,
	dialogSectionHeadingStyle,
	dialogSectionStyle,
	dialogTitleStyle,
} from "./dialogStyles";
import { ThemePicker } from "./ThemePicker";

const DOCS_URL = "https://github.com/Shuffzord/RoadRaven#readme";
const RELEASES_URL = "https://github.com/Shuffzord/RoadRaven/releases/latest";
const PORT_MIN = 1024;
const PORT_MAX = 65535;

type Rpc = NonNullable<NonNullable<typeof electroview>["rpc"]>;

/** Current settings, or `{}` when the RPC is unavailable or fails. */
async function fetchSettings(rpc: Rpc | undefined): Promise<AppSettings> {
	if (!rpc) return {};
	try {
		return (await rpc.request.loadSettings({})).settings;
	} catch {
		return {};
	}
}

/** "" → automatic (undefined); otherwise an integer in the user range. */
function parsePort(
	text: string,
): { port: number | undefined } | { error: string } {
	if (text === "") return { port: undefined };
	const port = Number(text);
	if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
		return {
			error: `Enter a port between ${PORT_MIN} and ${PORT_MAX}, or leave it empty for automatic.`,
		};
	}
	return { port };
}

function describeEventApi(
	status: "off" | "listening" | "error",
	port: number | null,
	errorMessage: string | null,
): string {
	if (status === "listening") return `Listening on ${port}`;
	if (status === "error") return `Error: ${errorMessage ?? "unknown"}`;
	return "Off";
}

/**
 * Preferences (v0.8.2 D5-A / F8 / A8). Every control persists as it changes
 * — there is no Save button, matching the autosave-first app. Nested
 * settings objects (`eventApi`, `agentApi`) are replaced, not merged, by the
 * saveSettings RPC, so each patch sends the whole nested object.
 */
export function PreferencesDialog() {
	const open = usePreferencesStore((s) => s.open);
	const closePreferences = usePreferencesStore((s) => s.closePreferences);
	const eventApiStatus = useEventApiStore((s) => s.status);
	const eventApiPort = useEventApiStore((s) => s.port);
	const eventApiError = useEventApiStore((s) => s.errorMessage);
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [portText, setPortText] = useState("");
	const [portError, setPortError] = useState<string | null>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const id = useId();

	// Load the current values each time the dialog opens.
	useEffect(() => {
		if (!open) {
			setSettings(null);
			setPortError(null);
			return;
		}
		let cancelled = false;
		const rpc = electroview?.rpc;
		void fetchSettings(rpc).then((loaded) => {
			if (cancelled) return;
			setSettings(loaded);
			setPortText(loaded.eventApi?.port?.toString() ?? "");
		});
		return () => {
			cancelled = true;
		};
	}, [open]);

	const update = (patch: Partial<AppSettings>): void => {
		setSettings((current) => ({ ...current, ...patch }));
		electroview?.rpc?.request.saveSettings({ settings: patch }).catch(() => {
			// RPC unavailable outside Electrobun (HMR dev server).
		});
	};

	const commitPort = (): void => {
		const parsed = parsePort(portText.trim());
		if ("error" in parsed) {
			setPortError(parsed.error);
			return;
		}
		setPortError(null);
		if (parsed.port === settings?.eventApi?.port) return;
		update({
			eventApi: parsed.port === undefined ? {} : { port: parsed.port },
		});
	};

	const openWizard = (): void => {
		closePreferences();
		useSetupStore.getState().openWizard();
	};

	const openLink = (url: string): void => {
		electroview?.rpc?.request.openExternal({ url }).catch(() => {
			// Nothing to fall back to outside Electrobun.
		});
	};

	const statusLine = describeEventApi(
		eventApiStatus,
		eventApiPort,
		eventApiError,
	);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) closePreferences();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				<Dialog.Content
					ref={contentRef}
					aria-modal="true"
					style={dialogScrollContentStyle}
					// Land on the dialog itself so Tab walks the sections in order
					// instead of starting on whichever control mounted first.
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						contentRef.current?.focus();
					}}
				>
					<Dialog.Title style={dialogTitleStyle}>Preferences</Dialog.Title>
					<Dialog.Description style={dialogDescriptionStyle}>
						Changes are saved as you make them.
					</Dialog.Description>

					{settings && (
						<>
							<section
								aria-labelledby={`${id}-appearance`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-appearance`} style={dialogSectionHeadingStyle}>
									Appearance
								</h3>
								<div style={dialogFieldRowStyle}>
									<span style={dialogFieldLabelStyle}>Theme</span>
									<ThemePicker />
								</div>
							</section>

							<section
								aria-labelledby={`${id}-startup`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-startup`} style={dialogSectionHeadingStyle}>
									Startup
								</h3>
								<div style={dialogFieldRowStyle}>
									<label htmlFor={`${id}-reopen`} style={dialogFieldLabelStyle}>
										Reopen last roadmap on launch
									</label>
									<input
										id={`${id}-reopen`}
										type="checkbox"
										checked={settings.reopenLastFile !== false}
										onChange={(e) =>
											update({ reopenLastFile: e.target.checked })
										}
									/>
								</div>
							</section>

							<section
								aria-labelledby={`${id}-event-api`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-event-api`} style={dialogSectionHeadingStyle}>
									Event API
								</h3>
								<div style={dialogFieldRowStyle}>
									<label htmlFor={`${id}-port`} style={dialogFieldLabelStyle}>
										WebSocket port
									</label>
									<input
										id={`${id}-port`}
										type="number"
										inputMode="numeric"
										min={PORT_MIN}
										max={PORT_MAX}
										placeholder="automatic"
										value={portText}
										onChange={(e) => setPortText(e.target.value)}
										onBlur={commitPort}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												commitPort();
											}
										}}
										aria-invalid={portError !== null}
										aria-describedby={
											portError
												? `${id}-port-error ${id}-port-help`
												: `${id}-port-help`
										}
										style={dialogInputStyle}
									/>
								</div>
								{portError && (
									<p
										id={`${id}-port-error`}
										role="alert"
										style={dialogErrorTextStyle}
									>
										{portError}
									</p>
								)}
								<p id={`${id}-port-help`} style={dialogHelperTextStyle}>
									{statusLine}. Changes apply after restart.
								</p>
							</section>

							<section
								aria-labelledby={`${id}-agent-api`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-agent-api`} style={dialogSectionHeadingStyle}>
									Agent API
								</h3>
								<div style={dialogFieldRowStyle}>
									<label htmlFor={`${id}-agent`} style={dialogFieldLabelStyle}>
										Allow AI agents to edit roadmaps (MCP)
									</label>
									<input
										id={`${id}-agent`}
										type="checkbox"
										checked={settings.agentApi?.enabled !== false}
										onChange={(e) =>
											update({ agentApi: { enabled: e.target.checked } })
										}
									/>
								</div>
								<p style={dialogHelperTextStyle}>Takes effect immediately.</p>
							</section>

							<section
								aria-labelledby={`${id}-integrations`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-integrations`} style={dialogSectionHeadingStyle}>
									Integrations
								</h3>
								<button
									type="button"
									onClick={openWizard}
									style={dialogSecondaryButtonStyle}
								>
									Set up Claude Code / OpenCode integration…
								</button>
							</section>

							<section
								aria-labelledby={`${id}-about`}
								style={dialogSectionStyle}
							>
								<h3 id={`${id}-about`} style={dialogSectionHeadingStyle}>
									About
								</h3>
								<p style={dialogFieldLabelStyle}>RoadRaven {APP_VERSION}</p>
								<div style={dialogActionRowStyle}>
									<button
										type="button"
										onClick={() => openLink(DOCS_URL)}
										style={dialogSecondaryButtonStyle}
									>
										Documentation
									</button>
									<button
										type="button"
										onClick={() => openLink(RELEASES_URL)}
										style={dialogSecondaryButtonStyle}
									>
										Releases
									</button>
								</div>
							</section>
						</>
					)}

					<div style={dialogButtonRowStyle}>
						<Dialog.Close asChild>
							<button type="button" style={dialogPrimaryButtonStyle}>
								Done
							</button>
						</Dialog.Close>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
