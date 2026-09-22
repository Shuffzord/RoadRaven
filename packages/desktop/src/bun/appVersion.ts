import pkg from "../../package.json" with { type: "json" };

// The desktop app version has one source: packages/desktop/package.json.
// The main process reads it here (Setup Wizard mismatch check, Event API
// hello frames); the renderer gets the same value at build time through the
// `__APP_VERSION__` Vite define (src/mainview/lib/appVersion.ts).
export const APP_VERSION: string = pkg.version;
