# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "yt-dlp>=2024.04.09",
#   "faster-whisper>=1.0.0",
#   "nvidia-cublas-cu12; sys_platform == 'win32'",
#   "nvidia-cudnn-cu12>=9.0.0; sys_platform == 'win32'",
# ]
# ///
"""Download a YouTube video's audio and transcribe it locally with faster-whisper.

Quick start (Windows, with uv installed):
    winget install ffmpeg          # one-time prereq, then verify: ffmpeg -version
    uv run transcribe.py "<YouTube URL>"

uv reads the inline `# /// script` block above and auto-creates a cached venv.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


def _ensure_cuda_dlls_on_path() -> None:
    """On Windows, make CUDA DLLs from the nvidia-cublas-cu12 / nvidia-cudnn-cu12
    / nvidia-cuda-nvrtc-cu12 wheels findable by CTranslate2.

    Three things are needed because CTranslate2 lazy-loads cuBLAS via a native
    `LoadLibrary` call on first inference, which ignores os.add_dll_directory
    when the call doesn't pass LOAD_LIBRARY_SEARCH_USER_DIRS:
      1. os.add_dll_directory  - covers ctypes / Python-side loads
      2. prepend bin/ to PATH  - covers native LoadLibrary("cublas64_12.dll")
      3. ctypes.WinDLL preload - belt-and-braces: once a DLL is loaded by
         full path, subsequent LoadLibrary calls reuse the loaded module.
    """
    if sys.platform != "win32":
        return
    targets = ("cublas", "cudnn", "cuda_nvrtc")
    bin_dirs: list[Path] = []
    for entry in sys.path:
        if not entry:
            continue
        nvidia_root = Path(entry) / "nvidia"
        if not nvidia_root.is_dir():
            continue
        for name in targets:
            bin_dir = nvidia_root / name / "bin"
            if bin_dir.is_dir() and bin_dir not in bin_dirs:
                bin_dirs.append(bin_dir)

    for bin_dir in bin_dirs:
        try:
            os.add_dll_directory(str(bin_dir))
        except (OSError, AttributeError):
            pass
        os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ.get("PATH", "")

    import ctypes
    # Load order matters: cublas first (cudnn depends on it), then cudnn graph,
    # then the rest. Other DLLs in the bin/ dirs get found via the search paths
    # we just registered.
    preload_priority = ("cublas64_12.dll", "cublasLt64_12.dll",
                        "cudnn64_9.dll", "cudnn_graph64_9.dll", "cudnn_ops64_9.dll")
    for bin_dir in bin_dirs:
        for dll_name in preload_priority:
            dll_path = bin_dir / dll_name
            if dll_path.is_file():
                try:
                    ctypes.WinDLL(str(dll_path))
                except OSError:
                    pass

WIN_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}
INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_filename(name: str, max_len: int = 150) -> str:
    cleaned = INVALID_CHARS.sub("_", name).rstrip(" .").strip() or "transcript"
    stem = cleaned.split(".")[0].upper()
    if stem in WIN_RESERVED:
        cleaned = f"_{cleaned}"
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip(" .")
    return cleaned


def detect_device(requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        import torch  # type: ignore
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    if shutil.which("nvidia-smi"):
        return "cuda"
    return "cpu"


def default_compute_type(device: str) -> str:
    return "float16" if device == "cuda" else "int8"


def format_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def make_progress_hook():
    state = {"last_pct": -1.0}

    def hook(d: dict) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            done = d.get("downloaded_bytes") or 0
            if total:
                pct = done * 100 / total
                if pct - state["last_pct"] >= 1.0 or pct >= 100:
                    state["last_pct"] = pct
                    print(f"  Downloading: {pct:5.1f}%", end="\r", flush=True)
        elif status == "finished":
            print("  Downloading: 100.0% — extracting audio...", flush=True)
        elif status == "error":
            print("  Download error.", flush=True)

    return hook


def download_audio(url: str, workdir: Path) -> tuple[str, Path]:
    from yt_dlp import YoutubeDL

    workdir.mkdir(parents=True, exist_ok=True)
    ydl_opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "outtmpl": str(workdir / "%(title)s.%(ext)s"),
        "restrictfilenames": False,
        "windowsfilenames": True,
        "progress_hooks": [make_progress_hook()],
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "0",
        }],
        "postprocessor_args": ["-ar", "16000", "-ac", "1"],
        "quiet": True,
        "no_warnings": True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            raise RuntimeError("yt-dlp returned no info for this URL.")
        if "entries" in info and info["entries"]:
            info = info["entries"][0]
        requested = info.get("requested_downloads") or []
        if requested and requested[0].get("filepath"):
            audio_path = Path(requested[0]["filepath"])
        else:
            base = Path(ydl.prepare_filename(info))
            audio_path = base.with_suffix(".wav")

    title = info.get("title", "video")
    if not audio_path.exists():
        raise RuntimeError(f"Audio file not found at expected path: {audio_path}")
    return title, audio_path


def transcribe_audio(
    audio_path: Path,
    model_size: str,
    device: str,
    compute_type: str,
    language: str | None,
):
    if device == "cuda":
        _ensure_cuda_dlls_on_path()
    from faster_whisper import WhisperModel

    print(f"Loading model '{model_size}' on {device} ({compute_type})...")
    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    print("Transcribing...")
    segments_iter, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        vad_filter=True,
    )
    segments = []
    for seg in segments_iter:
        start = format_timestamp(seg.start)[:8]
        end = format_timestamp(seg.end)[:8]
        text = seg.text.strip()
        print(f"  [{start} -> {end}] {text}")
        segments.append(seg)
    return segments, info


def write_txt(segments: list, out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        for seg in segments:
            f.write(seg.text.strip() + "\n")


def write_srt(segments: list, out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, start=1):
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}\n")
            f.write(seg.text.strip() + "\n\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download a YouTube video's audio and transcribe it locally with faster-whisper.",
    )
    p.add_argument("url", nargs="?", help="YouTube URL (omit to be prompted)")
    p.add_argument(
        "--model",
        default="large-v3",
        help="faster-whisper model size (tiny, base, small, medium, large-v2, large-v3, distil-large-v3, ...)",
    )
    p.add_argument("--language", default=None, help="Language code (e.g. en, pl). Omit to auto-detect.")
    p.add_argument("--srt", action="store_true", help="Also write a .srt file with timestamps.")
    p.add_argument("--keep-audio", action="store_true", help="Don't delete the downloaded .wav after transcription.")
    p.add_argument("--output-dir", default="./out", help="Directory for outputs (default: ./out)")
    p.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"], help="Compute device (default: auto)")
    p.add_argument(
        "--compute-type",
        default="auto",
        help="CTranslate2 compute type (auto, float16, int8, int8_float16, ...). Default: auto",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if shutil.which("ffmpeg") is None:
        print("ERROR: ffmpeg not found in PATH.", file=sys.stderr)
        print("Install:  winget install ffmpeg   (or)  choco install ffmpeg", file=sys.stderr)
        print("Verify:   ffmpeg -version", file=sys.stderr)
        return 1

    url = args.url or input("YouTube URL: ").strip()
    if not url:
        print("ERROR: no URL provided.", file=sys.stderr)
        return 1

    out_dir = Path(args.output_dir).resolve()
    audio_dir = out_dir / "_audio"
    out_dir.mkdir(parents=True, exist_ok=True)

    device = detect_device(args.device)
    compute_type = default_compute_type(device) if args.compute_type == "auto" else args.compute_type

    print(f"Downloading audio from: {url}")
    try:
        title, audio_path = download_audio(url, audio_dir)
    except Exception as e:
        if type(e).__name__ == "DownloadError":
            print(f"ERROR: yt-dlp could not download this URL.\n  {e}", file=sys.stderr)
            return 2
        raise

    safe_title = sanitize_filename(title)
    print(f"Audio saved to: {audio_path}")

    try:
        segments, info = transcribe_audio(audio_path, args.model, device, compute_type, args.language)
    except RuntimeError as e:
        msg = str(e).lower()
        if any(k in msg for k in ("out of memory", "cuda", "cublas", "cudnn")):
            print(f"ERROR: GPU/CUDA failure: {e}", file=sys.stderr)
            print("Try a smaller model (--model medium / small / tiny) or --device cpu", file=sys.stderr)
            return 3
        raise

    detected = getattr(info, "language", None)
    if detected and not args.language:
        print(f"Detected language: {detected}")

    txt_path = out_dir / f"{safe_title}.txt"
    write_txt(segments, txt_path)
    print(f"Wrote: {txt_path}")
    if args.srt:
        srt_path = out_dir / f"{safe_title}.srt"
        write_srt(segments, srt_path)
        print(f"Wrote: {srt_path}")

    if args.keep_audio:
        print(f"Audio kept at: {audio_path}")
    else:
        try:
            audio_path.unlink(missing_ok=True)
            try:
                audio_dir.rmdir()
            except OSError:
                pass
        except Exception as e:
            print(f"Warning: could not remove audio file: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
