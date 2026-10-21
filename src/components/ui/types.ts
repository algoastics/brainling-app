import type { ButtonKind } from './Button';

export type Action = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
};
