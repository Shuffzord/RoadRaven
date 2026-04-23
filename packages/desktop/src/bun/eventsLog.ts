import { constants } from "node:fs";
import { access, appendFile, readFile } from "node:fs/promises";
import type { IntegrationEvent } from "../../../../shared/types";

export interface EventLogLine {
	t: string; // ISO 8601
	nodeId: string;
	status: string;
	source?: string;
	meta?: Record<string, unknown>;
	_error?: "malformed" | "unknown_node" | "invalid_status";
}

export const SIDECAR_SUFFIX = ".events.jsonl";
export const HYDRATE_EVENT_CAP = 1000; // RESEARCH §4.5 — matches eventLogStore window
export const MALFORMED_RAW_CAP = 200; // RESEARCH §4.2 — truncate for synthesized malformed lines

export function getSidecarPath(sourcePath: string): string {
	return `${sourcePath}${SIDECAR_SUFFIX}`;
}

export async function appendEventLine(sidecarPath: string, line: EventLogLine): Promise<void> {
	// fs.appendFile uses O_APPEND; atomic for writes ≤ PIPE_BUF. Our lines are <512B.
	// NOTE: Do NOT use atomicWrite.ts here — atomic rename would destroy the log.
	await appendFile(sidecarPath, `${JSON.stringify(line)}\n`, "utf-8");
}

export function synthesizeMalformedLine(raw: string, source: string | undefined): EventLogLine {
	return {
		t: new Date().toISOString(),
		nodeId: "__malformed__",
		status: "__malformed__",
		source,
		_error: "malformed",
		meta: { raw: raw.slice(0, MALFORMED_RAW_CAP) },
	};
}

export async function replayEventLog(sidecarPath: string): Promise<{
	overlay: Map<
		string,
		{ nodeId: string; status: string; meta?: Record<string, unknown>; source?: string; lastEventAt: number }
	>;
	events: IntegrationEvent[];
}> {
	try {
		await access(sidecarPath, constants.R_OK);
	} catch {
		return { overlay: new Map(), events: [] };
	}

	const raw = await readFile(sidecarPath, "utf-8");
	const lines = raw.split("\n").filter(Boolean);

	const overlay = new Map<
		string,
		{ nodeId: string; status: string; meta?: Record<string, unknown>; source?: string; lastEventAt: number }
	>();
	const events: IntegrationEvent[] = [];

	for (const ln of lines) {
		let parsed: EventLogLine;
		try {
			parsed = JSON.parse(ln) as EventLogLine;
		} catch {
			// Skip unparseable lines during replay (corrupt entry)
			continue;
		}

		// For drawer: ALL events (including error ones)
		events.push({
			nodeId: parsed.nodeId,
			status: parsed.status,
			meta: parsed.meta,
			source: parsed.source,
			timestamp: parsed.t,
			_error: parsed._error,
		});

		// For overlay: only successful entries (drop _error entries and __malformed__ sentinel)
		if (parsed._error) continue;
		if (parsed.nodeId === "__malformed__") continue;

		overlay.set(parsed.nodeId, {
			nodeId: parsed.nodeId,
			status: parsed.status,
			meta: parsed.meta,
			source: parsed.source,
			lastEventAt: new Date(parsed.t).getTime(),
		});
	}

	// Cap the drawer hydrate at the last N events
	const capped = events.length > HYDRATE_EVENT_CAP ? events.slice(-HYDRATE_EVENT_CAP) : events;
	return { overlay, events: capped };
}
