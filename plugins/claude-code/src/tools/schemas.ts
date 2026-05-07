// Zod input schemas for non-trivial agent tools. Each schema is referenced by
// exactly one server.registerTool call in plugins/claude-code/src/server.ts (Plan 06-05)
// and validated again on the Bun-side renderer dispatcher (Plan 06-04).
import type { z } from "zod";
// Reference z so the import is not flagged unused while this scaffold exists pre-GREEN.
export type _ZodPlaceholder = typeof z;
