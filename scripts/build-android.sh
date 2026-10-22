#!/usr/bin/env bash
# Release build from nothing: every build cache is removed first — the app's
# and each native library's Gradle/CMake output, Metro's JS cache — so nothing
# stale ends up in it. Downloaded dependencies (~/.gradle/caches/modules-2) are
# kept: they are not build output, and fetching them again only makes it slower.
#
#   npm run apk   64-bit phones only (arm64-v8a), for sideloading. One CPU type
#                 instead of four keeps it small: the Agora SDK and React Native
#                 ship native code per type, and x86/x86_64 only run on emulators.
#   npm run aab   Play Store bundle, 32- and 64-bit ARM. Play hands each phone
#                 only its own part. Needs the upload key (android/app/build.gradle).
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  apk) TASK=assembleRelease ABIS=arm64-v8a OUT=android/app/build/outputs/apk/release/app-release.apk ;;
  aab) TASK=bundleRelease ABIS=armeabi-v7a,arm64-v8a OUT=android/app/build/outputs/bundle/release/app-release.aab ;;
  *) echo "usage: $0 apk|aab" >&2; exit 2 ;;
esac

echo "› Stopping Gradle daemons"
(cd android && ./gradlew --stop) >/dev/null || true

echo "› Removing build caches"
rm -rf android/app/build android/build android/.gradle android/app/.cxx
find node_modules -maxdepth 4 -type d \( -path '*/android/build' -o -path '*/android/.cxx' \) -prune -exec rm -rf {} +
rm -rf node_modules/.cache "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-*
if command -v watchman >/dev/null; then watchman watch-del-all >/dev/null; fi

echo "› Building release $1 ($ABIS)"
(cd android && ./gradlew "$TASK" -PreactNativeArchitectures="$ABIS" --no-build-cache)

echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
