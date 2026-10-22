const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} = require('expo/config-plugins');

const SERVICE_CLASS = 'com.algoastics.brainling.core.detection.BrainlingAccessibilityService';
const XML_NAME = 'brainling_accessibility_service';
const DESCRIPTION_KEY = 'brainling_accessibility_description';
const SIGNED_RULES_PATH = path.join(
  __dirname,
  'android/src/main/assets/brainling/rules.signed.json',
);

/**
 * Packages the service may observe: every package of the apps enabled in the bundled signed
 * ruleset (the payload the app verifies at runtime). The service narrows this further at runtime
 * when a remote ruleset disables an app.
 */
function enabledPackages() {
  const envelope = JSON.parse(fs.readFileSync(SIGNED_RULES_PATH, 'utf8'));
  const rules = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
  return rules.apps.filter((app) => app.enabled).flatMap((app) => app.packageNames);
}

function serviceXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeViewScrolled|typeWindowContentChanged|typeWindowStateChanged"
    android:packageNames="${enabledPackages().join(',')}"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagReportViewIds|flagIncludeNotImportantViews"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="false"
    android:isAccessibilityTool="false"
    android:description="@string/${DESCRIPTION_KEY}" />
`;
}

const withServiceXml = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${XML_NAME}.xml`), serviceXml());
      return cfg;
    },
  ]);

const withDescription = (config, description) =>
  withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: DESCRIPTION_KEY, translatable: 'false' }, _: description }],
      cfg.modResults,
    );
    return cfg;
  });

const withServiceDeclaration = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE_CLASS);
    app.service.push({
      $: {
        'android:name': SERVICE_CLASS,
        'android:exported': 'false',
        'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
        'android:label': '@string/app_name',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.accessibilityservice',
            'android:resource': `@xml/${XML_NAME}`,
          },
        },
      ],
    });
    return cfg;
  });

/** Declares the reel-counting AccessibilityService and its configuration. */
module.exports = function withBrainlingCore(config, props = {}) {
  const description =
    props.serviceDescription ??
    'Brainling counts the short videos you watch in Instagram, YouTube, TikTok, Facebook and Snapchat. It reads only which screen is open, never what is on it, and nothing leaves your phone.';
  config = withServiceXml(config);
  config = withDescription(config, description);
  return withServiceDeclaration(config);
};
