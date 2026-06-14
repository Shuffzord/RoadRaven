import { create } from "zustand";

export type ToastType =
	| "malformed"
	| "unknown_node"
	| "invalid_status"
	| "disconnect";

export interface ActiveToast {
	id: string;
	type: ToastType;
	source: string;
	detail?: string;
	count: number;
	lastEventAt: number;
}

/** Toasts with the same type + source within this window are merged (D-24). */
export const THROTTLE_WINDOW_MS = 5000;
/** Maximum number of toasts visible at once (UI-SPEC). */
export const MAX_STACKED = 3;

interface ToastState {
	toasts: ActiveToast[];
	pushToast: (incoming: {
		type: ToastType;
		source: string;
		detail?: string;
	}) => void;
	dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],

	pushToast: (incoming) =>
		set((state) => {
			const now = Date.now();
			const existing = state.toasts.find(
				(t) =>
					t.type === incoming.type &&
					t.source === incoming.source &&
					now - t.lastEventAt < THROTTLE_WINDOW_MS,
			);

			if (existing) {
				// Merge: increment count and bump timestamp
				return {
					toasts: state.toasts.map((t) =>
						t.id === existing.id
							? { ...t, count: t.count + 1, lastEventAt: now }
							: t,
					),
				};
			}

			const next: ActiveToast = {
				id: crypto.randomUUID(),
				type: incoming.type,
				source: incoming.source,
				detail: incoming.detail,
				count: 1,
				lastEventAt: now,
			};

			const updated = [...state.toasts, next];
			// Cap at MAX_STACKED — drop oldest when overflow
			return {
				toasts:
					updated.length > MAX_STACKED
						? updated.slice(updated.length - MAX_STACKED)
						: updated,
			};
		}),

	dismissToast: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		})),
}));
