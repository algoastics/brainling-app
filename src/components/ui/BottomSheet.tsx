import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';
import type { Action } from './types';

export type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  body?: string;
  actions?: readonly Action[];
  children?: ReactNode;
  dismissLabel?: string;
};

/** C10 — BottomSheet (radius 28) over the scrim token; tapping the scrim dismisses. */
export function BottomSheet({
  visible,
  onDismiss,
  title,
  body,
  actions = [],
  children,
  dismissLabel,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel ?? t('common.close')}
          onPress={onDismiss}
          style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: colors.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + space[24] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.line }]} />
          <Text variant="heading.h2" accessibilityRole="header">
            {title}
          </Text>
          {body ? <Text color="ink2">{body}</Text> : null}
          {children}
          {actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((a) => (
                <Button key={a.label} label={a.label} onPress={a.onPress} kind={a.kind} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { opacity: 0.5 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space[24],
    paddingTop: space[12],
    gap: space[16],
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill },
  actions: { gap: space[12], marginTop: space[8] },
});
