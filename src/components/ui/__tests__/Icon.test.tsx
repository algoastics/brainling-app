import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { Icon, iconSet, TINTED_ICONS, type IconName } from '../Icon';

const names = Object.keys(iconSet) as IconName[];

describe('Icon', () => {
  it('has the 22 pebble glyphs plus the legacy settings/sliders alias', () => {
    const glyphs = new Set(Object.values(iconSet));
    expect(glyphs.size).toBe(22);
    expect(names).toContain('settings');
  });

  it.each(names)('renders %s in outline and filled state', async (name) => {
    await render(<Icon name={name} size={24} />);
    expect(screen.toJSON()).not.toBeNull();
    await screen.rerender(<Icon name={name} size={24} filled />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('lists only real icons as tinted, 15 distinct glyphs plus the sliders alias', () => {
    expect(TINTED_ICONS.every((name) => name in iconSet)).toBe(true);
    expect(new Set(TINTED_ICONS.map((name) => iconSet[name])).size).toBe(15);
  });
});
