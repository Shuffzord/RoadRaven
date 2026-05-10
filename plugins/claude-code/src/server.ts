import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readSentinel } from "./sentinel";
import { agentToolCallback } from "./tools/agentToolCallback";
import {
	CreateNodeInputSchema,
	CreateRoadmapInputSchema,
	DeleteNodeInputSchema,
	FindNodesInputSchema,
	GetNodeInputSchema,
	MoveNodeInputSchema,
	OpenFileInputSchema,
	RenameNodeInputSchema,
	SaveFileAsInputSchema,
	UpdateNodeMetadataInputSchema,
	UpdateNodeNotesInputSchema,
	UpdateNodeTypeInputSchema,
} from "./tools/schemas";
import { createWsClient } from "./wsClient";

const PACKAGE_VERSION = "0.1.0";
const SOURCE_NAME = "claude-code";

const wsClient = createWsClient({
	source: SOURCE_NAME,
	version: PACKAGE_VERSION,
});

const server = new McpServer({
	name: "roadraven-claude-code",
	version: PACKAGE_VERSION,
});

// -------- Phase 4 carry-forward --------

server.registerTool(
	"updateNodeStatus",
	{
		title: "Update RoadRaven node status",
		description:
			"Push a status update to a node. Requires the desktop app to be running and a roadmap loaded. Routes through the agent dispatcher so the change appears in the event-log drawer (Ctrl+Shift+L).",
		inputSchema: z.object({
			nodeId: z.string().min(1).describe("The node UUID from the roadmap"),
			status: z
				.string()
				.min(1)
				.describe(
					"Status id — must match one in the loaded schema's statusConfig",
				),
			meta: z
				.record(z.string(), z.unknown())
				.optional()
				.describe(
					"Arbitrary key-value metadata, e.g. { branch, commit, ci_run_id }",
				),
		}),
	},
	agentToolCallback("updateNodeStatus", wsClient),
);

server.registerTool(
	"getEventApiStatus",
	{
		title: "Check RoadRaven Event API",
		description:
			"Returns the current Event API URL, PID, and startedAt — or an error if the app is not running.",
		inputSchema: z.object({}),
	},
	async () => {
		const sentinel = await readSentinel();
		return {
			content: [{ type: "text", text: JSON.stringify(sentinel, null, 2) }],
		};
	},
);

// -------- Phase 6 read tools (PLUG-AGENT-READ-*) --------

server.registerTool(
	"getRoadmap",
	{
		title: "Get the loaded RoadRaven roadmap",
		description:
			"Return the full schema tree from the desktop app, with live-event statuses merged in. Requires the app to be running and a file to be loaded.",
		inputSchema: z.object({}),
	},
	agentToolCallback("getRoadmap", wsClient),
);

server.registerTool(
	"getNode",
	{
		title: "Get a single RoadRaven node",
		description:
			"Return a node by UUID, with its immediate parent ID and full ancestor chain (root-to-parent). Status reflects the live overlay if a recent event landed.",
		inputSchema: GetNodeInputSchema,
	},
	agentToolCallback("getNode", wsClient),
);

server.registerTool(
	"findNodes",
	{
		title: "Find RoadRaven nodes by structured filter",
		description:
			"Search nodes by AND-combined filter: titleContains (case-insensitive substring), status, type, metaKey + metaValue, parentId. All fields optional. Returns matching nodes with their parent IDs.",
		inputSchema: FindNodesInputSchema,
	},
	agentToolCallback("findNodes", wsClient),
);

server.registerTool(
	"getStatusConfig",
	{
		title: "Get RoadRaven status configuration",
		description:
			"Return the loaded roadmap's statusConfig array (the valid status IDs and their labels/colors). Use this before createNode if you don't know what statuses are valid.",
		inputSchema: z.object({}),
	},
	agentToolCallback("getStatusConfig", wsClient),
);

server.registerTool(
	"getTypeConfig",
	{
		title: "Get RoadRaven type configuration",
		description:
			"Return the loaded roadmap's typeConfig array (the valid node-type IDs and their visual configuration).",
		inputSchema: z.object({}),
	},
	agentToolCallback("getTypeConfig", wsClient),
);

server.registerTool(
	"getOpenFile",
	{
		title: "Get the currently open RoadRaven file",
		description:
			"Return filePath (or null if untitled), isUntitled flag, document title, and total nodeCount. Works even when no file is loaded — returns null filePath and isUntitled=false.",
		inputSchema: z.object({}),
	},
	agentToolCallback("getOpenFile", wsClient),
);

// -------- Phase 6 create tools (PLUG-AGENT-CREATE-*) --------

server.registerTool(
	"createNode",
	{
		title: "Create a new RoadRaven node",
		description:
			"Add a child node under parentId with the given title. Optional: type, status (defaults to first statusConfig entry), notes (markdown), metadata. Returns the new node's UUID. Requires a loaded roadmap.",
		inputSchema: CreateNodeInputSchema,
	},
	agentToolCallback("createNode", wsClient),
);

server.registerTool(
	"createRoadmap",
	{
		title: "Create a new RoadRaven roadmap",
		description:
			"Initialize an in-memory untitled schema (mirrors File > New). Optional: title, statusConfig, typeConfig. The agent must call saveFileAs to persist the new roadmap to disk.",
		inputSchema: CreateRoadmapInputSchema,
	},
	agentToolCallback("createRoadmap", wsClient),
);

// -------- Phase 6 update tools (PLUG-AGENT-UPDATE-*) --------

server.registerTool(
	"renameNode",
	{
		title: "Rename a RoadRaven node",
		description: "Change a node's title.",
		inputSchema: RenameNodeInputSchema,
	},
	agentToolCallback("renameNode", wsClient),
);

server.registerTool(
	"updateNodeType",
	{
		title: "Update a RoadRaven node's type",
		description:
			"Change a node's type string. Use getTypeConfig to discover valid types.",
		inputSchema: UpdateNodeTypeInputSchema,
	},
	agentToolCallback("updateNodeType", wsClient),
);

server.registerTool(
	"updateNodeNotes",
	{
		title: "Replace a RoadRaven node's notes",
		description:
			"Replace a node's notes string (markdown). Pass an empty string to clear. This is REPLACE, not patch — the entire notes field is overwritten.",
		inputSchema: UpdateNodeNotesInputSchema,
	},
	agentToolCallback("updateNodeNotes", wsClient),
);

server.registerTool(
	"updateNodeMetadata",
	{
		title: "Patch a RoadRaven node's metadata (shallow merge)",
		description:
			"Shallow-PATCH a node's metadata. Each key in `patch` overwrites the same key in node.metadata; null value deletes that key. Unlisted keys are preserved. Returns the final metadata object.",
		inputSchema: UpdateNodeMetadataInputSchema,
	},
	agentToolCallback("updateNodeMetadata", wsClient),
);

server.registerTool(
	"moveNode",
	{
		title: "Move a RoadRaven node to a new parent",
		description:
			"Re-parent a node to newParentId at optional position (0 = first child; omit = last child). Blocks cycles (cannot move into own subtree) and cross-$ref-boundary moves.",
		inputSchema: MoveNodeInputSchema,
	},
	agentToolCallback("moveNode", wsClient),
);

// -------- Phase 6 delete tool (PLUG-AGENT-DELETE-*) --------

server.registerTool(
	"deleteNode",
	{
		title: "Delete a RoadRaven node",
		description:
			"Delete a node. Leaf nodes delete immediately; non-leaf nodes require cascade:true (returns cascade_required with childCount otherwise). Cannot delete the last remaining root.",
		inputSchema: DeleteNodeInputSchema,
	},
	agentToolCallback("deleteNode", wsClient),
);

// -------- Phase 6 file-lifecycle tools (PLUG-AGENT-FILE-*) --------

server.registerTool(
	"saveFile",
	{
		title: "Save the currently open RoadRaven file",
		description:
			"Force-flush the autosave debouncer immediately. Returns ok or save_error. For untitled schemas, call saveFileAs first.",
		inputSchema: z.object({}),
	},
	agentToolCallback("saveFile", wsClient),
);

server.registerTool(
	"saveFileAs",
	{
		title: "Save the RoadRaven roadmap to a new path",
		description:
			"Save the loaded roadmap to a new file path. Path must satisfy the same allowlist as user actions (within the loaded directory, or previously user-picked).",
		inputSchema: SaveFileAsInputSchema,
	},
	agentToolCallback("saveFileAs", wsClient),
);

server.registerTool(
	"openFile",
	{
		title: "Open a RoadRaven file by path",
		description:
			"Flush any pending autosave, then load a roadmap file by path. Path must satisfy the path-allowlist (same as user actions). The agent may need to ask the user to open the target directory first.",
		inputSchema: OpenFileInputSchema,
	},
	agentToolCallback("openFile", wsClient),
);

// -------- Shutdown + transport (Phase 4 carry-forward, unchanged) --------

const shutdown = async () => {
	await wsClient.close();
	process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
