// v0.9.0: on Linux the Cottontail main-process runtime trusts no CAs by
// default, so installDefaultCa() hands every fetch() an explicit CA list.
import { rootCertificates } from "node:tls";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installDefaultCa } from "../../../src/bun/platform/tlsRoots";

const URL = "https://example.com/update.json";
const BUNDLE =
	"-----BEGIN CERTIFICATE-----\nsystem\n-----END CERTIFICATE-----\n";

const noFile = (path: string): string => {
	throw new Error(`ENOENT: ${path}`);
};

function fakeFetch() {
	return vi.fn(async () => new Response("ok"));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("installDefaultCa", () => {
	it("on linux passes the first existing system bundle as tls.ca", async () => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		const read = vi.fn((path: string) =>
			path === "/etc/ssl/cert.pem" ? BUNDLE : noFile(path),
		);
		installDefaultCa({ platform: "linux", fetch, readFile: read, env: {} });

		await globalThis.fetch(URL, { method: "HEAD" });

		expect(fetch).toHaveBeenCalledWith(URL, {
			method: "HEAD",
			tls: { ca: BUNDLE },
		});
		// Read once at install time, not per request.
		await globalThis.fetch(URL);
		expect(read.mock.calls.map(([p]) => p)).toEqual([
			"/etc/ssl/certs/ca-certificates.crt",
			"/etc/pki/tls/certs/ca-bundle.crt",
			"/etc/ssl/cert.pem",
		]);
	});

	it("falls back to tls.rootCertificates when no system bundle exists", async () => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		installDefaultCa({ platform: "linux", fetch, readFile: noFile, env: {} });

		await globalThis.fetch(URL);

		expect(fetch).toHaveBeenCalledWith(URL, {
			tls: { ca: rootCertificates },
		});
	});

	it("keeps a caller-supplied tls.ca", async () => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		installDefaultCa({
			platform: "linux",
			fetch,
			readFile: () => BUNDLE,
			env: {},
		});

		await globalThis.fetch(URL, {
			tls: { ca: "mine", rejectUnauthorized: true },
		});

		expect(fetch).toHaveBeenCalledWith(URL, {
			tls: { ca: "mine", rejectUnauthorized: true },
		});
	});

	it.each([
		"win32",
		"darwin",
	] as const)("leaves fetch unchanged on %s", (platform) => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		installDefaultCa({ platform, fetch, readFile: () => BUNDLE });

		expect(globalThis.fetch).toBe(fetch);
	});

	it.each([
		"SSL_CERT_FILE",
		"SSL_CERT_DIR",
		"NODE_EXTRA_CA_CERTS",
	])("leaves fetch unchanged when %s is set", (name) => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		installDefaultCa({
			platform: "linux",
			fetch,
			readFile: () => BUNDLE,
			env: { [name]: "/corp/ca.pem" },
		});

		expect(globalThis.fetch).toBe(fetch);
	});

	it("is idempotent: a second call does not wrap again", async () => {
		const fetch = fakeFetch();
		vi.stubGlobal("fetch", fetch);
		installDefaultCa({
			platform: "linux",
			fetch,
			readFile: () => BUNDLE,
			env: {},
		});
		const wrapped = globalThis.fetch;
		installDefaultCa({ platform: "linux", readFile: () => BUNDLE, env: {} });

		expect(globalThis.fetch).toBe(wrapped);
		await globalThis.fetch(URL);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(URL, { tls: { ca: BUNDLE } });
	});
});
