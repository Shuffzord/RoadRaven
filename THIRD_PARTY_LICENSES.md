# Third-Party Licenses

This file lists third-party code adapted into RoadRaven and reproduces the
required license texts. Runtime npm dependencies are not listed here — see
`bun.lock` and the `node_modules/<pkg>/LICENSE` files for those.

---

## nativefiledialog-for-bun

**Used in:** `packages/desktop/src/bun/saveFileDialog.ts`

**Source:** https://github.com/Catharacta/nativefiledialog-for-bun
**Version adapted:** 0.3.2 (commit `main` as of 2026-04-22)

We adapted only the script-fallback paths (PowerShell on Windows, osascript on
macOS, zenity on Linux) — roughly 30 LOC per platform. The library's FFI/native
binary backend (`src/backends/ffi.ts`, `vendor/nfd-src`, prebuilt `bin/*.{dll,
dylib,so}`) is NOT vendored.

### License (MIT)

```
MIT License

Copyright (c) 2026 Catharacta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
