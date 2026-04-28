import { create } from "zustand";

export interface EventApiState {
	status: "off" | "listening" | "error";
	port: number | null;
	connectedCount: number;
	errorMessage: string | null;
	setState: (partial: Partial<Omit<EventApiState, "setState">>) => void;
}

export const useEventApiStore = create<EventApiState>((set) => ({
	status: "off",
	port: null,
	connectedCount: 0,
	errorMessage: null,
	setState: (partial) => set(partial),
}));
