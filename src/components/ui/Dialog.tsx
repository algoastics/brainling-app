import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { primitives, radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';
import type { Action } from './types';

export type DialogProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  body?: string;
  /** Extra content between the body and the actions (pickers, notes). */
  children?: ReactNode;
  actions: readonly Action[];
};

/** Dialog (radius 32). Android back dismisses via `onDismiss`. */
export function Dialog({ visible, onDismiss, title, body, children, actions }: DialogProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <View
          style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: primitives.plum900 }]}
        />
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: colors.bgSurface }]}
        >
          <Text variant="h2" accessibilityRole="header" style={styles.center}>
            {title}
          </Text>
          {body ? (
            <Text color="textSecondary" style={styles.center}>
              {body}
            </Text>
          ) : null}
          {children}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button key={a.label} label={a.label} onPress={a.onPress} kind={a.kind} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space[24] },
  scrim: { opacity: 0.5 },
  dialog: { borderRadius: radius.dialog, padding: space[24], gap: space[16] },
  center: { textAlign: 'center' },
  actions: { gap: space[12], marginTop: space[8] },
});
