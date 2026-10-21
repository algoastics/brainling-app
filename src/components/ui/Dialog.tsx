import { Modal, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';
import type { Action } from './types';

export type DialogProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  body?: string;
  actions: readonly Action[];
};

/** C10 — Dialog (radius 32). Android back dismisses via `onDismiss`. */
export function Dialog({ visible, onDismiss, title, body, actions }: DialogProps) {
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
        <View style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: colors.scrim }]} />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Text variant="heading.h2" accessibilityRole="header" style={styles.center}>
            {title}
          </Text>
          {body ? (
            <Text color="ink2" style={styles.center}>
              {body}
            </Text>
          ) : null}
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
