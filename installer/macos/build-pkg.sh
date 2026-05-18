#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$ROOT/installer/macos/build"
PAYLOAD="$WORK/payload"
SCRIPTS="$WORK/scripts"
OUT="$ROOT/dist/StudioLink.pkg"

rm -rf "$WORK"
mkdir -p "$PAYLOAD/usr/local/bin" "$PAYLOAD/Library/StudioLink" "$SCRIPTS" "$ROOT/dist"

install -m 755 "$ROOT/dist/studiolink-daemon" "$PAYLOAD/usr/local/bin/studiolink-daemon"
install -m 755 "$ROOT/dist/roagent" "$PAYLOAD/usr/local/bin/roagent"
install -m 755 "$ROOT/installer/macos/studiolink-uninstall" "$PAYLOAD/usr/local/bin/studiolink-uninstall"
install -m 644 "$ROOT/installer/macos/com.studiolink.daemon.plist" "$PAYLOAD/Library/StudioLink/com.studiolink.daemon.plist"
install -m 755 "$ROOT/installer/shared/health-check.js" "$PAYLOAD/Library/StudioLink/health-check.js"
install -m 755 "$ROOT/installer/macos/scripts/postinstall" "$SCRIPTS/postinstall"

pkgbuild \
  --root "$PAYLOAD" \
  --scripts "$SCRIPTS" \
  --identifier "dev.studiolink.pkg" \
  --version "1.0.0" \
  --install-location "/" \
  "$WORK/StudioLinkComponent.pkg"

productbuild \
  --package "$WORK/StudioLinkComponent.pkg" \
  --identifier "dev.studiolink.installer" \
  --version "1.0.0" \
  "$OUT"

echo "Built $OUT"
