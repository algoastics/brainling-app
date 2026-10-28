import ThumbwellCore from 'thumbwell-core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Checkbox, Icon, Screen, ScreenGroup, StepTile, Text } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { DISCLOSURE_VERSION } from '@/consent/version';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/appStore';
import { radius, space, useTheme } from '@/theme';

const POINTS = [
  { key: 'pointCount', icon: 'check', color: 'statusGoodText' },
  { key: 'pointLock', icon: 'check', color: 'statusGoodText' },
  { key: 'pointPrivacy', icon: 'close', color: 'statusDangerStrong' },
] as const;
const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4'] as const;

/**
 * S06 Accessibility disclosure (step 3 of 4 during onboarding). Shown before EVERY deep link to
 * the system Accessibility settings, including the Home banner and the watchdog re-enable link.
 * "Agree & continue" stays disabled until the box is ticked, then logs consent natively.
 */
export function DisclosureScreen() {
  const t = useT();
  const { colors } = useTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === undefined || from === 'onboarding';
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const agree = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await ThumbwellCore.setConsent(DISCLOSURE_VERSION);
      router.replace('/guide');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    if (onboarding) {
      completeOnboarding();
      router.replace('/(tabs)');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const openPrivacy = () => void Linking.openURL(appConfig.privacyPolicyUrl).catch(() => undefined);

  return (
    <Screen spread edges={['bottom']} testID="disclosure">
      <ScreenGroup gap={space[12]}>
        <StepTile icon="shield" />
        <Text variant="h1" accessibilityRole="header">
          {t('disclosure.title')}
        </Text>
        <View style={styles.points}>
          {POINTS.map(({ key, icon, color }) => (
            <View key={key} style={styles.point}>
              <Icon name={icon} size={20} color={color} />
              <Text variant="label" style={styles.pointText}>
                {t(`disclosure.${key}`)}
              </Text>
            </View>
          ))}
        </View>
        <View
          style={[styles.box, { backgroundColor: colors.bgSurface2 }]}
          accessibilityLabel={t('disclosure.title')}
        >
          <ScrollView nestedScrollEnabled testID="disclosure-text" persistentScrollbar>
            {PARAGRAPHS.map((key) => (
              <Text key={key} variant="caption" style={styles.paragraph}>
                {t(`disclosure.${key}`)}
              </Text>
            ))}
          </ScrollView>
        </View>
        <Text variant="caption" color="textMuted">
          {t('disclosure.scrollHint')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('disclosure.disclaimer')}
        </Text>
      </ScreenGroup>
      <ScreenGroup gap={space[12]}>
        <Checkbox
          testID="disclosure-check"
          value={checked}
          onChange={setChecked}
          label={t('disclosure.check')}
        />
        {failed ? (
          <Text variant="label" color="statusDangerStrong" accessibilityLiveRegion="polite">
            {t('disclosure.saveError')}
          </Text>
        ) : null}
        <Button label={t('disclosure.agree')} onPress={agree} disabled={!checked} loading={busy} />
        <View style={styles.links}>
          <Button
            kind="text"
            size="sm"
            label={t('disclosure.notNow')}
            onPress={notNow}
            style={styles.link}
          />
          <Button
            kind="text"
            size="sm"
            label={t('disclosure.privacy')}
            onPress={openPrivacy}
            style={styles.link}
          />
        </View>
      </ScreenGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  points: { gap: space[8] },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
  pointText: { flex: 1 },
  box: {
    height: 128,
    borderRadius: radius.md,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
  },
  paragraph: { marginBottom: space[16] },
  links: { flexDirection: 'row', gap: space[8] },
  link: { flex: 1 },
});
