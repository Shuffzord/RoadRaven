/**
 * Event emitted by integration plugins when external state changes.
 * Used by the plugin host to route updates to the correct node.
 */
export interface IntegrationEvent {
	nodeId: string;
	status: string;
	meta?: Record<string, unknown>;
	source?: string;
	timestamp?: string;
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
