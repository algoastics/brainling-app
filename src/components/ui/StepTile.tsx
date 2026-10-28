import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/**
 * The 40 dp tile at the right edge of an onboarding step (Figma "Shield tile": soft violet, radius
 * 16, 24 dp icon). It is content below the persistent step header: Figma leaves 8 dp between the
 * two, while the header's bottom padding and the screen's top padding already leave 16.
 */
export function StepTile({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.bgPrimarySoft }]}>
      <Icon name={icon} size={24} color="brandAccentText" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignSelf: 'flex-end',
    marginTop: -space[8],
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
