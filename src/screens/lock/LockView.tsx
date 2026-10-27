import { StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/mascot';
import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { radius, space, useTheme } from '@/theme';

export type LockViewProps = {
  /** The budget the user hit. */
  limit: number;
  /** `HH:MM` the lock lifts (see `lockedUntilLabel`). */
  until: string;
  /** Reels counted today. */
  today: number;
  onLeave: () => void;
};

/** S22-P0 lock overlay copy and layout. The real overlay is native (M4); this is the JS preview. */
export function LockView({ limit, until, today, onLeave }: LockViewProps) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View testID="lock-view" style={[styles.root, { backgroundColor: colors.bgScreen }]}>
      <View style={styles.body}>
        <Thumb pose="fried" width={216} />
        <View style={[styles.chip, { backgroundColor: colors.bgPrimarySoft }]}>
          <Text variant="label" color="brandAccentText">
            {t('lock.chip')}
          </Text>
        </View>
        <Text variant="h1" accessibilityRole="header" style={styles.center}>
          {t('lock.title', { count: limit })}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          {t('lock.body', { time: until })}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button label={t('lock.leave')} onPress={onLeave} />
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('lock.today', { count: today })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space[24], paddingVertical: space[32] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[16] },
  chip: { borderRadius: radius.pill, paddingHorizontal: space[16], paddingVertical: space[4] },
  center: { textAlign: 'center' },
  footer: { gap: space[12] },
});
