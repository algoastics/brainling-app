import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';

/** Font files keyed by the family names used in `fonts` / `type`. Nunito: headings and numbers; Inter: text. */
export const fontAssets = {
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};

/** Returns `[loaded, error]`; the app keeps the splash screen up until fonts settle. */
export function useThumbwellFonts(): [boolean, Error | null] {
  return useFonts(fontAssets);
}
