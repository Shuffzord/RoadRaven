/**
 * Native save-file dialog via shell-out to the OS-provided dialog tool:
 *   - Windows → PowerShell + System.Windows.Forms.SaveFileDialog
 *   - macOS   → osascript + `choose file name`
 *   - Linux   → zenity --file-selection --save
 *
 * Adapted (script-fallback paths only) from nativefiledialog-for-bun:
 *   https://github.com/Catharacta/nativefiledialog-for-bun
 *   Copyright (c) 2026 Catharacta — MIT License
 *   See THIRD_PARTY_LICENSES.md at repo root.
 *
 * The library's FFI/native-binary backend is intentionally NOT vendored —
 * Electrobun bundling makes per-platform .dll/.dylib/.so distribution painful.
 * PowerShell, osascript, and zenity are present on every host we support.
 *
 * Workaround for Electrobun issue #233 (Utils.saveFileDialog not yet implemented):
 *   https://github.com/blackboardsh/electrobun/issues/233
 *
 * Used by saveFileAs RPC handler in bun/index.ts (EDIT-17 File>New flow).
 */

import { spawn } from "bun";

export interface FileFilter {
	name: string;
	extensions: string[];
}

export interface SaveDialogOptions {
	title?: string;
	defaultPath?: string;
	defaultName?: string;
	filters?: FileFilter[];
}

/**
 * Pop a native save-file dialog. Returns the chosen absolute path, or null
 * if the user cancelled / the spawn failed.
 *
 * Async (non-blocking on the Bun event loop) — RPC + autosave keep ticking
 * while the modal is open in the OS-side process.
 */
export async function nativeSaveDialog(
	options: SaveDialogOptions = {},
): Promise<string | null> {
	switch (process.platform) {
		case "win32":
			return saveFileWindows(options);
		case "darwin":
			return saveFileMacOS(options);
		case "linux":
			return saveFileLinux(options);
		default:
			throw new Error(
				`nativeSaveDialog: platform ${process.platform} is not supported`,
			);
	}
}

// ─── Windows ──────────────────────────────────────────────────────────────────

async function saveFileWindows(
	options: SaveDialogOptions,
): Promise<string | null> {
	const filterStr = formatWindowsFilter(options.filters);
	const titleLine = options.title
		? `$dialog.Title = '${escapePs(options.title)}'`
		: "";
	const initialDirLine = options.defaultPath
		? `$dialog.InitialDirectory = '${escapePs(options.defaultPath)}'`
		: "";
	const fileNameLine = options.defaultName
		? `$dialog.FileName = '${escapePs(options.defaultName)}'`
		: "";

	const script = [
		"Add-Type -AssemblyName System.Windows.Forms",
		"$dialog = New-Object System.Windows.Forms.SaveFileDialog",
		titleLine,
		initialDirLine,
		fileNameLine,
		`$dialog.Filter = '${escapePs(filterStr)}'`,
		"$dialog.OverwritePrompt = $true",
		"$dialog.AddExtension = $true",
		"$res = $dialog.ShowDialog()",
		"if ($res -eq 'OK') { $dialog.FileName }",
	]
		.filter(Boolean)
		.join("\n");

	return runDialog(["powershell", "-NoProfile", "-Command", script]);
}

function formatWindowsFilter(filters?: FileFilter[]): string {
	if (!filters || filters.length === 0) return "All Files (*.*)|*.*";
	return filters
		.map((f) => {
			const exts = f.extensions.map((e) => `*.${e}`).join(";");
			return `${f.name} (${exts})|${exts}`;
		})
		.join("|");
}

// ─── macOS ────────────────────────────────────────────────────────────────────

async function saveFileMacOS(
	options: SaveDialogOptions,
): Promise<string | null> {
	const promptArg = options.title
		? ` with prompt "${escapeAS(options.title)}"`
		: "";
	const defaultNameArg = options.defaultName
		? ` default name "${escapeAS(options.defaultName)}"`
		: "";
	const defaultLocationArg = options.defaultPath
		? ` default location "${escapeAS(options.defaultPath)}"`
		: "";

	// AppleScript `choose file name` returns a file reference; POSIX path
	// converts it to a /usr/style path. Wrap in try/on error to map cancel
	// (error -128) to an empty string instead of a non-zero exit.
	const script = [
		"try",
		`  set f to choose file name${promptArg}${defaultNameArg}${defaultLocationArg}`,
		"  return POSIX path of f",
		"on error",
		'  return ""',
		"end try",
	].join("\n");

	return runDialog(["osascript", "-e", script]);
}

// ─── Linux ────────────────────────────────────────────────────────────────────

async function saveFileLinux(
	options: SaveDialogOptions,
): Promise<string | null> {
	const args = ["--file-selection", "--save", "--confirm-overwrite"];
	if (options.title) args.push(`--title=${options.title}`);
	if (options.defaultPath) args.push(`--filename=${options.defaultPath}/`);
	if (options.defaultName) args.push(`--filename=${options.defaultName}`);
	if (options.filters) {
		for (const f of options.filters) {
			const exts = f.extensions.map((e) => `*.${e}`).join(" ");
			args.push(`--file-filter=${f.name} | ${exts}`);
		}
	}
	return runDialog(["zenity", ...args]);
}

// ─── Shared spawn + parse ────────────────────────────────────────────────────

async function runDialog(cmd: string[]): Promise<string | null> {
	try {
		const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" });
		const exitCode = await proc.exited;
		const output = (await new Response(proc.stdout).text()).trim();
		// Non-zero exit on cancel is normal for zenity (1 = cancel) and may
		// also occur for AppleScript user-cancel — treat empty output as null
		// regardless of exit code.
		if (!output) return null;
		// Successful dialogs always return the path on stdout; if exit was
		// non-zero AND we got output, log but still return the path.
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			console.warn(
				`[nativeSaveDialog] non-zero exit (${exitCode}) but got path: ${stderr.trim()}`,
			);
		}
		return output;
	} catch (err) {
		throw new Error(
			`nativeSaveDialog spawn failed (${cmd[0]}): ${String(err)}`,
		);
	}
}

// ─── Escapes ─────────────────────────────────────────────────────────────────

function escapePs(str: string): string {
	return str.replace(/'/g, "''");
}

function escapeAS(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
