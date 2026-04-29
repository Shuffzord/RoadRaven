import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readSentinel } from "./sentinel";
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

server.registerTool(
	"updateNodeStatus",
	{
		title: "Update RoadRaven node status",
		description:
			"Push a status update to a RoadRaven node. Requires the RoadRaven desktop app to be running.",
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
	async ({ nodeId, status, meta }) => {
		try {
			await wsClient.send({ nodeId, status, meta });
			return { content: [{ type: "text", text: "ok" }] };
		} catch {
			// Distinguish: sentinel missing vs sentinel present but WS unreachable
			const sentinel = await readSentinel();
			if (!sentinel.ok) {
				return {
					content: [
						{
							type: "text",
							text: "Roadmap Viewer is not running. Start the app and retry.",
						},
					],
					isError: true,
				};
			}
			return {
				content: [
					{
						type: "text",
						text: `Roadmap Viewer is running but the Event API is unreachable at ${sentinel.url}. Check the logs for startup errors.`,
					},
				],
				isError: true,
			};
		}
	},
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

const shutdown = async () => {
	await wsClient.close();
	process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
