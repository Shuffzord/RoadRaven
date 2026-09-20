// Version reported to RoadRaven in the hello frame and to the MCP host.
// Read from package.json so it cannot drift from the published package
// (it did: this was pinned at "0.1.0" through v0.6). bun build inlines the
// JSON at bundle time, so the published dist carries no runtime file read.
// Kept in its own module (rather than inline in server.ts) so it can be
// imported by tests without triggering server.ts's top-level stdio connect.
import pkg from "../package.json" with { type: "json" };

export const PACKAGE_VERSION = pkg.version;
