#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA="36485eb804de5c69aadf9c0a9d4998dfa85ce4e3ed9a4f502bbd45fc170cdce2"
REPO_ROOT="$(git rev-parse --show-toplevel)"
DEST="$REPO_ROOT/reference/video/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4"

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 /path/to/reference-video.mp4" >&2
  exit 2
fi

SRC="$1"

if [[ ! -f "$SRC" ]]; then
  echo "Reference file not found: $SRC" >&2
  exit 3
fi

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"

ACTUAL_SHA="$(sha256sum "$DEST" | awk '{print $1}')"

if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "SHA-256 mismatch." >&2
  echo "Expected: $EXPECTED_SHA" >&2
  echo "Actual:   $ACTUAL_SHA" >&2
  rm -f "$DEST"
  exit 4
fi

echo "Verified golden reference:"
echo "  $DEST"
echo "  SHA-256: $ACTUAL_SHA"

if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate,channels,sample_rate -of default=noprint_wrappers=1 "$DEST"
else
  echo "ffprobe not installed; hash verification still succeeded."
fi
