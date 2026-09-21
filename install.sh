#!/bin/sh
# RoadRaven installer for Linux x64.
#
#   curl -fsSL https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.sh | sh
#
# Downloads the latest release installer, verifies it against that release's
# SHA256SUMS, then runs it (per-user install under ~/.local/share, no sudo).
#
#   ROADRAVEN_VERSION=v0.8.0   install a specific release instead of the latest
#   ROADRAVEN_BASE_URL=<url>   download from a mirror (tests/release/install-script.test.ts)
set -eu

asset="linux-x64-RoadRaven-Setup.tar.gz"
releases="https://github.com/Shuffzord/RoadRaven/releases"

fail() {
	echo "install.sh: $*" >&2
	exit 1
}

# Everything runs from main(), called on the last line, so a download that is
# cut off mid-way under `curl | sh` executes nothing instead of half a script.
main() {
	[ "$(uname -s)" = "Linux" ] || fail "only Linux is supported here (Windows: see the README)"
	[ "$(uname -m)" = "x86_64" ] || fail "only x86_64 builds are published"
	for tool in curl tar sha256sum; do
		command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool"
	done

	if [ -n "${ROADRAVEN_BASE_URL:-}" ]; then
		base="$ROADRAVEN_BASE_URL"
	elif [ -n "${ROADRAVEN_VERSION:-}" ]; then
		base="$releases/download/$ROADRAVEN_VERSION"
	else
		base="$releases/latest/download"
	fi

	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT
	cd "$tmp"

	echo "Downloading $asset ..."
	curl -fL --progress-bar -o "$asset" "$base/$asset" || fail "download failed: $base/$asset"
	curl -fsSL -o SHA256SUMS "$base/SHA256SUMS" || fail "download failed: $base/SHA256SUMS"

	# Check only our asset's line. A missing line must fail: `sha256sum -c` on
	# an empty list would otherwise "pass" without verifying anything.
	grep "  $asset\$" SHA256SUMS >expected || fail "$asset is not listed in SHA256SUMS"
	sha256sum -c expected >/dev/null 2>&1 || fail "checksum mismatch for $asset - refusing to install"

	tar -xzf "$asset"
	chmod +x ./installer
	./installer
}

main
