import ThumbwellCore, { type BadgeDisplayTime, type DailyLimit } from 'thumbwell-core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LimitPicker } from '@/components/LimitPicker';
import { Chip, Dialog, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { classifyLimitChange } from '@/limit/limitRule';
import { DAY_START_OPTIONS, formatDayStart } from '@/lock/lockTime';
import { space } from '@/theme';

type LimitDialogProps = {
  limit: DailyLimit;
  dayStartMinutes: number;
  onClose: () => void;
  /** Called after a successful save so the caller can re-read the native state. */
  onSaved: () => void;
};

/** Edit the daily limit: lowering applies at once, raising applies from the next day. */
export function LimitDialog({ limit, dayStartMinutes, onClose, onSaved }: LimitDialogProps) {
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
    <Dialog
      visible
      onDismiss={onClose}
      title={t('settings.limitDialog.title')}
      actions={[
        { label: t('common.save'), onPress: save, kind: 'primary' },
        { label: t('common.cancel'), onPress: onClose, kind: 'text' },
      ]}
    >
      <LimitPicker value={value} onChange={setValue} />
      <Text
        variant="caption"
        color={failed ? 'statusDangerStrong' : 'textMuted'}
        accessibilityLiveRegion="polite"
        testID="limit-note"
        style={styles.note}
      >
        {failed ? t('settings.limitDialog.error') : note}
      </Text>
    </Dialog>
  );
}

type DayStartDialogProps = { minutes: number; onClose: () => void; onSaved: () => void };

/** Pick when the logical day starts (default 04:00). */
export function DayStartDialog({ minutes, onClose, onSaved }: DayStartDialogProps) {
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
    <Dialog
      visible
      onDismiss={onClose}
      title={t('settings.dayDialog.title')}
      body={t('settings.dayDialog.body')}
      actions={[
        { label: t('common.save'), onPress: save, kind: 'primary' },
        { label: t('common.cancel'), onPress: onClose, kind: 'text' },
      ]}
    >
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {DAY_START_OPTIONS.map((m) => (
          <Chip
            key={m}
            testID={`day-start-${m}`}
            label={formatDayStart(m)}
            selected={value === m}
            onPress={() => setValue(m)}
          />
        ))}
      </View>
      {failed ? (
        <Text variant="caption" color="statusDangerStrong" accessibilityLiveRegion="polite">
          {t('settings.dayDialog.error')}
        </Text>
      ) : null}
    </Dialog>
  );
}

export const BADGE_TIME_OPTIONS: readonly BadgeDisplayTime[] = ['1s', '2s', '3s', 'always'];

type BadgeTimeDialogProps = {
  value: BadgeDisplayTime;
  /** Saves the choice; rejects when it could not be saved. */
  onSave: (value: BadgeDisplayTime) => Promise<void>;
  onClose: () => void;
};

/** Pick how long the badge stays awake after a counted reel (1 s, 2 s, 3 s or Always). */
export function BadgeTimeDialog({ value, onSave, onClose }: BadgeTimeDialogProps) {
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
    <Dialog
      visible
      onDismiss={onClose}
      title={t('settings.badgeDialog.title')}
      body={t('settings.badgeDialog.body')}
      actions={[{ label: t('settings.badgeDialog.done'), onPress: done, kind: 'primary' }]}
    >
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {BADGE_TIME_OPTIONS.map((option) => (
          <Chip
            key={option}
            testID={`badge-time-${option}`}
            label={t(`settings.badge.timeValue_${option}`)}
            selected={chosen === option}
            onPress={() => setChosen(option)}
          />
        ))}
      </View>
      {failed ? (
        <Text variant="caption" color="statusDangerStrong" accessibilityLiveRegion="polite">
          {t('settings.badgeDialog.error')}
        </Text>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  note: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], justifyContent: 'center' },
});
