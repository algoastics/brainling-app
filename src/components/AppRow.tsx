import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space, useTheme } from '@/theme';

export type AppRowProps = {
  name: string;
  /** Second line, e.g. "Reels today". */
  detail: string;
  count: number;
  /** Base64 PNG launcher icon read from the installed app; `null` or `undefined` = no icon. */
  icon: string | null | undefined;
  testID?: string;
};

/**
 * Per-app row on Home (Figma S14): 48dp icon tile, name and unit, today's count. The icon is the
 * installed app's own launcher icon; with none, a neutral tile with the app's initial is drawn.
 * No third-party logo is bundled.
 */
export function AppRow({ name, detail, count, icon, testID }: AppRowProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${name}, ${detail}, ${count}`}
      style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.borderDefault }]}
    >
      {icon ? (
        <Image
          testID={testID ? `${testID}-icon` : undefined}
          source={{ uri: `data:image/png;base64,${icon}` }}
          style={styles.icon}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          testID={testID ? `${testID}-tile` : undefined}
          style={[
            styles.icon,
            styles.tile,
            { backgroundColor: colors.bgSurface2, borderColor: colors.borderStrong },
          ]}
        >
          <Text variant="h3" color="textMuted">
            {name.slice(0, 1)}
          </Text>
        </View>
      )}
      <View style={styles.text}>
        <Text variant="label">{name}</Text>
        <Text variant="caption" color="textMuted">
          {detail}
        </Text>
      </View>
      <Text variant="h1" color="statusGoodText">
        {String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[16],
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
  },
  icon: { width: 48, height: 48, borderRadius: radius.sm },
  tile: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space[2] },
});
