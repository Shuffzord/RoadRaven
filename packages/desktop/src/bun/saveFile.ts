import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { RoadmapSchemaSchema } from "../../../../packages/core/src/schema";
import type { RoadmapNode, RoadmapSchema } from "../../../../shared/types";
import { atomicWrite } from "./atomicWrite";
import { bunLogger } from "./logging";
import {
	buildOwnershipMap,
	getOwnership,
	setOwnership,
	setSourceTemplate,
	splitSchemaByOwnership,
} from "./refMap";

// -- Module-level state -----------------------------------------------------
//
// The cache holds the last-seen schema + main path so flushPending (called on
// shutdown/quit by later plans) can safely re-write every owner in the map
// without depending on the live webview store.

let cachedSchema: RoadmapSchema | null = null;
let cachedMainPath: string | null = null;
const dialogAllowlist = new Set<string>();

// -- Path-traversal allowlist (T-03.04-01) ---------------------------------

export interface SaveFileOk {
	ok: true;
}
export interface SaveFileErr {
	ok: false;
	error: string;
}
export type SaveFileResponse = SaveFileOk | SaveFileErr;

/**
 * Result of a loadFile call. Mirrors the existing RPC shape (data + errors).
 */
export interface LoadFileResponse {
	data: RoadmapSchema | null;
	errors: Array<{ path: string; message: string; code: string }>;
	ownership: Array<[string, string]>;
}

/**
 * Add a file path to the session allowlist. Called by the RPC layer after
 * `Utils.saveFileDialog` returns a user-picked path (saveFileAs flow arrives in
 * Plan 04c; this stub is safe to call today).
 */
export function pushDialogAllowlistPath(absolutePath: string): void {
	dialogAllowlist.add(resolve(absolutePath));
}

/**
 * Called by the RPC loadFile handler after a successful load so subsequent
 * `saveFile({schema})` (no filePath) calls route back to the loaded file.
 * Accepts any string; resolves to absolute before caching.
 */
export function setCachedMainPath(absolutePath: string): void {
	cachedMainPath = resolve(absolutePath);
}

/**
 * Called by the RPC loadFile handler after a successful load so shutdown
 * flushPending has the latest in-memory schema to persist.
 */
export function setCachedSchema(schema: RoadmapSchema): void {
	cachedSchema = schema;
}

/**
 * True when `filePath` is either the currently loaded main file or a path the
 * user explicitly picked via the native dialog this session.
 */
function isAllowlisted(resolvedPath: string): boolean {
	if (cachedMainPath && resolve(cachedMainPath) === resolvedPath) return true;
	if (dialogAllowlist.has(resolvedPath)) return true;
	return false;
}

// -- saveFile handler -------------------------------------------------------

/**
 * Core saveFile implementation. Shared by the RPC handler (bun/index.ts) and
 * unit tests (tests/unit/bun/saveFile.test.ts).
 *
 * Guards in order:
 *   1. target path present (either explicit filePath or cached main path)
 *   2. target is in the session allowlist (T-03.04-01)
 *   3. schema passes RoadmapSchemaSchema.safeParse (T-03.04-07)
 *
 * On success: splits the schema by ownership and atomic-writes every owner.
 */
export async function saveFileHandler(params: {
	schema: RoadmapSchema;
	filePath?: string;
}): Promise<SaveFileResponse> {
	const { schema, filePath } = params;
	const target = filePath ?? cachedMainPath;

	if (!target) {
		return { ok: false, error: "saveFile: no file path — use saveFileAs" };
	}

	const resolved = resolve(target);

	if (!isAllowlisted(resolved)) {
		bunLogger.warn`saveFile: filePath ${resolved} not in session allowlist; rejecting`;
		return {
			ok: false,
			error:
				"saveFile: filePath not in session allowlist (path-traversal mitigation)",
		};
	}

	// T-03.04-07: Zod pre-write validation (BEFORE splitSchemaByOwnership and BEFORE atomicWrite)
	const parsed = RoadmapSchemaSchema.safeParse(schema);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const msg = `saveFile: schema validation failed: ${issue.path.map(String).join(".")}: ${issue.message}`;
		bunLogger.warn`${msg}`;
		return { ok: false, error: msg };
	}

	try {
		const ownership = getOwnership();
		const perFile = splitSchemaByOwnership(schema, resolved, ownership);
		for (const [p, payload] of perFile) {
			await atomicWrite(p, JSON.stringify(payload, null, 2));
		}
		cachedSchema = schema;
		cachedMainPath = resolved;
		bunLogger.info`saveFile wrote ${perFile.size} file(s) for main=${resolved}`;
		return { ok: true };
	} catch (err) {
		bunLogger.error`saveFile failed: ${String(err)}`;
		return { ok: false, error: String(err) };
	}
}

// -- flushPending (idempotent; invocation wires in Plan 04c) ---------------

/**
 * Called by the quit/before-quit path in later plans. Safe to call anytime —
 * a no-op when nothing is cached.
 */
export async function flushPending(): Promise<void> {
	if (!cachedSchema || !cachedMainPath) {
		bunLogger.info`flushPending: no cached schema/path; no-op`;
		return;
	}
	try {
		const parsed = RoadmapSchemaSchema.safeParse(cachedSchema);
		if (!parsed.success) {
			bunLogger.error`flushPending: cached schema failed Zod validation; aborting`;
			return;
		}
		const ownership = getOwnership();
		const perFile = splitSchemaByOwnership(
			cachedSchema,
			cachedMainPath,
			ownership,
		);
		for (const [p, payload] of perFile) {
			await atomicWrite(p, JSON.stringify(payload, null, 2));
		}
		bunLogger.info`flushPending wrote ${perFile.size} file(s)`;
	} catch (err) {
		bunLogger.error`flushPending failed: ${String(err)}`;
	}
}

// -- loadFile handler -------------------------------------------------------

/**
 * Core loadFile implementation. Responsibilities beyond the existing RPC
 * handler in bun/index.ts:
 *   - Capture the pre-resolution main-file nodes via setSourceTemplate (needed
 *     by splitSchemaByOwnership on save to restore $ref placeholders).
 *   - Populate the ownership map for every node in the resolved tree.
 *   - Set cachedMainPath so a subsequent saveFile with no filePath works.
 *
 * The RPC wrapper in bun/index.ts adds .bak.json backup, file watchers, and
 * RPC error propagation — concerns that stay out of this core function.
 */
export async function loadFileHandler(params: {
	path: string;
}): Promise<LoadFileResponse> {
	const filePath = params.path;
	const resolvedMain = resolve(filePath);

	let raw: string;
	try {
		raw = await readTextFile(filePath);
	} catch (err) {
		bunLogger.error`Failed to read file ${filePath}: ${String(err)}`;
		return {
			data: null,
			errors: [
				{
					path: "",
					message: `Failed to read file: ${String(err)}`,
					code: "file_read_error",
				},
			],
			ownership: [],
		};
	}

	let parsedRaw: unknown;
	try {
		parsedRaw = JSON.parse(raw);
	} catch (err) {
		return {
			data: null,
			errors: [
				{
					path: "",
					message: `Invalid JSON: ${String(err)}`,
					code: "json_parse_error",
				},
			],
			ownership: [],
		};
	}

	const zod = RoadmapSchemaSchema.safeParse(parsedRaw);
	const errors: Array<{ path: string; message: string; code: string }> = [];
	let schemaData: unknown;
	if (!zod.success) {
		for (const issue of zod.error.issues) {
			errors.push({
				path: issue.path.map(String).join("/"),
				message: issue.message,
				code: String(issue.code),
			});
		}
		schemaData = parsedRaw;
	} else {
		schemaData = zod.data;
	}

	// Capture the original (pre-resolution) nodes as the source template
	// before $ref expansion mutates the tree. splitSchemaByOwnership uses this
	// on save to restore the $ref placeholders in the main file.
	if (
		schemaData &&
		typeof schemaData === "object" &&
		"nodes" in schemaData &&
		Array.isArray((schemaData as { nodes: unknown }).nodes)
	) {
		const originalNodes = (schemaData as { nodes: RoadmapNode[] }).nodes;
		setSourceTemplate(resolvedMain, originalNodes);

		// Seed the ownership map at the main-file scope BEFORE recursion.
		// resolveRefsWithOwnership then overlays per-ref descendants via setOwnership.
		buildOwnershipMap(
			originalNodes.filter((n) => !n.$ref),
			resolvedMain,
		);

		// Expand $refs and tag ownership (per-file per-node)
		const resolvedNodes = await resolveRefsWithOwnership(
			originalNodes,
			resolvedMain,
			resolvedMain,
		);
		(schemaData as { nodes: RoadmapNode[] }).nodes = resolvedNodes;
	}

	cachedSchema = schemaData as RoadmapSchema;
	cachedMainPath = resolvedMain;

	// Seed the ownership map AFTER resolution so buildOwnershipMap covers every
	// expanded descendant; per-ref overrides are set in resolveRefsWithOwnership.
	const ownership = getOwnership();

	return {
		data: schemaData as RoadmapSchema,
		errors,
		ownership: [...ownership.entries()],
	};
}

/**
 * Read a UTF-8 file. Uses Bun.file when available (production) and falls back
 * to node:fs.readFileSync under vitest (Node runtime).
 */
async function readTextFile(path: string): Promise<string> {
	const bunGlobal = (
		globalThis as {
			Bun?: { file: (p: string) => { text: () => Promise<string> } };
		}
	).Bun;
	if (bunGlobal?.file) {
		return bunGlobal.file(path).text();
	}
	const { readFileSync } = await import("node:fs");
	return readFileSync(path, "utf-8");
}

/**
 * Walk the node tree, expand $ref children, and tag ownership. Every visited
 * non-$ref node gets tagged with the currently-active owner file.
 */
async function resolveRefsWithOwnership(
	nodes: RoadmapNode[],
	mainPath: string,
	currentOwner: string,
	visited: Set<string> = new Set(),
): Promise<RoadmapNode[]> {
	const baseDir = dirname(currentOwner);
	const out: RoadmapNode[] = [];

	// The map was seeded at the main-path scope by the caller. This function
	// only adds per-node overrides via setOwnership below.

	for (const node of nodes) {
		if (node.$ref) {
			const refAbsPath = resolve(baseDir, node.$ref);
			if (!refAbsPath.startsWith(baseDir + sep)) {
				bunLogger.error`$ref escapes base directory: ${node.$ref}`;
				out.push(node);
				continue;
			}
			if (visited.has(refAbsPath)) {
				bunLogger.warn`Circular $ref detected, skipping: ${node.$ref}`;
				out.push(node);
				continue;
			}
			visited.add(refAbsPath);

			if (!existsSync(refAbsPath)) {
				bunLogger.error`$ref target does not exist: ${refAbsPath}`;
				out.push(node);
				continue;
			}

			try {
				const refRaw = await readTextFile(refAbsPath);
				const refParsed = JSON.parse(refRaw);
				const refNodes: RoadmapNode[] = Array.isArray(refParsed)
					? (refParsed as RoadmapNode[])
					: ((refParsed as { nodes?: RoadmapNode[] }).nodes ?? [
							refParsed as RoadmapNode,
						]);

				// Tag every ref'd descendant with the ref file as owner
				tagSubtree(refNodes, refAbsPath);

				// Recurse into the ref'd subtree (nested $refs allowed)
				const expanded = await resolveRefsWithOwnership(
					refNodes,
					mainPath,
					refAbsPath,
					visited,
				);
				out.push(...expanded);
			} catch (err) {
				bunLogger.error`Failed to resolve $ref ${node.$ref}: ${String(err)}`;
				out.push(node);
			}
		} else {
			setOwnership(node.id, currentOwner);
			const next: RoadmapNode = { ...node };
			if (node.children) {
				next.children = await resolveRefsWithOwnership(
					node.children,
					mainPath,
					currentOwner,
					visited,
				);
			}
			out.push(next);
		}
	}
	return out;
}

function tagSubtree(nodes: RoadmapNode[], owner: string): void {
	for (const node of nodes) {
		if (node.$ref) continue;
		setOwnership(node.id, owner);
		if (node.children) tagSubtree(node.children, owner);
	}
}

// -- Test-only hooks (underscore-prefixed so they're never part of the public API) --

export function __resetSaveFileModuleForTests(): void {
	cachedSchema = null;
	cachedMainPath = null;
	dialogAllowlist.clear();
}

export function __setCachedMainPathForTests(path: string): void {
	cachedMainPath = resolve(path);
}

export function __pushDialogAllowlistPathForTests(path: string): void {
	pushDialogAllowlistPath(path);
}

export function __getCachedMainPathForTests(): string | null {
	return cachedMainPath;
}
