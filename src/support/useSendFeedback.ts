import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Linking } from 'react-native';

import { appConfig } from '@/config/appConfig';
import { useT } from '@/i18n';

import { buildFeedbackMailto } from './feedback';

/** Opens the mail app with the feedback address, the app version and the device info prefilled. */
export function useSendFeedback(): () => void {
  const t = useT();
  return () => {
    void Linking.openURL(
      buildFeedbackMailto({
        email: appConfig.supportEmail,
        subject: t('settings.feedbackSubject'),
        intro: t('settings.feedbackIntro'),
        appVersion: Application.nativeApplicationVersion ?? '1.0.0',
        build: Application.nativeBuildVersion ?? '1',
        device: [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'unknown',
        os: Device.osVersion ?? 'unknown',
      }),
    ).catch(() => undefined);
  };
}
