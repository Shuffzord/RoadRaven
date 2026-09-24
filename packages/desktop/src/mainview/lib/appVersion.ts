// Renderer-side app version. `__APP_VERSION__` is a compile-time constant that
// vite.config.ts / vitest.config.ts define from packages/desktop/package.json,
// so this is the same value the main process reads in src/bun/appVersion.ts.
export const APP_VERSION: string = __APP_VERSION__;
