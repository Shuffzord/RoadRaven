# RoadRaven installer for Windows x64.
#
#   irm https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.ps1 | iex
#
# Downloads the latest release installer, verifies it against that release's
# SHA256SUMS, then runs it (per-user install under %LOCALAPPDATA%, no admin).
# Works in Windows PowerShell 5.1 (what `irm | iex` usually runs in) and 7+.
#
#   $env:ROADRAVEN_VERSION = 'v0.8.0'   install a specific release instead of the latest
#   $env:ROADRAVEN_BASE_URL = '<url>'   download from a mirror (tests/release/install-ps1.test.ts)

# Everything runs from Install-RoadRaven, called on the last line, so a download
# that is cut off mid-way executes nothing, and its variables and preferences
# stay out of the caller's session. Failures `throw`: under `irm | iex`, `exit`
# would close the user's PowerShell window.
function Install-RoadRaven {
	$ErrorActionPreference = 'Stop'
	# Windows PowerShell 5.1's progress bar slows Invoke-WebRequest to a crawl.
	$ProgressPreference = 'SilentlyContinue'

	$asset = 'win-x64-RoadRaven-Setup.zip'
	$releases = 'https://github.com/Shuffzord/RoadRaven/releases'

	if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'install.ps1: only Windows is supported here (Linux: see the README)' }
	# Inside 32-bit PowerShell, PROCESSOR_ARCHITEW6432 holds the real architecture.
	$arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
	if ($arch -ne 'AMD64') { throw 'install.ps1: only x64 builds are published' }

	if ($env:ROADRAVEN_BASE_URL) {
		$base = $env:ROADRAVEN_BASE_URL
	} elseif ($env:ROADRAVEN_VERSION) {
		$base = "$releases/download/$env:ROADRAVEN_VERSION"
	} else {
		$base = "$releases/latest/download"
	}

	# GitHub requires TLS 1.2, which Windows PowerShell 5.1 may not offer by default.
	[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

	$tmp = Join-Path ([IO.Path]::GetTempPath()) "roadraven-$([Guid]::NewGuid())"
	$null = [IO.Directory]::CreateDirectory($tmp)
	try {
		Write-Host "Downloading $asset ..."
		foreach ($file in $asset, 'SHA256SUMS') {
			try {
				Invoke-WebRequest -UseBasicParsing -Uri "$base/$file" -OutFile (Join-Path $tmp $file)
			} catch {
				throw "install.ps1: download failed: $base/$file ($($_.Exception.Message))"
			}
		}

		# Check only our asset's line, matched by exact name. A missing line must
		# fail rather than install something unverified.
		$expected = foreach ($line in Get-Content -LiteralPath (Join-Path $tmp 'SHA256SUMS')) {
			$hash, $name = $line -split '\s+', 2
			if ($name -ceq $asset) { $hash }
		}
		if (-not $expected) { throw "install.ps1: $asset is not listed in SHA256SUMS" }
		# -ne ignores case: sha256sum writes lowercase hex, Get-FileHash uppercase.
		if ((Get-FileHash -LiteralPath (Join-Path $tmp $asset) -Algorithm SHA256).Hash -ne $expected) {
			throw "install.ps1: checksum mismatch for $asset - refusing to install"
		}

		# The whole zip: Setup.exe refuses to run without the .installer\ folder beside it.
		Expand-Archive -LiteralPath (Join-Path $tmp $asset) -DestinationPath $tmp
		# Setup.exe is a GUI exe, so `&` would not wait for it, and Start-Process -Wait
		# would also wait for the app it launches when the user clicks Close (-Wait
		# covers the whole process tree). Wait for Setup.exe alone.
		$setup = Start-Process -FilePath (Join-Path $tmp 'RoadRaven-Setup.exe') -WorkingDirectory $tmp -PassThru
		$setup.WaitForExit()
		if ($setup.ExitCode -ne 0) { throw "install.ps1: RoadRaven-Setup.exe failed (exit code $($setup.ExitCode))" }
	} finally {
		Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
	}
}

Install-RoadRaven
