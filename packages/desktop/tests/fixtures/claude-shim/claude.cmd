@echo off
rem Stands in for an npm `claude.cmd` shim: cmd.exe starts the "real claude",
rem which records its pid and outlives any test budget, holding the pipes.
node -e "require('node:fs').writeFileSync(process.env.RR_SHIM_PID_FILE, String(process.pid)); setTimeout(() => {}, 30000)"
