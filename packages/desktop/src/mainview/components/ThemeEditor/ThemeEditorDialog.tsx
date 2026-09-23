import * as Dialog from "@radix-ui/react-dialog";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ThemeFile } from "../../../../../../shared/themeSchema";
import {
	EDITOR_CLOSE_LABEL,
	EDITOR_COUNTS_TESTID,
	EDITOR_DIALOG_LABEL,
	EDITOR_DISCARD_LABEL,
	EDITOR_HIDE_LABEL,
	EDITOR_KEEP_EDITING_LABEL,
	EDITOR_PEEK_LABEL,
	EDITOR_SAVE_STATUS_TESTID,
} from "../../lib/domContract";
import {
	applyFieldChange,
	type ThemeVerdicts,
	verdictsFor,
} from "../../lib/themeEditor";
import { electroview } from "../../rpc";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useThemeStore } from "../../store/themeStore";
import { THEME_IDS } from "../../themes";
import {
	dialogContentStyle,
	dialogErrorTextStyle,
	dialogHelperTextStyle,
	dialogPrimaryButtonStyle,
	dialogSecondaryButtonStyle,
	dialogTitleStyle,
} from "../dialogStyles";
import { EditorPill } from "./EditorPill";
import { ThemeEditorFields } from "./ThemeEditorFields";

const AUTOSAVE_MS = 500;
const PEEK_OPACITY = 0.12;

// Anchored right, over the canvas, which stays interactive underneath.
const contentStyle: CSSProperties = {
	...dialogContentStyle,
	top: 56,
	right: 16,
	bottom: 48,
	left: "auto",
	transform: "none",
	width: 440,
	maxWidth: "calc(100vw - 32px)",
	padding: 16,
	overflowY: "auto",
	display: "flex",
	flexDirection: "column",
	gap: 12,
};

const headerStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	flexWrap: "wrap",
};

const iconButtonStyle: CSSProperties = {
	...dialogSecondaryButtonStyle,
	padding: "4px 8px",
	fontSize: 12,
};

const statusRowStyle: CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	gap: 12,
	fontSize: 12,
	color: "var(--rv-text-secondary)",
};

type SaveStatus =
	| { kind: "saved" }
	| { kind: "saving" }
	| { kind: "error"; reason: string };

function statusText(status: SaveStatus): string {
	switch (status.kind) {
		case "saved":
			return "Saved · just now";
		case "saving":
			return "Saving…";
		case "error":
			return `Could not save: ${status.reason}`;
	}
}

// Set when the editor closes so Preferences, which reopens, lands focus on
// its "Edit…" button (the control that opened the editor).
let returnFocusPending = false;

/** True once, right after the editor closed; Preferences focuses "Edit…". */
export function takeEditorReturnFocus(): boolean {
	const pending = returnFocusPending;
	returnFocusPending = false;
	return pending;
}

/**
 * Opens the editor on a user theme file. Preferences is modal, so it closes
 * first; the draft makes ThemeProvider paint the file being edited.
 */
export function openThemeEditor(file: ThemeFile): void {
	usePreferencesStore.getState().closePreferences();
	const store = useThemeStore.getState();
	// A copy Bun could not write (no RPC: the HMR dev server, the a11y
	// preview bundle) is still a user theme while it is being edited: list
	// it so the picker shows it under "Your themes" (Phase 7, D-11).
	if (!store.userThemes.some((e) => e.id === file.id)) {
		store.setUserThemes([
			...store.userThemes,
			{
				id: file.id,
				file,
				requiredFailures: verdictsFor(file).requiredFailures,
			},
		]);
	}
	store.setDraft(file);
}

/** Closes the editor: the draft goes, Preferences comes back on "Edit…". */
function closeThemeEditor(): void {
	returnFocusPending = true;
	useThemeStore.getState().clearDraft();
	usePreferencesStore.getState().openPreferences();
}

/** Writes the draft through the Phase 4 file layer; never throws. */
async function writeDraft(
	file: ThemeFile,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	const rpc = electroview?.rpc;
	if (!rpc) return { ok: false, reason: "not connected to the app" };
	try {
		const result = await rpc.request.writeTheme({
			file,
			reservedIds: [...THEME_IDS],
		});
		return result.ok ? { ok: true } : { ok: false, reason: result.error };
	} catch (err) {
		return { ok: false, reason: String(err) };
	}
}

/**
 * Keeps the store's list entry in step with the file just written, so the
 * picker badge and the paint after close do not wait for the watcher.
 */
function patchListEntry(file: ThemeFile): void {
	const store = useThemeStore.getState();
	if (!store.userThemes.some((e) => e.id === file.id)) return;
	const requiredFailures = verdictsFor(file).requiredFailures;
	store.setUserThemes(
		store.userThemes.map((e) =>
			e.id === file.id ? { id: e.id, file, requiredFailures } : e,
		),
	);
}

/**
 * The draft's life while the editor is open: `saved` is the file as last
 * written, every accepted change is autosaved 500 ms after the last one,
 * close flushes a pending change first and asks only when the write failed.
 */
function useDraftSession(initial: ThemeFile) {
	const draft = useThemeStore((s) => s.draft) ?? initial;
	const [saved, setSaved] = useState(initial);
	const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });
	const [confirming, setConfirming] = useState(false);
	const latest = useRef({ draft, saved });
	latest.current = { draft, saved };

	const write = useCallback(async (file: ThemeFile) => {
		setStatus({ kind: "saving" });
		const result = await writeDraft(file);
		if (!result.ok) {
			setStatus({ kind: "error", reason: result.reason });
			return false;
		}
		setSaved(file);
		setStatus({ kind: "saved" });
		patchListEntry(file);
		return true;
	}, []);

	useEffect(() => {
		if (draft === saved) return;
		setStatus({ kind: "saving" });
		const timer = setTimeout(() => void write(draft), AUTOSAVE_MS);
		return () => clearTimeout(timer);
	}, [draft, saved, write]);

	const change = (token: string, value: string | null) => {
		const next = applyFieldChange(latest.current.draft, token, value);
		if (next !== latest.current.draft) useThemeStore.getState().setDraft(next);
	};

	const requestClose = async () => {
		const { draft: current, saved: last } = latest.current;
		if (current !== last && !(await write(current))) {
			setConfirming(true);
			return;
		}
		closeThemeEditor();
	};

	return {
		draft,
		saved,
		status,
		confirming,
		setConfirming,
		change,
		requestClose,
	};
}

/**
 * Peek state and the dialog-level keys that drive it: Alt held while focus
 * is inside the dialog; released on key-up or when focus leaves.
 */
function usePeek(): {
	peek: boolean;
	setPeek: (on: boolean) => void;
	peekKeys: Pick<
		React.HTMLAttributes<HTMLDivElement>,
		"onKeyDown" | "onKeyUp" | "onBlur"
	>;
} {
	const [peek, setPeek] = useState(false);
	return {
		peek,
		setPeek,
		peekKeys: {
			onKeyDown: (e) => {
				if (e.key === "Alt") {
					e.preventDefault();
					setPeek(true);
				}
			},
			onKeyUp: (e) => {
				if (e.key === "Alt") setPeek(false);
			},
			onBlur: (e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) setPeek(false);
			},
		},
	};
}

/**
 * Press-and-hold eye: pointer down / up, or Space held, peeks at the canvas
 * underneath. Pointer capture keeps the release on the button even though
 * the dialog stops taking pointer events while peeking.
 */
function PeekButton({
	peek,
	onPeek,
}: {
	peek: boolean;
	onPeek: (on: boolean) => void;
}) {
	return (
		<button
			type="button"
			style={iconButtonStyle}
			aria-label={EDITOR_PEEK_LABEL}
			aria-pressed={peek}
			title={EDITOR_PEEK_LABEL}
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture?.(e.pointerId);
				onPeek(true);
			}}
			onPointerUp={() => onPeek(false)}
			onPointerCancel={() => onPeek(false)}
			onKeyDown={(e) => {
				if (e.key === " " && !e.repeat) {
					e.preventDefault();
					onPeek(true);
				}
			}}
			onKeyUp={(e) => {
				if (e.key === " ") onPeek(false);
			}}
		>
			<EyeIcon />
		</button>
	);
}

interface EditorHeaderProps {
	themeName: string;
	peek: boolean;
	status: SaveStatus;
	verdicts: ThemeVerdicts;
	confirming: boolean;
	onPeek: (on: boolean) => void;
	onHide: () => void;
	onClose: () => void;
	onKeepEditing: () => void;
	onDiscard: () => void;
}

/** Title and actions, the counts / save-status line, the close confirm. */
function EditorHeader(props: EditorHeaderProps) {
	const { verdicts, status } = props;
	return (
		<>
			<div style={headerStyle}>
				<Dialog.Title style={{ ...dialogTitleStyle, flex: 1 }}>
					Editing {props.themeName}
				</Dialog.Title>
				<PeekButton peek={props.peek} onPeek={props.onPeek} />
				<button type="button" style={iconButtonStyle} onClick={props.onHide}>
					{EDITOR_HIDE_LABEL}
				</button>
				<button
					type="button"
					style={iconButtonStyle}
					aria-label={EDITOR_CLOSE_LABEL}
					title={EDITOR_CLOSE_LABEL}
					onClick={props.onClose}
				>
					<CloseIcon />
				</button>
			</div>
			<div style={statusRowStyle}>
				<span data-testid={EDITOR_COUNTS_TESTID} aria-live="polite">
					{verdicts.requiredFailures} required failure
					{verdicts.requiredFailures === 1 ? "" : "s"} ·{" "}
					{verdicts.advisoryFailures} advisory
				</span>
				<span
					data-testid={EDITOR_SAVE_STATUS_TESTID}
					role="status"
					style={
						status.kind === "error"
							? { color: "var(--rv-status-blocked)" }
							: undefined
					}
				>
					{statusText(status)}
				</span>
			</div>
			{props.confirming && (
				<div role="alert" style={{ display: "flex", gap: 8 }}>
					<p style={{ ...dialogErrorTextStyle, flex: 1, margin: 0 }}>
						The last change could not be saved. Close anyway?
					</p>
					<button
						type="button"
						style={dialogSecondaryButtonStyle}
						onClick={props.onKeepEditing}
					>
						{EDITOR_KEEP_EDITING_LABEL}
					</button>
					<button
						type="button"
						style={dialogPrimaryButtonStyle}
						onClick={props.onDiscard}
					>
						{EDITOR_DISCARD_LABEL}
					</button>
				</div>
			)}
		</>
	);
}

/**
 * The editor for one draft. Mounted while the store holds a draft (keyed by
 * its id, so opening another theme starts fresh). `hidden` collapses the
 * dialog to the pill; `peek` makes it translucent while the eye button or
 * Alt is held.
 */
function EditorSession({ initial }: { initial: ThemeFile }) {
	const session = useDraftSession(initial);
	const { draft } = session;
	const [hidden, setHidden] = useState(false);
	const { peek, setPeek, peekKeys } = usePeek();
	const contentRef = useRef<HTMLDivElement>(null);
	const pillRef = useRef<HTMLButtonElement>(null);
	const verdicts = useMemo(() => verdictsFor(draft), [draft]);

	// Hiding hands focus to the pill (the dialog itself has gone).
	useEffect(() => {
		if (hidden) pillRef.current?.focus();
	}, [hidden]);

	return (
		<>
			<Dialog.Root
				modal={false}
				open={!hidden}
				onOpenChange={(open) => {
					if (!open) void session.requestClose();
				}}
			>
				<Dialog.Portal>
					<Dialog.Content
						ref={contentRef}
						// The accessible name is the fixed label, not the per-theme title
						// (Radix would point aria-labelledby at the title otherwise).
						aria-label={EDITOR_DIALOG_LABEL}
						aria-labelledby={undefined}
						aria-describedby={undefined}
						style={{
							...contentStyle,
							opacity: peek ? PEEK_OPACITY : 1,
							pointerEvents: peek ? "none" : "auto",
						}}
						onOpenAutoFocus={(e) => {
							e.preventDefault();
							contentRef.current?.focus();
						}}
						onCloseAutoFocus={(e) => e.preventDefault()}
						// The canvas stays interactive: clicking it never dismisses.
						onInteractOutside={(e) => e.preventDefault()}
						// Escape closes only when focus is inside the dialog.
						onEscapeKeyDown={(e) => {
							if (!contentRef.current?.contains(document.activeElement)) {
								e.preventDefault();
							}
						}}
						{...peekKeys}
					>
						<EditorHeader
							themeName={draft.meta.name}
							peek={peek}
							status={session.status}
							verdicts={verdicts}
							confirming={session.confirming}
							onPeek={setPeek}
							onHide={() => setHidden(true)}
							onClose={() => void session.requestClose()}
							onKeepEditing={() => session.setConfirming(false)}
							onDiscard={closeThemeEditor}
						/>
						<p style={{ ...dialogHelperTextStyle, margin: 0 }}>
							Changes paint the canvas as you make them. Hold the eye or Alt to
							look underneath.
						</p>
						<ThemeEditorFields
							draft={draft}
							verdicts={verdicts}
							onChange={session.change}
						/>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
			{hidden && (
				<EditorPill
					ref={pillRef}
					themeName={draft.meta.name}
					onShow={() => setHidden(false)}
				/>
			)}
		</>
	);
}

/**
 * The theme editor (v0.8.3 Phase 5, D1-B). Mounted once in App; renders
 * nothing until `openThemeEditor` puts a draft in the store.
 */
export function ThemeEditor() {
	const draft = useThemeStore((s) => s.draft);
	if (!draft) return null;
	return <EditorSession key={draft.id} initial={draft} />;
}

function EyeIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
