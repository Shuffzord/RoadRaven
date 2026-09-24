#!/usr/bin/env node
export {};

if (process.argv[2] === "init") {
	const { runInit } = await import("./init");
	await runInit(process.argv.slice(3));
} else {
	await import("./server");
}
