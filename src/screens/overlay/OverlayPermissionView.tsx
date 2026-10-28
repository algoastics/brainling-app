import { StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/mascot';
import {
  Button,
  Card,
  Icon,
  Screen,
  StatusChip,
  StepIndicator,
  Text,
  TopBar,
} from '@/components/ui';
import { useT } from '@/i18n';
import { ONBOARDING_STEPS, STEP_OVERLAY } from '@/onboarding/steps';
import { radius, sizes, space, useTheme } from '@/theme';

/** Where the screen is shown: the last onboarding step, or opened from the Settings row. */
export type OverlayVariant = 'onboarding' | 'settings';
/** ask = before the user went to Android, granted / notGranted = after the re-check. */
export type OverlayViewState = 'ask' | 'granted' | 'notGranted';

export type OverlayPermissionViewProps = {
  variant: OverlayVariant;
  state: OverlayViewState;
  /** The main button: open Android (ask, notGranted, settings) or continue (onboarding granted). */
  onPrimary: () => void;
  /** The second action: skip, how to turn it off, continue with the fallback, keep the fallback. */
  onSecondary?: () => void;
  /** Settings variant: the back arrow. */
  onBack?: () => void;
};

const DOES = ['does1', 'does2'] as const;
const NEVER = ['never1', 'never2'] as const;

/** The little Android "Display over other apps" row with its switch on (a picture). */
function AndroidPreview() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.preview,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault },
      ]}
    >
      <Text variant="overline" color="textMuted" style={styles.upper}>
        {t('overlay.ask.previewTitle')}
      </Text>
      <View style={[styles.previewRow, { backgroundColor: colors.bgPrimarySoft }]}>
        <View style={[styles.appTile, { backgroundColor: colors.bgSurface }]}>
          <Text variant="label" color="brandAccentText">
            T
          </Text>
        </View>
        <Text variant="body" style={styles.flex}>
          {t('overlay.ask.previewApp')}
        </Text>
        <View style={[styles.switchTrack, { backgroundColor: colors.brandPrimary }]}>
          <View style={styles.switchThumb} />
        </View>
      </View>
      <Text variant="caption" color="textSecondary">
        {t('overlay.ask.previewHint')}
      </Text>
    </View>
  );
}

function Ask({
  onPrimary,
  onSecondary,
}: Pick<OverlayPermissionViewProps, 'onPrimary' | 'onSecondary'>) {
  const t = useT();
  return (
    <>
      <View style={styles.top}>
        <Text variant="h1" accessibilityRole="header">
          {t('overlay.ask.title')}
        </Text>
        <Text variant="body" color="textSecondary">
          {t('overlay.ask.intro')}
        </Text>
        <View style={styles.checklist}>
          {DOES.map((key) => (
            <View key={key} style={styles.checkRow}>
              <Icon name="check" size={20} color="statusGoodText" />
              <Text variant="label" style={styles.flex}>
                {t(`overlay.ask.${key}`)}
              </Text>
            </View>
          ))}
          {NEVER.map((key) => (
            <View key={key} style={styles.checkRow}>
              <Icon name="close" size={20} color="statusDanger" />
              <Text variant="label" style={styles.flex}>
                {t(`overlay.ask.${key}`)}
              </Text>
            </View>
          ))}
        </View>
        <AndroidPreview />
      </View>
      <View style={styles.bottom}>
        <View style={styles.note}>
          <Icon name="info" size={20} color="brandAccentText" />
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            {t('overlay.ask.skipNote')}
          </Text>
        </View>
        <Button label={t('overlay.ask.open')} onPress={onPrimary} />
        {onSecondary ? (
          <Button kind="text" size="sm" label={t('overlay.ask.skip')} onPress={onSecondary} />
        ) : null}
      </View>
    </>
  );
}

type ResultCopy = {
  chip: string;
  title: string;
  body: string;
  cardTitle: string;
  cardBody: string;
  primary: string;
  secondary: string | null;
  hint: string | null;
};

function useResultCopy(variant: OverlayVariant, state: 'granted' | 'notGranted'): ResultCopy {
  const t = useT();
  const fromSettings = variant === 'settings';
  if (state === 'granted') {
    return {
      chip: t('overlay.granted.chip'),
      title: fromSettings ? t('overlay.settings.onTitle') : t('overlay.granted.title'),
      body: t('overlay.granted.body'),
      cardTitle: t('overlay.granted.cardTitle'),
      cardBody: t('overlay.granted.cardBody'),
      primary: fromSettings ? t('overlay.settings.openAndroid') : t('overlay.granted.continue'),
      secondary: fromSettings ? null : t('overlay.granted.howOff'),
      hint: fromSettings ? t('overlay.settings.offHint') : null,
    };
  }
  return {
    chip: t('overlay.off.chip'),
    title: fromSettings ? t('overlay.settings.offTitle') : t('overlay.off.title'),
    body: t('overlay.off.body'),
    cardTitle: t('overlay.off.cardTitle'),
    cardBody: t('overlay.off.cardBody'),
    primary: fromSettings ? t('overlay.ask.open') : t('overlay.off.tryAgain'),
    secondary: fromSettings ? t('overlay.settings.keep') : t('overlay.off.continue'),
    hint: null,
  };
}

function Result({
  variant,
  state,
  onPrimary,
  onSecondary,
}: OverlayPermissionViewProps & { state: 'granted' | 'notGranted' }) {
  const copy = useResultCopy(variant, state);
  const granted = state === 'granted';
  return (
    <>
      <View style={styles.top}>
        <View style={styles.center}>
          <Thumb pose={granted ? 'happy' : 'meh'} width={119} />
        </View>
        <View style={styles.center}>
          <StatusChip label={copy.chip} tone={granted ? 'good' : 'warn'} />
        </View>
        <Text
          variant="h1"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.centerText}
        >
          {copy.title}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          {copy.body}
        </Text>
        <Card tone="tint" style={styles.card}>
          <Text variant="h3">{copy.cardTitle}</Text>
          <Text variant="body" color="textSecondary">
            {copy.cardBody}
          </Text>
        </Card>
      </View>
      <View style={styles.bottom}>
        <Button label={copy.primary} onPress={onPrimary} />
        {copy.hint ? (
          <Text variant="caption" color="textSecondary" style={styles.centerText}>
            {copy.hint}
          </Text>
        ) : null}
        {copy.secondary && onSecondary ? (
          granted ? (
            <Button kind="text" size="sm" label={copy.secondary} onPress={onSecondary} />
          ) : (
            <Button kind="secondary" label={copy.secondary} onPress={onSecondary} />
          )
        ) : null}
      </View>
    </>
  );
}

const TEST_IDS: Record<OverlayViewState, string> = {
  ask: 'overlay-permission',
  granted: 'overlay-granted',
  notGranted: 'overlay-still-off',
};

/**
 * "Display over other apps" (Figma S11-P0): the ask, granted and not-granted states, for the last
 * onboarding step (4 of 4, step indicator + lock tile) and for the screen opened from Settings
 * (back bar, no steps). Presentational only; the screens around it own the permission check.
 */
export function OverlayPermissionView(props: OverlayPermissionViewProps) {
  const { variant, state, onBack } = props;
  const t = useT();
  const { colors } = useTheme();
  const settings = variant === 'settings';
  const testID = settings ? 'overlay-settings' : TEST_IDS[state];
  return (
    <Screen
      spread
      testID={testID}
      header={
        settings ? <TopBar title={t('overlay.settings.screenTitle')} onBack={onBack} /> : undefined
      }
    >
      {!settings ? (
        <View style={styles.header}>
          <StepIndicator current={STEP_OVERLAY} total={ONBOARDING_STEPS} />
          <View style={[styles.tile, { backgroundColor: colors.bgPrimarySoft }]}>
            <Icon name="lock" size={24} color="brandAccentText" />
          </View>
        </View>
      ) : null}
      {state === 'ask' ? (
        <Ask onPrimary={props.onPrimary} onSecondary={props.onSecondary} />
      ) : (
        <Result {...props} state={state} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[16] },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { gap: space[12] },
  bottom: { gap: space[12] },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  card: { gap: space[8] },
  checklist: { gap: space[8] },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space[8] },
  upper: { textTransform: 'uppercase' },
  preview: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space[12],
    gap: space[8],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderRadius: radius.sm,
  },
  appTile: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTrack: {
    width: sizes.switchWidth,
    height: sizes.switchHeight,
    borderRadius: sizes.switchHeight / 2,
    padding: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  switchThumb: {
    width: sizes.switchThumb,
    height: sizes.switchThumb,
    borderRadius: sizes.switchThumb / 2,
    backgroundColor: '#FFFFFF',
  },
});
