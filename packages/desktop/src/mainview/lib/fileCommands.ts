import {
	closeFile,
	copyPath,
	newRoadmap,
	openFile,
	openRecent,
	revealInFolder,
	save,
	saveAs,
} from "../hooks/useFileActions";
import type { useRoadmapStore } from "../store/roadmapStore";

/**
 * v0.8.2 A3 — the one table of file verbs. The File menu, the document
 * chip, the sidebar's recent-file menu and the keyboard router all read it,
 * so a verb's label, shortcut, enablement and behaviour cannot drift between
 * surfaces.
 */
export type FileCommandId =
	| "new"
	| "open"
	| "openRecent"
	| "save"
	| "saveAs"
	| "closeFile"
	| "revealInFolder"
	| "copyPath";

type RoadmapState = ReturnType<typeof useRoadmapStore.getState>;

export interface FileCommand {
	id: FileCommandId;
	label: string;
	/** Display form, e.g. "Ctrl+S" or "⌘S". */
	shortcut?: string;
	/** `arg` is the path for openRecent; the others ignore it. */
	run: (arg?: string) => Promise<void>;
	isEnabled: (s: RoadmapState) => boolean;
}

/** macOS shows ⌘ and ⇧ glyphs; everything else spells the modifiers out. */
export function isMacPlatform(
	nav: { platform?: string; userAgent?: string } = typeof navigator ===
	"undefined"
		? {}
		: navigator,
): boolean {
	return /Mac|iPhone|iPad/.test(`${nav.platform ?? ""} ${nav.userAgent ?? ""}`);
}

/** "S" → "Ctrl+S" / "⌘S"; with shift → "Ctrl+Shift+S" / "⇧⌘S". */
export function formatShortcut(
	key: string,
	opts: { shift?: boolean } = {},
	mac: boolean = isMacPlatform(),
): string {
	if (mac) return `${opts.shift ? "⇧" : ""}⌘${key}`;
	return `Ctrl+${opts.shift ? "Shift+" : ""}${key}`;
}

const hasSchema = (s: RoadmapState) => s.schema !== null;
const hasPath = (s: RoadmapState) => s.schema !== null && s.filePath !== null;
const always = () => true;

export const fileCommands: readonly FileCommand[] = [
	{
		id: "new",
		label: "New",
		shortcut: formatShortcut("N"),
		run: () => newRoadmap(),
		isEnabled: always,
	},
	{
		id: "open",
		label: "Open…",
		shortcut: formatShortcut("O"),
		run: () => openFile(),
		isEnabled: always,
	},
	{
		id: "openRecent",
		label: "Open Recent",
		run: (path) => (path ? openRecent(path) : Promise.resolve()),
		isEnabled: always,
	},
	{
		id: "save",
		label: "Save",
		shortcut: formatShortcut("S"),
		run: () => save(),
		isEnabled: hasSchema,
	},
	{
		id: "saveAs",
		label: "Save As…",
		shortcut: formatShortcut("S", { shift: true }),
		run: async () => {
			await saveAs();
		},
		isEnabled: hasSchema,
	},
	{
		id: "closeFile",
		label: "Close File",
		run: () => closeFile(),
		isEnabled: hasSchema,
	},
	{
		id: "revealInFolder",
		label: "Reveal in Folder",
		run: () => revealInFolder(),
		isEnabled: hasPath,
	},
	{
		id: "copyPath",
		label: "Copy Path",
		run: () => copyPath(),
		isEnabled: hasPath,
	},
];

export function getFileCommand(id: FileCommandId): FileCommand {
	const command = fileCommands.find((c) => c.id === id);
	if (!command) throw new Error(`Unknown file command: ${id}`);
	return command;
}
