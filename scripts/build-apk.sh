#!/usr/bin/env bash
# Release APK for 64-bit Android phones (arm64-v8a only), built from nothing.
#
# Every build cache is removed first — the app's and each native library's
# Gradle/CMake output, Metro's JS cache — so nothing stale ends up in the APK.
# Downloaded dependencies (~/.gradle/caches/modules-2) are kept: they are not
# build output, and fetching them again only makes the build slower.
#
# One CPU type instead of four is what keeps the APK small: the Agora SDK and
# React Native ship native code per type, and x86/x86_64 only ever run on
# emulators. 32-bit-only phones can't install this APK.
#
#   npm run apk
set -euo pipefail
cd "$(dirname "$0")/.."

echo "› Stopping Gradle daemons"
(cd android && ./gradlew --stop) >/dev/null || true

echo "› Removing build caches"
rm -rf android/app/build android/build android/.gradle android/app/.cxx
find node_modules -maxdepth 4 -type d \( -path '*/android/build' -o -path '*/android/.cxx' \) -prune -exec rm -rf {} +
rm -rf node_modules/.cache "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-*
if command -v watchman >/dev/null; then watchman watch-del-all >/dev/null; fi

echo "› Building release APK (arm64-v8a)"
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-build-cache)

APK=android/app/build/outputs/apk/release/app-release.apk
echo "✓ $APK ($(du -h "$APK" | cut -f1))"
