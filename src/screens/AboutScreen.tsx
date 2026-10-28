import * as Application from 'expo-application';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/mascot';
import { Wordmark } from '@/components/Wordmark';
import { Card, ListGroup, ListRow, Screen, ScreenGroup, Text, TopBar } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { useT } from '@/i18n';
import { space } from '@/theme';

/** S43-about: version, the privacy policy link, open-source licences and the trademark disclaimer. */
export function AboutScreen() {
  const t = useT();
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';
  return (
    <Screen
      spread
      testID="about"
      header={<TopBar title={t('about.title')} onBack={() => router.back()} />}
    >
      <ScreenGroup>
        <View style={styles.hero}>
          <Thumb pose="happy" width={168} />
          <Wordmark size={36} />
          <Text variant="caption" color="textMuted" testID="about-version">
            {t('about.version', { version, build })}
          </Text>
        </View>
        <ListGroup>
          <ListRow
            testID="about-privacy"
            title={t('settings.privacy')}
            trailing="external"
            onPress={() => void Linking.openURL(appConfig.privacyPolicyUrl).catch(() => undefined)}
          />
        </ListGroup>
        <Card>
          <View style={styles.licences} testID="about-licences">
            <Text variant="body" accessibilityRole="header">
              {t('about.licenses.title')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('about.licenses.phosphor')}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('about.licenses.mit')}
            </Text>
          </View>
        </Card>
      </ScreenGroup>
      <Text variant="caption" color="textMuted" style={styles.disclaimer} testID="about-disclaimer">
        {t('settings.disclaimer')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space[8], paddingVertical: space[8] },
  licences: { gap: space[8] },
  disclaimer: { textAlign: 'center', paddingHorizontal: space[8] },
});
