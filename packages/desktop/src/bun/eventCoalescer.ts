export const FLUSH_MS_DEFAULT = 100; // PLUG-03 / D-25 — consumer passes it in, export for eventServer.ts wiring

export type CoalescedUpdate = {
	nodeId: string;
	status: string;
	meta?: Record<string, unknown>;
	source?: string;
	lastEventAt: number; // epoch ms
};

export class EventCoalescer {
	private pending = new Map<string, CoalescedUpdate>();
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly flushMs: number,
		private readonly onFlush: (updates: CoalescedUpdate[]) => void,
	) {}

	enqueue(update: CoalescedUpdate): void {
		this.pending.set(update.nodeId, update);
		// Timer anchored at first event of batch (RESEARCH §3.1 Design C).
		// NOT re-armed on subsequent enqueue calls (no clearTimeout here).
		if (this.timer === null) {
			this.timer = setTimeout(() => this.flush(), this.flushMs);
		}
	}

	private flush(): void {
		this.timer = null;
		if (this.pending.size === 0) return;
		const updates = Array.from(this.pending.values());
		this.pending.clear();
		this.onFlush(updates);
	}

	flushNow(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.flush();
	}
}
