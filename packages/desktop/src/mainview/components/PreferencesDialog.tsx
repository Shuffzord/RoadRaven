import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState } from "react";
import type { ThemeFile } from "../../../../../shared/themeSchema";
import type { AppSettings } from "../../../../../shared/types";
import { APP_VERSION } from "../lib/appVersion";
import {
	CREATE_THEME_LABEL,
	EDIT_THEME_LABEL,
	THEME_NAME_LABEL,
} from "../lib/domContract";
import { slugify } from "../lib/themeEditor";
import { electroview } from "../rpc";
import { useEventApiStore } from "../store/eventApiStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useSetupStore } from "../store/setupStore";
import { userThemeFiles, useThemeStore } from "../store/themeStore";
import { getBuiltInTheme, resolveThemeFile, THEME_IDS } from "../themes";
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
import {
	openThemeEditor,
	takeEditorReturnFocus,
} from "./ThemeEditor/ThemeEditorDialog";
import { ThemePicker } from "./ThemePicker";

const DOCS_URL = "https://github.com/Shuffzord/RoadRaven#readme";
const RELEASES_URL = "https://github.com/Shuffzord/RoadRaven/releases/latest";
const PORT_MIN = 1024;
const PORT_MAX = 65535;

// Theme row actions (v0.8.3 Phase 4) — the tests select on these.
export const DUPLICATE_THEME_LABEL = "Duplicate current theme…";
export const IMPORT_THEME_LABEL = "Import theme file…";
export const OPEN_THEMES_FOLDER_LABEL = "Open themes folder";
// The name prompt's label moved to lib/domContract.ts (Phase 5: the a11y
// spec drives it); re-exported so nothing that imported it here breaks.
export { THEME_NAME_LABEL };

type Rpc = NonNullable<NonNullable<typeof electroview>["rpc"]>;

type ThemeMessage = { kind: "info" | "error"; text: string };

/** What the name prompt is for: a plain copy, or a copy to edit (Phase 5). */
type Naming = "duplicate" | "edit" | null;

/**
 * The copy the editor opens when Bun cannot write one (no RPC: the HMR dev
 * server and the a11y preview bundle). Same shape as Bun's duplicateTheme:
 * the slug of the name as id, renamed, author unset. Its autosave then
 * reports "Could not save" — the editor still works as a preview.
 */
function localCopy(source: ThemeFile, name: string): ThemeFile | null {
	const id = slugify(name);
	if (!id) return null;
	const { author: _author, ...meta } = source.meta;
	return { ...source, id, meta: { ...meta, name: name.trim() } };
}

/**
 * The Theme row's file actions: edit the painted theme (a built-in is
 * duplicated first, Phase 5), duplicate it under a new name (and select
 * it), import a file, reveal the folder. Every write goes through Bun,
 * which validates and names the file; the renderer only refreshes the list
 * afterwards.
 */
function ThemeFileActions({ id }: { id: string }) {
	const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
	const userThemes = useThemeStore((s) => s.userThemes);
	const [naming, setNaming] = useState<Naming>(null);
	const [name, setName] = useState("");
	const [message, setMessage] = useState<ThemeMessage | null>(null);
	const editRef = useRef<HTMLButtonElement>(null);
	const current = resolveThemeFile(resolvedTheme, userThemeFiles(userThemes));
	const reservedIds = [...THEME_IDS];

	// Back from the editor: focus lands on the control that opened it.
	useEffect(() => {
		if (takeEditorReturnFocus()) editRef.current?.focus();
	}, []);

	const startNaming = (purpose: Naming): void => {
		setMessage(null);
		setName(`${current.meta.name} copy`);
		setNaming(purpose);
	};

	const startEdit = (): void => {
		if (getBuiltInTheme(current.id)) startNaming("edit");
		else openThemeEditor(current);
	};

	// No RPC (HMR dev server, preview bundle): only "Edit…" has a fallback,
	// the in-memory copy; a plain duplicate has nowhere to write.
	const commitOffline = (): void => {
		if (naming !== "edit") return;
		const copy = localCopy(current, name);
		if (copy) openThemeEditor(copy);
		else
			setMessage({ kind: "error", text: "the name needs a letter or digit" });
	};

	/** The copy as Bun wrote and re-listed it (the in-memory copy as a fallback). */
	const writtenCopy = (id: string): ThemeFile =>
		useThemeStore.getState().userThemes.find((e) => e.id === id)?.file ??
		localCopy(current, name) ??
		current;

	const commitName = async (): Promise<void> => {
		const rpc = electroview?.rpc;
		if (!rpc) return commitOffline();
		const result = await rpc.request.duplicateTheme({
			source: current,
			name,
			reservedIds,
		});
		if (!result.ok) return setMessage({ kind: "error", text: result.error });
		const purpose = naming;
		setNaming(null);
		const store = useThemeStore.getState();
		await store.refreshUserThemes();
		store.setTheme(result.id);
		if (purpose === "edit") openThemeEditor(writtenCopy(result.id));
	};

	const importTheme = async (): Promise<void> => {
		const rpc = electroview?.rpc;
		if (!rpc) return;
		setMessage(null);
		const result = await rpc.request.importTheme({ reservedIds });
		if (!result.ok) {
			if (result.error !== null)
				setMessage({ kind: "error", text: result.error });
			return;
		}
		await useThemeStore.getState().refreshUserThemes();
		setMessage({ kind: "info", text: `Imported '${result.id}'.` });
	};

	const revealFolder = (): void => {
		electroview?.rpc?.request.revealThemesFolder({}).catch(() => {
			// Nothing to fall back to outside Electrobun.
		});
	};

	return (
		<>
			<div style={dialogActionRowStyle}>
				<button
					ref={editRef}
					type="button"
					onClick={startEdit}
					style={dialogSecondaryButtonStyle}
				>
					{EDIT_THEME_LABEL}
				</button>
				<button
					type="button"
					onClick={() => startNaming("duplicate")}
					style={dialogSecondaryButtonStyle}
				>
					{DUPLICATE_THEME_LABEL}
				</button>
				<button
					type="button"
					onClick={() => void importTheme()}
					style={dialogSecondaryButtonStyle}
				>
					{IMPORT_THEME_LABEL}
				</button>
				<button
					type="button"
					onClick={revealFolder}
					style={dialogSecondaryButtonStyle}
				>
					{OPEN_THEMES_FOLDER_LABEL}
				</button>
			</div>
			{naming !== null && (
				<form
					style={dialogFieldRowStyle}
					onSubmit={(e) => {
						e.preventDefault();
						void commitName();
					}}
				>
					<label htmlFor={`${id}-theme-name`} style={dialogFieldLabelStyle}>
						{THEME_NAME_LABEL}
					</label>
					<input
						id={`${id}-theme-name`}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						style={dialogInputStyle}
					/>
					<button type="submit" style={dialogPrimaryButtonStyle}>
						{CREATE_THEME_LABEL}
					</button>
					<button
						type="button"
						onClick={() => setNaming(null)}
						style={dialogSecondaryButtonStyle}
					>
						Cancel
					</button>
				</form>
			)}
			{message && (
				<p
					role={message.kind === "error" ? "alert" : "status"}
					style={
						message.kind === "error"
							? dialogErrorTextStyle
							: dialogHelperTextStyle
					}
				>
					{message.text}
				</p>
			)}
		</>
	);
}

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
								<ThemeFileActions id={id} />
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
