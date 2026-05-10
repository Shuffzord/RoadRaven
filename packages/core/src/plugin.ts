/**
 * Sentinel `nodeId` used by Phase 6 agent file-lifecycle drawer-audit rows
 * (createRoadmap / saveFile / saveFileAs / openFile). These tools mutate
 * file state, not a specific node, but the IntegrationEvent shape requires
 * a non-empty nodeId.
 *
 * WR-08 (Phase 6 06-REVIEW): exported as a named constant so consumers that
 * need to filter or skip lifecycle rows (e.g. "rows for selected node" UI
 * filters) can compare against the symbol rather than re-deriving the
 * literal. NOT a UUID — permissive ids in the schema (eventSchema.ts §2.1)
 * allow user-authored nodes with this exact id, so this is a documented
 * collision risk; future v1.1 work should add a `kind: 'lifecycle'|'node'`
 * field on the drawer-audit subset of IntegrationEvent and remove the
 * sentinel. v1: documented sentinel.
 */
export const LIFECYCLE_NODE_ID = "__lifecycle__";

/**
 * Event emitted by integration plugins when external state changes.
 * Used by the plugin host to route updates to the correct node.
 *
 * Note: when `nodeId === LIFECYCLE_NODE_ID`, the row represents a Phase 6
 * file-lifecycle agent action (no specific node). Filter-by-selected-node
 * UIs should treat these rows specially or exclude them by default.
 */
export interface IntegrationEvent {
	nodeId: string;
	status: string;
	meta?: Record<string, unknown>;
	source?: string;
	timestamp?: string; // ISO 8601; mapped to `t` in the .events.jsonl line shape
	_error?: "malformed" | "unknown_node" | "invalid_status"; // D-09 classification
}

/**
 * Every integration plugin implements this interface in the Bun process.
 * v1 scope: interface definition only — no plugin host, no loading.
 * Plugin system activation is v1.1 (Phase 4 delivers Event API instead).
 */
export interface RoadmapPlugin {
	/** Unique identifier, e.g. "claude-code", "github-actions" */
	id: string;
	/** Display name shown in integration status bar */
	name: string;
	/** Semver version string */
	version: string;

	/** Called when a node with a matching plugin binding is loaded */
	connect(nodeId: string, config: Record<string, unknown>): Promise<void>;

	/** Called when a subscribed node is deleted or the file is closed */
	disconnect(nodeId: string): Promise<void>;

	/**
	 * Register a handler for plugin events.
	 * off() is mandatory to prevent ghost updates after node deletion.
	 */
	on(event: "status", handler: (e: IntegrationEvent) => void): void;

	/** Unregister a previously registered handler */
	off(event: "status", handler: (e: IntegrationEvent) => void): void;

	/** Optional: configuration for rendering in the side panel Integration zone */
	sidePanel?: {
		component: string;
	};
}
