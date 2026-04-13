import type { RPCSchema } from "electrobun/bun";

// -- Placeholder types (filled in Phase 2 with Zod schemas) ----------------

/** Placeholder -- full Zod-validated schema defined in @roadraven/core Phase 2 */
export interface RoadmapSchema {
  version: string;
  title: string;
  nodes: RoadmapNode[];
}

/** Placeholder -- full node type defined in @roadraven/core Phase 2 */
export interface RoadmapNode {
  id: string;
  title: string;
  status: string;
  children?: RoadmapNode[];
}

/** Event emitted by integration plugins */
export interface IntegrationEvent {
  nodeId: string;
  status: string;
  meta?: Record<string, unknown>;
  source?: string;
  timestamp?: string;
}

// -- RPC Contract -----------------------------------------------------------

/**
 * Typed RPC contract between Bun main process and webview.
 * Single source of truth -- both sides import from this file.
 * Breaking changes require updating both sides before shipping.
 */
export type RoadmapRPCType = {
  bun: RPCSchema<{
    requests: {
      loadFile: { params: { path: string }; response: RoadmapSchema };
      saveFile: { params: { schema: RoadmapSchema }; response: void };
      exportHtml: { params: { path: string }; response: void };
      exportPng: { params: { path: string }; response: void };
      openFilePicker: { params: Record<string, never>; response: string | null };
      resolveRef: { params: { refPath: string }; response: RoadmapNode[] };
    };
    messages: {
      nodeStatusUpdate: {
        nodeId: string;
        status: string;
        meta?: Record<string, unknown>;
      };
      integrationEvent: { source: string; event: IntegrationEvent };
      fileChanged: { path: string };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      pushStatusUpdate: {
        nodeId: string;
        status: string;
        meta?: Record<string, unknown>;
      };
      pushEventLog: { event: IntegrationEvent };
      pushFileChanged: { path: string };
    };
  }>;
};
