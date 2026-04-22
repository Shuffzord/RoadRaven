import { dirname, resolve as pathResolve, sep } from "node:path";
import type { RoadmapNode } from "../../../../shared/types.ts";
import { bunLogger } from "./logging";
import { setOwnership } from "./refMap";

export interface ResolveRefsOptions {
	/**
	 * Read a UTF-8 file. Production passes a Bun.file-backed reader; tests pass
	 * a node:fs-backed reader. Errors propagate to the caller's catch block,
	 * which logs and emits the unresolved `$ref` node so the rest of the tree
	 * still renders.
	 */
	readFile: (path: string) => Promise<string>;
	/**
	 * Register a file watcher for each successfully-resolved ref. Production
	 * uses this to wire `pushFileChanged`; tests omit it.
	 */
	onWatch?: (path: string) => void;
}

/**
 * Resolve $ref nodes in a roadmap schema tree. Each $ref is replaced with the
 * contents of the referenced file. Every non-$ref node is tagged with its
 * owning file path via `setOwnership` so `saveFile` can split the schema back
 * into per-file payloads on write.
 *
 * Guards (in order):
 *   1. $ref paths that resolve outside the base directory are dropped.
 *   2. Already-visited paths in the current chain are skipped (cycle break).
 *   3. Read failures are logged and the unresolved $ref node is preserved.
 */
export async function resolveRefsWithOwnership(
	nodes: RoadmapNode[],
	basePath: string,
	currentOwner: string,
	opts: ResolveRefsOptions,
	visited: Set<string> = new Set(),
): Promise<RoadmapNode[]> {
	const baseDir = dirname(basePath);
	const out: RoadmapNode[] = [];
	for (const node of nodes) {
		if (node.$ref) {
			const refAbsPath = pathResolve(baseDir, node.$ref);
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
			try {
				const raw = await opts.readFile(refAbsPath);
				const parsed = JSON.parse(raw);
				const refNodes: RoadmapNode[] = Array.isArray(parsed)
					? parsed
					: (parsed.nodes ?? [parsed]);
				opts.onWatch?.(refAbsPath);
				const tagged = await resolveRefsWithOwnership(
					refNodes,
					refAbsPath,
					refAbsPath,
					opts,
					visited,
				);
				out.push(...tagged);
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
					basePath,
					currentOwner,
					opts,
					visited,
				);
			}
			out.push(next);
		}
	}
	return out;
}

/**
 * Default Bun-backed reader used in production. Falls back to node:fs when
 * Bun is absent (vitest runtime) so tests don't have to pass a reader.
 */
export async function defaultReadFile(path: string): Promise<string> {
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
