#!/usr/bin/env bash
# studio_keeper.sh — keep the WebFlix-Lab Operator Studio server (:4313) alive.
# The sandbox reaps orphaned background processes; this keeper re-launches
# the studio server whenever port 4313 stops answering. Started detached
# (setsid) by the TL; logs to /tmp/studio-keeper.log.
STUDIO_DIR="/home/z/WebFlix-Lab"
LOG="/tmp/studio-server.log"
while true; do
  if ! curl -s -m 3 http://127.0.0.1:4313/api/health > /dev/null 2>&1; then
    echo "[$(date -u +%H:%M:%S)] studio down — (re)starting" >> "$LOG"
    cd "$STUDIO_DIR" || exit 1
    bun run studio >> "$LOG" 2>&1 &
  fi
  sleep 20
done
