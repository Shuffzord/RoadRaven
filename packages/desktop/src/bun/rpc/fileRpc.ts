import { resolve as pathResolve } from "node:path";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema.ts";
import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { atomicWrite } from "../atomicWrite";
import { writeLoadBackup } from "../backups";
import { canonicalizeSchemaJson } from "../canonicalJson";
import {
	type EventServerHandle,
	getSidecarPath as getEventSidecarPath,
} from "../eventServer";
import { replayEventLog } from "../eventsLog";
import { markSelfWrite, stopAllWatchers, watchFile } from "../fileWatcher";
import { bunLogger } from "../logging";
import type { createMainWindow, defineMainRpc } from "../platform/window";
import {
	buildOwnershipMap,
	clearOwnershipMap,
	getOwnership,
	setSourceTemplate,
} from "../refMap";
import { defaultReadFile, resolveRefsWithOwnership } from "../resolveRefs";
import {
	clearCachedMainPath,
	getCachedMainPath,
	isPathWithinMainDir,
	pushDialogAllowlistPath,
	saveFileHandler,
	setCachedMainPath,
	setCachedSchema,
} from "../saveFile";
import { addRecentFile } from "../settings";
import { pickSaveFilePath } from "./dialogRpc";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type LoadFileResponse = BunRequests["loadFile"]["response"];
type SidecarUpdate = NonNullable<LoadFileResponse["sidecarUpdates"]>[number];

// The type BrowserView.defineRPC<RoadmapRPCType>({...}) (Side="bun") returns
// in the composition root (index.ts), derived here independently of that
// `rpc` value via the platform seam's defineMainRpc — index.ts's `mainWindow`
// binding is typed against this same alias, and the RPC handler closures it
// passes into `rpc`'s own definition capture `mainWindow` by reference, so
// `mainWindow`'s type cannot depend on `rpc`'s type without becoming
// circular.
export type AppRpc = ReturnType<typeof defineMainRpc<RoadmapRPCType>>;
export type MainWindow = ReturnType<typeof createMainWindow<AppRpc>>;

type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

export interface FileRpcContext {
	getMainWindow: () => MainWindow;
	getEventServerHandle: () => EventServerHandle | null;
}

// -- loadFile pipeline -------------------------------------------------------
//
// $ref resolution + ownership tagging lives in `../resolveRefs.ts` so the
// production loadFile handler (this file) and the test-only loadFileHandler
// in saveFile.ts share one implementation. Production passes a `watchFile`
// callback; tests omit it.
//
// The handler itself is a flat pipeline: readRoadmapFile → parseAndValidate →
// resolveRefs → hydrateSidecarStatuses → toLoadResult. Each stage owns its
// own try/catch so the top-level handler stays a simple sequence of
// early-return checks (this is what brought loadFile's cyclomatic complexity
// down from 17 in a single function).

/**
 * Read the raw roadmap file off disk. Returns the raw text on success, or a
 * ready-to-return RPC error response on failure (mirrors the original
 * inline try/catch's `file_read_error` shape).
 */
async function readRoadmapFile(
	filePath: string,
): Promise<
	{ ok: true; raw: string } | { ok: false; result: LoadFileResponse }
> {
	try {
		const raw = await defaultReadFile(filePath);
		return { ok: true, raw };
	} catch (err) {
		bunLogger.error`Failed to read file ${filePath}: ${String(err)}`;
		return {
			ok: false,
			result: {
				data: null,
				errors: [
					{
						path: "",
						message: `Failed to read file: ${String(err)}`,
						code: "file_read_error",
					},
				],
			},
		};
	}
}

// Write load backup into the app-data backups dir (VIEW-12; v0.7
// phase 3 — no longer written next to the roadmap file).
function writeLoadBackupSafely(filePath: string, raw: string): void {
	try {
		const bakPath = writeLoadBackup(filePath, raw);
		bunLogger.info`Backup written to ${bakPath}`;
	} catch (err) {
		bunLogger.error`Failed to write backup: ${String(err)}`;
	}
}

/**
 * Parse the raw JSON and validate it against RoadmapSchemaSchema. Returns the
 * validated schema data on success, or a ready-to-return RPC error response
 * (json_parse_error, or the mapped Zod issues) on failure.
 */
async function parseAndValidate(
	raw: string,
): Promise<
	| { ok: true; schemaData: RoadmapSchema; errors: LoadFileResponse["errors"] }
	| { ok: false; result: LoadFileResponse }
> {
	const { RoadmapSchemaSchema } = await import(
		"../../../../../packages/core/src/schema"
	);

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		return {
			ok: false,
			result: {
				data: null,
				errors: [
					{
						path: "",
						message: `Invalid JSON: ${String(err)}`,
						code: "json_parse_error",
					},
				],
			},
		};
	}

	// Validate with Zod
	const result = RoadmapSchemaSchema.safeParse(parsed);

	if (!result.success) {
		return {
			ok: false,
			result: {
				data: null,
				errors: result.error.issues.map((issue) => ({
					path: issue.path.map(String).join("/"),
					message: issue.message,
					code: String(issue.code),
				})),
			},
		};
	}

	return { ok: true, schemaData: result.data, errors: [] };
}

// True when `schemaData` carries a usable `nodes` array to expand $refs on.
// schemaData is already typed as RoadmapSchema (nodes is always present per
// the Zod schema), so this mirrors the original code's defensive runtime
// check rather than relying on the static type alone.
function hasNodesArray(
	schemaData: RoadmapSchema,
): schemaData is RoadmapSchema & { nodes: RoadmapNode[] } {
	return (
		!!schemaData &&
		typeof schemaData === "object" &&
		"nodes" in schemaData &&
		Array.isArray(schemaData.nodes)
	);
}

// Expand $refs on an already-confirmed `nodes` array and seed the ownership
// map. Split out of resolveNodeRefs so the guard above stays a single
// predicate call rather than an inline multi-condition `if`.
async function expandSchemaNodes(
	schemaData: RoadmapSchema & { nodes: RoadmapNode[] },
	filePath: string,
	resolvedMain: string,
	fileChangeCallback: (changedPath: string) => void,
): Promise<void> {
	const originalNodes = schemaData.nodes;
	// EDIT-16: capture the pre-resolution main-file nodes so
	// splitSchemaByOwnership can restore $ref placeholders on save.
	setSourceTemplate(resolvedMain, originalNodes);
	// Seed the ownership map rooted at the main file before expansion;
	// resolveRefs then overlays per-ref descendants via setOwnership.
	buildOwnershipMap(
		originalNodes.filter((n) => !n.$ref),
		resolvedMain,
	);

	schemaData.nodes = await resolveRefsWithOwnership(
		originalNodes,
		filePath,
		resolvedMain,
		{
			readFile: defaultReadFile,
			onWatch: (path) => watchFile(path, fileChangeCallback),
		},
	);
}

/**
 * Expand $ref nodes on `schemaData.nodes` in place and seed the ownership
 * map. Split out of `resolveRefs` so the $ref-expansion guard (and its
 * try/catch) don't add to the orchestrating function's complexity.
 */
async function resolveNodeRefs(
	schemaData: RoadmapSchema,
	filePath: string,
	resolvedMain: string,
	fileChangeCallback: (changedPath: string) => void,
): Promise<void> {
	try {
		if (hasNodesArray(schemaData)) {
			await expandSchemaNodes(
				schemaData,
				filePath,
				resolvedMain,
				fileChangeCallback,
			);
		}
	} catch (err) {
		bunLogger.error`Failed to resolve $ref nodes: ${String(err)}`;
	}
}

// Push ownership map to webview for optimistic cross-boundary detection
function pushOwnershipMapSafely(mainWindow: MainWindow): void {
	try {
		mainWindow.webview.rpc?.send.pushOwnershipMap({
			entries: [...getOwnership().entries()],
		});
	} catch (err) {
		bunLogger.error`pushOwnershipMap failed: ${String(err)}`;
	}
}

/**
 * Resolve $ref nodes in-place on `schemaData`, seed the ownership map, start
 * file watchers, and record the file as recently opened. Mirrors the
 * original loadFile body exactly (order of side effects matters: watchers
 * must be stopped before new ones are set up via resolveRefsWithOwnership's
 * onWatch callback, and the main-file watcher is armed after resolution).
 */
async function resolveRefs(
	schemaData: RoadmapSchema,
	filePath: string,
	resolvedMain: string,
	mainWindow: MainWindow,
): Promise<void> {
	const fileChangeCallback = (changedPath: string) => {
		if (changedPath.endsWith(".bak.json")) return;
		bunLogger.info`File changed: ${changedPath}`;
		mainWindow.webview.rpc?.send.pushFileChanged({
			path: changedPath,
			mainPath: resolvedMain,
		});
	};

	// Stop existing watchers before resolveRefs sets up new $ref watchers
	stopAllWatchers();

	await resolveNodeRefs(schemaData, filePath, resolvedMain, fileChangeCallback);

	// Start file watcher for the main file
	watchFile(filePath, fileChangeCallback);

	// Track recent file
	addRecentFile(filePath);

	// Cache for saveFile / flushPending (path-traversal allowlist)
	setCachedMainPath(resolvedMain);
	if (schemaData && typeof schemaData === "object") {
		setCachedSchema(schemaData);
	}

	pushOwnershipMapSafely(mainWindow);
}

type CoreSchemaModule =
	typeof import("../../../../../packages/core/src/schema");
type SidecarOverlay = Awaited<ReturnType<typeof replayEventLog>>["overlay"];

// Map the sidecar overlay (nodeId -> last-known status) to the pushable
// sidecarUpdates shape, dropping entries whose status fails NodeStatusSchema.
// Split out of hydrateSidecarStatuses so the validate/skip loop doesn't add
// to that function's complexity.
function mapOverlayToSidecarUpdates(
	overlay: SidecarOverlay,
	NodeStatusSchema: CoreSchemaModule["NodeStatusSchema"],
): SidecarUpdate[] {
	const sidecarUpdates: SidecarUpdate[] = [];
	for (const value of overlay.values()) {
		const status = NodeStatusSchema.safeParse(value.status);
		if (!status.success) {
			bunLogger.warn`Ignoring invalid sidecar status ${value.status} for node ${value.nodeId}`;
			continue;
		}
		sidecarUpdates.push({
			nodeId: value.nodeId,
			status: status.data,
			meta: value.meta,
			source: value.source,
			lastEventAt: value.lastEventAt,
		});
	}
	return sidecarUpdates;
}

// Return sidecar status hydration with the loaded schema. Applying it in
// the renderer after loadSchema prevents target-file events from mutating
// the previously displayed roadmap while this request is in flight.
async function hydrateSidecarStatuses(
	filePath: string,
	eventServerHandle: EventServerHandle | null,
	mainWindow: MainWindow,
): Promise<SidecarUpdate[]> {
	const { NodeStatusSchema } = await import(
		"../../../../../packages/core/src/schema"
	);

	const sidecarPath = getEventSidecarPath(filePath);
	eventServerHandle?.setSidecarPath(sidecarPath);
	let sidecarUpdates: SidecarUpdate[] = [];
	try {
		const { overlay, events } = await replayEventLog(sidecarPath);
		sidecarUpdates = mapOverlayToSidecarUpdates(overlay, NodeStatusSchema);
		if (events.length > 0) {
			mainWindow.webview.rpc?.send.pushEventLog({ events });
		}
	} catch (err) {
		bunLogger.error`sidecar replay failed for ${filePath}: ${String(err)}`;
	}
	return sidecarUpdates;
}

// v0.8.2 A6: absolute paths of the ownership-split companion files ($ref
// targets) of the roadmap rooted at `mainPath`, the root itself excluded.
function linkedFilesFor(mainPath: string | null): string[] {
	const linked = new Set(getOwnership().values());
	if (mainPath) linked.delete(mainPath);
	return [...linked];
}

// Shared by newFile / closeFile: drop every Bun-side reference to the
// previously loaded file. No disk path means no sidecar (I-10 / D-12), the
// cached main path + dialog allowlist go (so a stray saveFile({schema}) cannot
// overwrite the old file), and the ownership map is cleared rather than
// reseeded (WR-03: buildOwnershipMap([], "") would leave a "" ghost entry).
function resetFileSession(eventServerHandle: EventServerHandle | null): void {
	eventServerHandle?.setSidecarPath(null);
	clearCachedMainPath();
	clearOwnershipMap();
}

function toLoadResult(
	schemaData: RoadmapSchema,
	resolvedMain: string,
	errors: LoadFileResponse["errors"],
	sidecarUpdates: SidecarUpdate[],
): LoadFileResponse {
	return {
		data: schemaData as LoadFileResponse["data"],
		filePath: resolvedMain,
		errors,
		sidecarUpdates,
		linkedFiles: linkedFilesFor(resolvedMain),
	};
}

// -- saveFileAs pipeline ------------------------------------------------------
//
// saveFileAs splits into three stages: pickSaveFilePath (dialog interaction,
// lives in ./dialogRpc.ts since it's a native-dialog concern), serializeForSave
// (Zod validation + canonical JSON serialization), and writeSavedFile (atomic
// write + cache/ownership/recents/sidecar bookkeeping).

async function serializeForSave(
	schema: RoadmapSchema,
): Promise<{ ok: true; json: string } | { ok: false }> {
	const { RoadmapSchemaSchema } = await import(
		"../../../../../packages/core/src/schema"
	);

	// Pre-write Zod validation (T-03.04-07 — same trust-boundary
	// guard saveFile uses).
	const parsed = RoadmapSchemaSchema.safeParse(schema);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		bunLogger.warn`saveFileAs: schema validation failed: ${issue.path.map(String).join(".")}: ${issue.message}`;
		return { ok: false };
	}

	return { ok: true, json: canonicalizeSchemaJson(schema) };
}

async function writeSavedFile(
	resolved: string,
	schema: RoadmapSchema,
	json: string,
	eventServerHandle: EventServerHandle | null,
): Promise<string | null> {
	try {
		await atomicWrite(resolved, json);
		markSelfWrite(resolved);
		pushDialogAllowlistPath(resolved);
		setCachedSchema(schema);
		setCachedMainPath(resolved);
		// Fresh schema → all nodes owned by the new main file.
		buildOwnershipMap(schema.nodes, resolved);
		setSourceTemplate(resolved, schema.nodes);
		addRecentFile(resolved);
		// I-10 / D-12: the new disk path is now the sidecar target.
		eventServerHandle?.setSidecarPath(getEventSidecarPath(resolved));
		bunLogger.info`saveFileAs wrote ${resolved}`;
		return resolved;
	} catch (err) {
		bunLogger.error`saveFileAs write failed: ${String(err)}`;
		return null;
	}
}

// -- resolveRef helper --------------------------------------------------------

async function readRefNodes(absPath: string): Promise<RoadmapNode[]> {
	const raw = await Bun.file(absPath).text();
	const parsed = JSON.parse(raw);
	return Array.isArray(parsed) ? parsed : (parsed.nodes ?? [parsed]);
}

// -- RPC handlers --------------------------------------------------------------

export function createFileRpcHandlers(ctx: FileRpcContext): {
	loadFile: RpcHandler<"loadFile">;
	saveFile: RpcHandler<"saveFile">;
	resolveRef: RpcHandler<"resolveRef">;
	newFile: RpcHandler<"newFile">;
	saveFileAs: RpcHandler<"saveFileAs">;
	closeFile: RpcHandler<"closeFile">;
} {
	return {
		// loadFile handler with Zod validation + error propagation + app-data backup
		loadFile: async ({ path: filePath }) => {
			const readResult = await readRoadmapFile(filePath);
			if (!readResult.ok) return readResult.result;
			const raw = readResult.raw;

			writeLoadBackupSafely(filePath, raw);

			const parseResult = await parseAndValidate(raw);
			if (!parseResult.ok) return parseResult.result;
			const { schemaData, errors } = parseResult;

			const resolvedMain = pathResolve(filePath);
			await resolveRefs(
				schemaData,
				filePath,
				resolvedMain,
				ctx.getMainWindow(),
			);

			const sidecarUpdates = await hydrateSidecarStatuses(
				filePath,
				ctx.getEventServerHandle(),
				ctx.getMainWindow(),
			);

			return toLoadResult(schemaData, resolvedMain, errors, sidecarUpdates);
		},

		// saveFile handler — atomic write with path-traversal session allowlist
		// (T-03.04-01; see dialogAllowlist in saveFile.ts) and Zod pre-write
		// validation (T-03.04-07). Shared logic lives in saveFile.ts.
		saveFile: async ({ schema, filePath }) => {
			return saveFileHandler({ schema, filePath });
		},

		// resolveRef handler — allowlisted to the currently-loaded main
		// file's directory. A crafted roadmap JSON with a $ref pointing
		// outside baseDir is a data-exfiltration primitive; same guard
		// lives in resolveRefs for the load path.
		resolveRef: async ({ refPath }) => {
			const absPath = pathResolve(refPath);
			if (!isPathWithinMainDir(absPath)) {
				bunLogger.error`resolveRef rejected: ${refPath} escapes main-file directory`;
				return [];
			}
			try {
				return await readRefNodes(absPath);
			} catch (err) {
				bunLogger.error`Failed to resolve ref ${refPath}: ${String(err)}`;
				return [];
			}
		},

		// newFile handler (EDIT-17): produce a fresh in-memory schema with a
		// single root node. No disk write happens here — autosave will fire
		// saveFileAs on the first mutation flush; the user picks a path then.
		// Bun-side cache reset: see resetFileSession.
		newFile: async () => {
			const rootId = crypto.randomUUID();
			const now = new Date().toISOString();
			const schema: RoadmapSchema = {
				version: "1.0",
				title: "Untitled Roadmap",
				statusConfig: [
					{ id: "not-started", label: "Not Started" },
					{ id: "in-progress", label: "In Progress" },
					{ id: "completed", label: "Completed" },
					{ id: "blocked", label: "Blocked" },
				],
				nodes: [
					{
						id: rootId,
						title: "Untitled",
						status: "not-started",
						createdAt: now,
						updatedAt: now,
					},
				],
			};
			resetFileSession(ctx.getEventServerHandle());
			setCachedSchema(schema);
			bunLogger.info`newFile: created in-memory Untitled Roadmap`;
			return { data: schema, filePath: null };
		},

		// closeFile handler (v0.8.2 A2): back to Welcome. Stops the main + $ref
		// file watchers and resets the file session exactly like newFile.
		closeFile: () => {
			stopAllWatchers();
			resetFileSession(ctx.getEventServerHandle());
			bunLogger.info`closeFile: watchers stopped, file session reset`;
			return { ok: true as const };
		},

		// saveFileAs handler (EDIT-17): pop a native dialog and run the
		// initial atomic write. Side effects on success:
		//   - dialogAllowlist gains the chosen path (so subsequent saveFile
		//     calls without an explicit filePath are accepted)
		//   - cachedMainPath / cachedSchema updated for flushPending
		//   - ownership map seeded with the schema's nodes (no $refs yet)
		//   - A6: the ROOT file only is written. Companion files of the
		//     previously loaded roadmap are reported as linkedFilesNotCopied.
		saveFileAs: async ({ schema, defaultPath, defaultName }) => {
			const chosenPath = await pickSaveFilePath({ defaultPath, defaultName });
			if (!chosenPath) return { filePath: null }; // user cancelled

			const resolved = pathResolve(chosenPath);

			const serialized = await serializeForSave(schema);
			if (!serialized.ok) return { filePath: null };

			// Read before writeSavedFile rebuilds the ownership map around the
			// new root.
			const linkedFilesNotCopied = linkedFilesFor(getCachedMainPath());
			const filePath = await writeSavedFile(
				resolved,
				schema,
				serialized.json,
				ctx.getEventServerHandle(),
			);
			return { filePath, linkedFilesNotCopied };
		},
	};
}
