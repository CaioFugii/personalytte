#!/bin/sh
set -eu

pids=""

pnpm --dir backend dev &
pids="$!"

if [ -f frontend/package.json ]; then
  pnpm --dir frontend dev &
  pids="$pids $!"
fi

trap 'kill $pids 2>/dev/null || true' INT TERM
wait
