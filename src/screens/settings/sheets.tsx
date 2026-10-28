import ThumbwellCore, { type BadgeDisplayTime, type DailyLimit } from 'thumbwell-core';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { LimitPicker } from '@/components/LimitPicker';
import { BottomSheet, Button, ListGroup, ListRow, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { classifyLimitChange } from '@/limit/limitRule';
import { DAY_START_OPTIONS, formatDayStart } from '@/lock/lockTime';
import { haptics } from '@/motion';
import { space, THEME_PREFERENCES, useThemePreference, type ThemePreference } from '@/theme';

type SheetProps = { visible: boolean; onClose: () => void };

type LimitSheetProps = SheetProps & {
  limit: DailyLimit;
  dayStartMinutes: number;
  /** Called after a successful save so the caller can re-read the native state. */
  onSaved: () => void;
};

/** Edit the daily limit: lowering applies at once, raising applies from the next day. */
export function LimitSheet({ visible, onClose, limit, dayStartMinutes, onSaved }: LimitSheetProps) {
  const t = useT();
  const [value, setValue] = useState(limit.effective);
  const [failed, setFailed] = useState(false);
  const change = classifyLimitChange(limit, value);
  const note =
    change === 'now'
      ? t('settings.limitDialog.lower')
      : change === 'next_day'
        ? t('settings.limitDialog.higher', { time: formatDayStart(dayStartMinutes) })
        : limit.pending !== null
          ? t('settings.limitDialog.pending', { count: limit.pending })
          : t('settings.limitDialog.same');

  const save = async () => {
    setFailed(false);
    try {
      await ThumbwellCore.setDailyLimit(value);
      onSaved();
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <BottomSheet
      testID="limit-sheet"
      visible={visible}
      onDismiss={onClose}
      title={t('settings.limitDialog.title')}
      body={t('limit.body')}
      actions={
        <>
          <Button label={t('common.save')} onPress={save} />
          <Button label={t('common.cancel')} onPress={onClose} kind="text" />
        </>
      }
    >
      <LimitPicker value={value} onChange={setValue} />
      <Text
        variant="caption"
        color={failed ? 'statusDangerStrong' : 'textMuted'}
        accessibilityLiveRegion="polite"
        testID="limit-note"
        style={styles.center}
      >
        {failed ? t('settings.limitDialog.error') : note}
      </Text>
    </BottomSheet>
  );
}

type DayStartSheetProps = SheetProps & { minutes: number; onSaved: () => void };

/** Pick when the logical day starts (default 04:00). */
export function DayStartSheet({ visible, onClose, minutes, onSaved }: DayStartSheetProps) {
  const t = useT();
  const [value, setValue] = useState(minutes);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setFailed(false);
    try {
      await ThumbwellCore.setDayStartMinutes(value);
      onSaved();
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <BottomSheet
      testID="day-start-sheet"
      visible={visible}
      onDismiss={onClose}
      title={t('settings.dayDialog.title')}
      body={t('settings.dayDialog.body')}
      actions={
        <>
          <Button label={t('common.save')} onPress={save} />
          <Button label={t('common.cancel')} onPress={onClose} kind="text" />
        </>
      }
    >
      <ListGroup>
        {DAY_START_OPTIONS.map((m) => (
          <ListRow
            key={m}
            testID={`day-start-${m}`}
            title={formatDayStart(m)}
            selectable
            checked={value === m}
            onPress={() => {
              haptics.selection();
              setValue(m);
            }}
          />
        ))}
      </ListGroup>
      {failed ? (
        <Text variant="caption" color="statusDangerStrong" accessibilityLiveRegion="polite">
          {t('settings.dayDialog.error')}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

export const BADGE_TIME_OPTIONS: readonly BadgeDisplayTime[] = ['1s', '2s', '3s', 'always'];

type BadgeTimeSheetProps = SheetProps & {
  value: BadgeDisplayTime;
  /** Saves the choice; rejects when it could not be saved. */
  onSave: (value: BadgeDisplayTime) => Promise<void>;
};

/** Pick how long the badge stays awake after a counted reel (1 s, 2 s, 3 s or Always). */
export function BadgeTimeSheet({ visible, onClose, value, onSave }: BadgeTimeSheetProps) {
  const t = useT();
  const [chosen, setChosen] = useState(value);
  const [failed, setFailed] = useState(false);

  const done = async () => {
    setFailed(false);
    try {
      await onSave(chosen);
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <BottomSheet
      testID="badge-time-sheet"
      visible={visible}
      onDismiss={onClose}
      title={t('settings.badgeDialog.title')}
      body={t('settings.badgeDialog.body')}
      actions={<Button label={t('settings.badgeDialog.done')} onPress={done} />}
    >
      <ListGroup>
        {BADGE_TIME_OPTIONS.map((option) => (
          <ListRow
            key={option}
            testID={`badge-time-${option}`}
            title={t(`settings.badgeDialog.option_${option}`)}
            selectable
            checked={chosen === option}
            onPress={() => {
              haptics.selection();
              setChosen(option);
            }}
          />
        ))}
      </ListGroup>
      <Text variant="caption" color="textMuted" style={styles.footer}>
        {t('settings.badgeDialog.default')}
      </Text>
      {failed ? (
        <Text variant="caption" color="statusDangerStrong" accessibilityLiveRegion="polite">
          {t('settings.badgeDialog.error')}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

/** Theme sheet (A61): the choice applies at once and persists, so there is no Done button. */
export function ThemeSheet({ visible, onClose }: SheetProps) {
  const t = useT();
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);

  const choose = (next: ThemePreference) => {
    if (next === preference) return;
    haptics.selection();
    setPreference(next);
  };

  return (
    <BottomSheet
      testID="theme-sheet"
      visible={visible}
      onDismiss={onClose}
      title={t('settings.theme.title')}
      body={t('settings.theme.body')}
    >
      <ListGroup>
        {THEME_PREFERENCES.map((option) => (
          <ListRow
            key={option}
            testID={`theme-${option}`}
            title={t(`settings.theme.${option}`)}
            selectable
            checked={preference === option}
            onPress={() => choose(option)}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  footer: { paddingHorizontal: space[16] },
});
