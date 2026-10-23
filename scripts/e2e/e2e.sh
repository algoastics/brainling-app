#!/usr/bin/env bash
# One command: build release (debug-keystore signed), install on the emulator, enable the
# accessibility service, run the IG/FB e2e cases.   scripts/e2e/e2e.sh [ig|fb|all] [--no-build]
set -euo pipefail
cd "$(dirname "$0")/../.."
SERIAL=${E2E_SERIAL:-emulator-5554}
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s $SERIAL"
if [[ "${2:-}" != "--no-build" ]]; then
  (cd android && JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home \
    ANDROID_HOME=$HOME/Library/Android/sdk SENTRY_DISABLE_AUTO_UPLOAD=true \
    BRAINLING_RULES_KEY_DIR="${BRAINLING_RULES_KEY_DIR:-$HOME/Documents/Algoastics Github/brainling-app/.secrets/rules-signing}" \
    ./gradlew -q assembleRelease -PreactNativeArchitectures=arm64-v8a)
  $ADB install -r android/app/build/outputs/apk/release/app-release.apk
fi
S=com.algoastics.brainling/com.algoastics.brainling.core.detection.BrainlingAccessibilityService
$ADB shell settings put secure enabled_accessibility_services $S
$ADB shell settings put secure accessibility_enabled 1
sleep 12 # let the service bind and load rules
$ADB shell dumpsys accessibility | grep -q "label=Brainling" || { echo "service not bound"; exit 1; }
E2E_SERIAL=$SERIAL python3 -u scripts/e2e/run.py "${1:-all}"
