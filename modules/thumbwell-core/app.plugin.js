const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} = require('expo/config-plugins');

const SERVICE_CLASS = 'com.algoastics.thumbwell.core.detection.ThumbwellAccessibilityService';
const XML_NAME = 'thumbwell_accessibility_service';
const DESCRIPTION_KEY = 'thumbwell_accessibility_description';
// F18 item 8 (Scope v3, D42), verbatim. Must stay consistent with the S06 text (disclosure version 3),
// the Play declaration and the store listing.
const SERVICE_DESCRIPTION =
  'Thumbwell counts the Instagram Reels, YouTube Shorts and TikTok videos you watch, shows your count on a small on-screen counter you can switch off, and, at your limit, covers the reels screen and may pause the video. Everything is processed on your phone.';
const SIGNED_RULES_PATH = path.join(
  __dirname,
  'android/src/main/assets/thumbwell/rules.signed.json',
);
const RULES_URL_META = 'com.algoastics.thumbwell.RULES_URL';
const WORK_FOREGROUND_SERVICE = 'androidx.work.impl.foreground.SystemForegroundService';
const FOREGROUND_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
];

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

/** Remote ruleset URL from the build environment (EAS env THUMBWELL_RULES_URL); https only. */
function rulesUrl(props) {
  const url = (
    props.rulesUrl ??
    process.env.THUMBWELL_RULES_URL ??
    process.env.BRAINLING_RULES_URL ??
    ''
  ).trim();
  if (url === '') return null;
  if (!url.startsWith('https://')) {
    throw new Error('thumbwell-core: THUMBWELL_RULES_URL must be an https:// URL');
  }
  return url;
}

function serviceXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeViewScrolled|typeViewClicked|typeWindowContentChanged|typeWindowStateChanged"
    android:packageNames="${enabledPackages().join(',')}"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagReportViewIds|flagIncludeNotImportantViews"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="false"
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

/** Bakes the remote ruleset URL into the manifest, or removes it when none is configured. */
const withRulesUrl = (config, url) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['meta-data'] = (app['meta-data'] ?? []).filter(
      (m) => m.$['android:name'] !== RULES_URL_META,
    );
    if (url) app['meta-data'].push({ $: { 'android:name': RULES_URL_META, 'android:value': url } });
    return cfg;
  });

/**
 * Thumbwell runs no foreground service: strips WorkManager's SystemForegroundService and the
 * foreground-service permissions from the merged manifest (all build types).
 */
const withoutForegroundService = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter(
      (p) => !FOREGROUND_PERMISSIONS.includes(p.$['android:name']),
    );
    for (const name of FOREGROUND_PERMISSIONS) {
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = (app.service ?? []).filter(
      (s) => s.$['android:name'] !== WORK_FOREGROUND_SERVICE,
    );
    app.service.push({ $: { 'android:name': WORK_FOREGROUND_SERVICE, 'tools:node': 'remove' } });
    return cfg;
  });

/** Supported apps (keep in sync with AppIcons.ALLOWED): visible to getAppIcon on Android 11+. */
const QUERY_PACKAGES = [
  'com.instagram.android',
  'com.google.android.youtube',
  'com.zhiliaoapp.musically',
  'com.ss.android.ugc.trill',
];

/** Adds `<queries>` so the app can load the supported apps' own launcher icons at runtime. */
const withAppQueries = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const queries = manifest.queries ?? [{}];
    const first = queries[0] ?? {};
    const have = new Set((first.package ?? []).map((p) => p.$['android:name']));
    first.package = [
      ...(first.package ?? []),
      ...QUERY_PACKAGES.filter((name) => !have.has(name)).map((name) => ({
        $: { 'android:name': name },
      })),
    ];
    queries[0] = first;
    manifest.queries = queries;
    return cfg;
  });

/** Declares the reel-counting AccessibilityService and its configuration. */
module.exports = function withThumbwellCore(config, props = {}) {
  const description = props.serviceDescription ?? SERVICE_DESCRIPTION;
  config = withServiceXml(config);
  config = withDescription(config, description);
  config = withServiceDeclaration(config);
  config = withRulesUrl(config, rulesUrl(props));
  config = withAppQueries(config);
  return withoutForegroundService(config);
};
