#!/usr/bin/env bash
# Read-only check for "the app shows up twice". Run after prebuild (manifest) and after
# assembleRelease (APK). Optional serial: also lists what the phone has, per user. Never installs,
# uninstalls or clears anything.
#   scripts/check-android-identity.sh [adb-serial]
set -euo pipefail
cd "$(dirname "$0")/.."
ID=com.algoastics.thumbwell
MANIFEST=android/app/src/main/AndroidManifest.xml
APK=android/app/build/outputs/apk/release/app-release.apk
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
fail=0

if [ -f "$MANIFEST" ]; then
  n=$(grep -c 'android.intent.category.LAUNCHER' "$MANIFEST" || true)
  a=$(grep -c '<activity-alias' "$MANIFEST" || true)
  echo "manifest: LAUNCHER filters=$n activity-alias=$a"
  [ "$n" = 1 ] && [ "$a" = 0 ] || { echo "FAIL: expected exactly one LAUNCHER filter and no alias"; fail=1; }
fi
if grep -Eq "applicationId '$ID'" android/app/build.gradle 2>/dev/null; then
  echo "gradle: applicationId $ID"
else
  echo "FAIL: android/app/build.gradle applicationId is not $ID"; fail=1
fi
if [ -f "$APK" ]; then
  AAPT=$(ls "$SDK"/build-tools/*/aapt2 | tail -1)
  "$AAPT" dump badging "$APK" | grep -E "^package:|launchable-activity" | sed 's/ platformBuild.*//'
  l=$("$AAPT" dump badging "$APK" | grep -c '^launchable-activity' || true)
  [ "$l" = 1 ] || { echo "FAIL: APK has $l launchable activities"; fail=1; }
fi
if [ "${1:-}" != "" ]; then
  ADB="$SDK/platform-tools/adb"
  echo "--- phone $1: users"; "$ADB" -s "$1" shell pm list users
  for u in $("$ADB" -s "$1" shell pm list users | grep -o 'UserInfo{[0-9]*' | grep -o '[0-9]*$'); do
    echo "--- user $u: packages matching thumbwell|brainling"
    "$ADB" -s "$1" shell pm list packages --user "$u" | grep -i -E 'thumbwell|brainling' || echo "(none)"
    echo "--- user $u: launcher entries"
    "$ADB" -s "$1" shell cmd package query-activities --user "$u" --brief \
      -a android.intent.action.MAIN -c android.intent.category.LAUNCHER | grep -i -E 'thumbwell|brainling' || echo "(none)"
  done
fi
[ "$fail" = 0 ] && echo OK || exit 1
