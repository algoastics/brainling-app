import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Checkbox, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { Icon, MascotProp, OnboardingLayout, Title } from '@/onboarding/components';
import {
  DISCLOSURE_PARAGRAPHS,
  DISCLOSURE_POINTS,
  disclosureParagraphKey,
  disclosurePointKey,
} from '@/onboarding/disclosure';
import { routeAfterDisclosure } from '@/onboarding/flow';
import { useOnboardingStore } from '@/onboarding/store';
import { useAppStore } from '@/state/appStore';
import { radius, space, useTheme } from '@/theme';

const Point = memo(function Point({ text, ok }: { text: string; ok: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point} accessible accessibilityLabel={text}>
      <View style={[styles.pointIcon, { backgroundColor: ok ? colors.goodSoft : colors.badSoft }]}>
        <Icon
          name={ok ? 'check' : 'close'}
          size={16}
          color={ok ? colors.good : colors.bad}
          strokeWidth={3}
        />
      </View>
      <Text variant="body.md" style={styles.pointText}>
        {text}
      </Text>
    </View>
  );
});

/**
 * S06 / S06-agreed — Play prominent disclosure for the AccessibilityService. Standalone screen in
 * the normal flow, separate from the privacy policy, with an affirmative checkbox + button. It is
 * the only way into S07-restricted / S07, the screens that deep-link to system settings.
 */
export default function DisclosureScreen() {
  const t = useT();
  const { colors } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const acceptDisclosure = useOnboardingStore((s) => s.acceptDisclosure);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const agree = useCallback(() => {
    acceptDisclosure(Date.now());
    router.push(routeAfterDisclosure(Platform.OS, Platform.Version));
  }, [acceptDisclosure]);

  return (
    <OnboardingLayout
      footer={
        <>
          <Button
            label={t('onboarding.disclosure.agree')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            disabled={!agreed}
            accessibilityHint={agreed ? undefined : t('onboarding.disclosure.agreeHint')}
            onPress={agree}
          />
          <Button
            kind="text"
            label={t('onboarding.disclosure.notNow')}
            onPress={completeOnboarding}
          />
        </>
      }
    >
      <View style={styles.head}>
        <Title style={styles.title}>{t('onboarding.disclosure.title')}</Title>
        <View style={styles.mascot} importantForAccessibility="no-hide-descendants">
          <Mascot state="happy" size={84} />
          <View style={styles.shield}>
            <MascotProp kind="shield" size={26} />
          </View>
        </View>
      </View>
      <View style={styles.points}>
        {DISCLOSURE_POINTS.map((p) => (
          <Point key={p.key} ok={p.ok} text={t(disclosurePointKey(p.key))} />
        ))}
      </View>
      <View style={[styles.legal, { backgroundColor: colors.surface2 }]}>
        {DISCLOSURE_PARAGRAPHS.map((k) => (
          <Text key={k} variant="body.sm" color="ink2" style={styles.legalText}>
            {t(disclosureParagraphKey(k))}
          </Text>
        ))}
      </View>
      <View style={styles.agree}>
        <Checkbox value={agreed} onChange={setAgreed} label={t('onboarding.disclosure.consent')} />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space[24] },
  title: { flex: 1 },
  mascot: { width: 84, marginLeft: space[8] },
  shield: { position: 'absolute', right: -2, bottom: 10 },
  points: { gap: space[12], marginTop: space[20] },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
  pointIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, paddingTop: 2 },
  legal: { borderRadius: radius.lg, padding: space[16], gap: space[8], marginTop: space[24] },
  legalText: { fontSize: 12.5, lineHeight: 17 },
  agree: { marginTop: space[16] },
});
