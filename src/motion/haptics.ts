import * as Haptics from 'expo-haptics';

/**
 * Haptics table (Figma Motion spec). Haptics are feedback, not motion, so they stay on under
 * reduced motion. A device without a haptic engine just ignores the call.
 */
function safely(run: () => Promise<void>): void {
  void run().catch(() => undefined);
}

export const haptics = {
  /** Primary button press-in (A50). */
  medium: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Secondary button, chip, stepper, tab press-in, slider ends (A50, A55, A57). */
  light: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Switch change, picker option, theme option, slider step (A56, A57, A60, A61). */
  selection: () => safely(() => Haptics.selectionAsync()),
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
} as const;
