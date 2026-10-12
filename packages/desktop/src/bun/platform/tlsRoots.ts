// Platform seam: on Linux the Cottontail main-process runtime (0.5.0) starts
// with no trusted CAs, so every main-process HTTPS fetch — the Electrobun
// Updater's included — fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. This
// hands each fetch() an explicit CA list. Remove it once Cottontail loads
// default roots itself.
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";

const SYSTEM_BUNDLES = [
	"/etc/ssl/certs/ca-certificates.crt", // Debian, Ubuntu, Arch
	"/etc/pki/tls/certs/ca-bundle.crt", // Fedora, RHEL
	"/etc/ssl/cert.pem", // Alpine, Arch
	"/etc/ssl/ca-bundle.pem", // openSUSE
];

// The runtime reads these at startup; wrapping fetch would replace that trust.
const CA_ENV = ["SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS"];

const WRAPPED = Symbol.for("roadraven.defaultCa");

type Fetch = (
	input: string | URL | Request,
	init?: BunFetchRequestInit,
) => Promise<Response>;

function systemCa(readFile: (path: string) => string): string | undefined {
	for (const path of SYSTEM_BUNDLES) {
		try {
			return readFile(path);
		} catch {
			// not on this distro, try the next path
		}
	}
	return undefined;
}

export function installDefaultCa({
	platform = process.platform,
	fetch = globalThis.fetch,
	readFile = (path: string) => readFileSync(path, "utf8"),
	env = process.env,
}: {
	platform?: NodeJS.Platform;
	fetch?: Fetch;
	readFile?: (path: string) => string;
	env?: Record<string, string | undefined>;
} = {}): void {
	if (platform !== "linux" || WRAPPED in fetch) return;
	if (CA_ENV.some((name) => env[name])) return;
	const ca = systemCa(readFile) ?? [...rootCertificates];
	const wrapped: Fetch = (input, init) =>
		fetch(input, { ...init, tls: { ca, ...init?.tls } });
	globalThis.fetch = Object.assign(wrapped, {
		preconnect: globalThis.fetch.preconnect,
		[WRAPPED]: true,
	});
}
