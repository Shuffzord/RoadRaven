export type LogLevel = "debug" | "info" | "warning" | "error" | "fatal";

export interface LogMessage {
	level: LogLevel;
	category: string[];
	message: string;
	data?: Record<string, unknown>;
}
