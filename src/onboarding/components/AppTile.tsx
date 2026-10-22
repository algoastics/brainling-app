import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { fonts, palette } from '@/theme';

/** Generic app tiles from the kit (`apptile`): brand colour + initials, never official logos. */
export const APP_TILES = {
  instagram: { bg: '#E1306C', label: 'IG' },
  youtube: { bg: '#FF0033', label: 'YT' },
  tiktok: { bg: '#111111', label: 'TT' },
  facebook: { bg: '#1877F2', label: 'FB' },
} as const;

export type AppTileKey = keyof typeof APP_TILES;

export const AppTile = memo(function AppTile({
  app,
  size = 40,
}: {
  app: AppTileKey;
  size?: number;
}) {
  const tile = APP_TILES[app];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: tile.bg },
      ]}
    >
      <Text style={[styles.label, { fontSize: size * 0.38, lineHeight: size * 0.46 }]}>
        {tile.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.display.bold, color: palette.white },
});
