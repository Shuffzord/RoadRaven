/// <reference types="vite/client" />

// Compile-time app version, defined in vite.config.ts / vitest.config.ts from
// packages/desktop/package.json. Read it through src/mainview/lib/appVersion.ts.
declare const __APP_VERSION__: string;
