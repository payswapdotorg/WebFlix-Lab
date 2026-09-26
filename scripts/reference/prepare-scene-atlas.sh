#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
VIDEO="$REPO_ROOT/reference/video/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4"
OUT="$REPO_ROOT/reference/frames/reference"

if [[ "$#" -ge 1 ]]; then
  VIDEO="$1"
fi

if [[ ! -f "$VIDEO" ]]; then
  echo "Missing reference video: $VIDEO" >&2
  echo "Import it first with scripts/reference/import-and-verify-video.sh" >&2
  exit 2
fi

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg is required" >&2; exit 3; }

mkdir -p "$OUT"
rm -f "$OUT"/frame-*.jpg "$OUT"/ffprobe.json

ffmpeg -hide_banner -loglevel error   -i "$VIDEO"   -vf "fps=1/60,scale=640:-1:flags=lanczos"   -q:v 6   "$OUT/frame-%02d.jpg"

ffprobe -v error -print_format json -show_format -show_streams "$VIDEO" > "$OUT/ffprobe.json"

echo "Reference sample frames written to $OUT"
echo "Use docs/reference/reference-video-scene-atlas.md as the annotation guide."
