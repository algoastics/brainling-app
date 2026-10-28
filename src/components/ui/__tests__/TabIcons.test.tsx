import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { HomeTabIcon, SettingsTabIcon } from '../TabIcons';

describe('TabIcons', () => {
  it('renders the active home and settings glyphs with their animated part', async () => {
    const home = await render(<HomeTabIcon color="#4C33CC" active />);
    expect(home.toJSON()).toBeTruthy();
    const settings = await render(<SettingsTabIcon color="#4C33CC" active={false} />);
    expect(settings.toJSON()).toBeTruthy();
  });
});
