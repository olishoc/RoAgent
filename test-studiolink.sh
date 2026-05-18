#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$ROOT/server"
ROAGENT="$ROOT/roagent"
LICENSE_SERVER="$ROOT/license-server"
PORT="${STUDIOLINK_TEST_PORT:-45679}"
TOKEN="studiolink-test-token"
TMP_DATA="$(mktemp -d)"
DAEMON_LOG="$(mktemp)"
PID=""

cleanup() {
  if [[ -n "$PID" ]]; then
    kill "$PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DATA" "$DAEMON_LOG"
}
trap cleanup EXIT

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

step "License server typecheck and tests"
(cd "$LICENSE_SERVER" && npm run typecheck && npm test)

step "Server typecheck"
(cd "$SERVER" && npm run typecheck)

step "Server tests: smoke, git, prompts 1-7"
(cd "$SERVER" && npm test)

step "Build StudioLink daemon executable"
(cd "$SERVER" && npm run build:exe && ./dist/studiolink-daemon --version)

step "Build RoAgent executable/launcher"
(cd "$ROAGENT" && npx tsx build.ts && ./dist/roagent --version)

step "Installer script syntax checks"
bash -n "$ROOT/installer/macos/build-pkg.sh"
bash -n "$ROOT/installer/macos/studiolink-uninstall"
node --check "$ROOT/installer/shared/health-check.js"
python3 - <<'PY' "$ROOT/.github/workflows/build-windows.yml" "$ROOT/.github/workflows/build-macos.yml"
import pathlib, sys, yaml
for item in sys.argv[1:]:
    yaml.safe_load(pathlib.Path(item).read_text())
    print(f"YAML OK: {item}")
PY

step "Start built daemon and run post-install health check"
export PLUGIN_PORT="$PORT"
export STUDIOLINK_DAEMON_PORT="$PORT"
export PLUGIN_DATA_DIR="$TMP_DATA"
export PLUGIN_AUTH_TOKEN="$TOKEN"
export STUDIOLINK_ROAGENT_PATH="$ROAGENT/dist/roagent"
export PATH="$ROAGENT/dist:$PATH"
"$SERVER/dist/studiolink-daemon" >"$DAEMON_LOG" 2>&1 &
PID="$!"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/tmp/studiolink-health.json; then
    cat /tmp/studiolink-health.json
    echo
    node "$ROOT/installer/shared/health-check.js"
    step "All local StudioLink checks passed"
    echo "You can now test manually with:"
    echo "  cd $ROOT && ./test-studiolink.sh"
    exit 0
  fi
  sleep 0.5
done

echo "Daemon did not become healthy. Log:"
cat "$DAEMON_LOG"
exit 1
