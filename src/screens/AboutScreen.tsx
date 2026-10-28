import * as Application from 'expo-application';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/mascot';
import { Wordmark } from '@/components/Wordmark';
import { Card, ListRow, ListSection, Screen, Text, TopBar } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { useT } from '@/i18n';
import { useSendFeedback } from '@/support/useSendFeedback';
import { space, spacing } from '@/theme';

/** S43-about: privacy and feedback links, the version, the trademark note and the licences. */
export function AboutScreen() {
  const t = useT();
  const sendFeedback = useSendFeedback();
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';
  return (
    <Screen
      testID="about"
      header={<TopBar title={t('about.title')} onBack={() => router.back()} />}
    >
      <View style={styles.groups}>
        <View style={styles.identity}>
          <Thumb pose="happy" width={104} />
          <Wordmark size={36} />
        </View>
        <ListSection title={t('about.legal')}>
          <ListRow
            testID="about-privacy"
            icon="external"
            title={t('settings.privacy')}
            trailing="chevron"
            onPress={() => void Linking.openURL(appConfig.privacyPolicyUrl).catch(() => undefined)}
          />
          <ListRow
            testID="about-feedback"
            icon="sparkles"
            title={t('settings.feedback')}
            trailing="chevron"
            onPress={sendFeedback}
          />
        </ListSection>
        <ListSection title={t('about.thisApp')} footer={t('settings.disclaimer')}>
          <ListRow
            testID="about-version"
            icon="info"
            title={t('settings.version')}
            value={`${version} (${build})`}
          />
        </ListSection>
        <View style={styles.licenceSection}>
          <View style={styles.caption} accessible accessibilityRole="header">
            <Text variant="overline" color="textMuted">
              {t('about.licenses.title').toUpperCase()}
            </Text>
          </View>
          <Card style={styles.licences}>
            <View style={styles.licenceText} testID="about-licences">
              <Text variant="label">{t('about.licenses.cardTitle')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('about.licenses.phosphor')}
              </Text>
              <Text variant="caption" color="textSecondary">
                {t('about.licenses.mit')}
              </Text>
            </View>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.sectionGap },
  identity: { alignItems: 'center', gap: space[8] },
  licenceSection: { gap: space[8] },
  caption: { paddingHorizontal: space[16] },
  licences: { padding: space[16] },
  licenceText: { gap: space[8] },
});
