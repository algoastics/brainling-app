import {
  Fredoka_400Regular,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';

/** Font files keyed by the family names used in `fonts` / `typography`. */
export const fontAssets = {
  Fredoka_400Regular,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  JetBrainsMono_500Medium,
};

/** Returns `[loaded, error]`; the app keeps the splash screen up until fonts settle. */
export function useBrainlingFonts(): [boolean, Error | null] {
  return useFonts(fontAssets);
}
