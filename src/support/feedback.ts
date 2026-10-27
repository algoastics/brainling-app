export type FeedbackInfo = {
  email: string;
  subject: string;
  intro: string;
  appVersion: string;
  build: string;
  device: string;
  os: string;
};

/**
 * `mailto:` link for "Send feedback": app version and device info in the body, nothing from the
 * screen. The user types above the intro line.
 */
export function buildFeedbackMailto(info: FeedbackInfo): string {
  const body = [
    '',
    '',
    info.intro,
    `App: ${info.appVersion} (${info.build})`,
    `Device: ${info.device}`,
    `Android: ${info.os}`,
  ].join('\n');
  return `mailto:${info.email}?subject=${encodeURIComponent(info.subject)}&body=${encodeURIComponent(body)}`;
}
