import { router } from 'expo-router';

import { Button, Screen, Text } from '@/components/ui';

export default function MeScreen() {
  return (
    <Screen>
      <Text variant="heading.h1" accessibilityRole="header">
        Me
      </Text>
      {__DEV__ ? (
        <Button
          kind="secondary"
          label="Design system"
          onPress={() => router.push('/design-system')}
        />
      ) : null}
    </Screen>
  );
}
