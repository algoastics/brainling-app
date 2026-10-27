const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Removes permissions from release builds only, via src/release/AndroidManifest.xml. Debug builds
 * keep them (React Native's dev menu and LogBox need SYSTEM_ALERT_WINDOW).
 */
module.exports = function withReleaseBlockedPermissions(config, { permissions }) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/release');
      const file = path.join(dir, 'AndroidManifest.xml');
      if (permissions.length === 0) {
        // Nothing to block: drop a file an earlier prebuild left behind, so a removed entry
        // (SYSTEM_ALERT_WINDOW before the overlay permission) does not linger in release builds.
        fs.rmSync(file, { force: true });
        return cfg;
      }
      fs.mkdirSync(dir, { recursive: true });
      const entries = permissions
        .map((p) => `    <uses-permission android:name="${p}" tools:node="remove"/>`)
        .join('\n');
      fs.writeFileSync(
        file,
        `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
${entries}
</manifest>
`,
      );
      return cfg;
    },
  ]);
};
