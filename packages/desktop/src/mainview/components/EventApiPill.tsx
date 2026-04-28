import { useCallback, useEffect, useRef, useState } from "react";
import { useEventApiStore } from "../store/eventApiStore";

// Dynamic-import guard for eventLogStore — owned entirely by Plan 04-04 (I-18).
// The module does not exist until Plan 04-04 ships. We defeat Vite's static
// import analysis by constructing the specifier at runtime so the bundler never
// tries to resolve it as a static dependency. The catch ensures it's a no-op
// when the file is absent (Wave 2 isolation window).
let eventLogStoreRef: unknown = null;
// biome-ignore lint/suspicious/noExplicitAny: return type is intentionally loose — typed in Plan 04-04
const getEventLogStore = async (): Promise<any> => {
	if (!eventLogStoreRef) {
		// Runtime path construction defeats Vite static analysis (I-18 guard)
		const storeDir = "../store/";
		const moduleName = "eventLogStore";
		// biome-ignore lint/suspicious/noExplicitAny: dynamic import guard, typed in Plan 04-04
		eventLogStoreRef = await (
			import(/* @vite-ignore */ `${storeDir}${moduleName}`) as Promise<any>
		).catch(() => null);
	}
	return eventLogStoreRef;
};

function getPillLabel(
	status: "off" | "listening" | "error",
	port: number | null,
	connectedCount: number,
): string {
	if (status === "off") return "○ Event API off";
	if (status === "error") return `● Port :${port ?? "?"} in use`;
	// listening
	if (connectedCount > 0) return `● :${port} · ${connectedCount}`;
	return `● :${port}`;
}

function getPillTooltip(
	status: "off" | "listening" | "error",
	port: number | null,
	connectedCount: number,
): string {
	if (status === "off")
		return "Event API server is off. It starts automatically with RoadRaven.";
	if (status === "error")
		return `Port ${port} is already in use. Set ROADRAVEN_EVENT_PORT to a free port.`;
	if (connectedCount > 0)
		return `${connectedCount} producer(s) connected. Click to open event log.`;
	return `Listening on ws://127.0.0.1:${port}. Click to copy URL.`;
}

export function EventApiPill() {
	const status = useEventApiStore((s) => s.status);
	const port = useEventApiStore((s) => s.port);
	const connectedCount = useEventApiStore((s) => s.connectedCount);

	const [copied, setCopied] = useState(false);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	const handleClick = useCallback(async () => {
		if (connectedCount > 0) {
			// Open event log drawer — dynamic import so eventLogStore stays in Plan 04-04
			const m = await getEventLogStore();
			m?.useEventLogStore.getState().setOpen(true);
			return;
		}
		// Copy ws URL to clipboard when idle (listening, 0 producers)
		if (status === "listening" && port !== null) {
			const url = `ws://127.0.0.1:${port}`;
			try {
				await navigator.clipboard.writeText(url);
			} catch {
				// clipboard may be denied in some CEF builds
			}
			setCopied(true);
			copyTimerRef.current = setTimeout(() => setCopied(false), 1200);
		}
	}, [status, port, connectedCount]);

	const label = copied
		? "Copied ✓"
		: getPillLabel(status, port, connectedCount);
	const tooltip = getPillTooltip(status, port, connectedCount);

	// Dot / glyph color
	let dotColor: string;
	let bgStyle: React.CSSProperties = {};

	if (status === "off") {
		dotColor = "var(--rv-text-tertiary)";
	} else if (status === "error") {
		dotColor = "var(--rv-status-blocked)";
	} else if (connectedCount > 0) {
		dotColor = "var(--rv-status-completed)";
		bgStyle = {
			background: "var(--rv-accent-muted)",
			border: "1px solid var(--rv-accent-border)",
			borderRadius: 4,
			padding: "0 4px",
		};
	} else {
		dotColor = "var(--rv-status-completed)";
	}

	return (
		<button
			type="button"
			aria-label={tooltip}
			title={tooltip}
			onClick={() => void handleClick()}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				cursor: status === "off" ? "default" : "pointer",
				fontSize: 11,
				color: copied ? "var(--rv-status-completed)" : dotColor,
				borderRadius: 4,
				padding: "2px 4px",
				userSelect: "none",
				background: "none",
				border: "none",
				...bgStyle,
			}}
			className="hover:bg-[var(--rv-bg-hover)] transition-colors duration-100"
		>
			{label}
		</button>
	);
}
