import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme } from '../ThemeProvider';
import { useThemePreference } from '../themePreference';
import { darkColors, lightColors } from '../tokens';

function Probe() {
  const { scheme, colors } = useTheme();
  return <Text testID="probe">{`${scheme}:${colors.bgScreen}`}</Text>;
}

beforeEach(() => {
  useThemePreference.setState({ preference: 'system' });
});

describe('ThemeProvider live apply (A61)', () => {
  it('draws the system scheme first (light when the phone gives none)', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(`light:${lightColors.bgScreen}`);
  });

  it('switches to the picked scheme without a restart and lands on its colours', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await act(async () => useThemePreference.getState().setPreference('dark'));
    expect(screen.getByTestId('probe')).toHaveTextContent(/^dark:/);
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${darkColors.bgScreen}`),
    );
    await act(async () => useThemePreference.getState().setPreference('light'));
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent(`light:${lightColors.bgScreen}`),
    );
  });

  it('lets a forced scheme override the preference', async () => {
    useThemePreference.setState({ preference: 'light' });
    await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${darkColors.bgScreen}`);
  });
});
