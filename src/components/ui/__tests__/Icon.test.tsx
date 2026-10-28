import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { Icon, iconSet, type IconName } from '../Icon';

const names = Object.keys(iconSet) as IconName[];

describe('Icon (Phosphor)', () => {
  it('maps the 23 names onto 22 distinct Phosphor glyphs (settings aliases sliders)', () => {
    expect(names).toHaveLength(23);
    expect(new Set(Object.values(iconSet)).size).toBe(22);
    expect(iconSet.settings).toBe(iconSet.sliders);
  });

  it.each(names)('renders %s in Regular, Fill and bold weights', async (name) => {
    await render(<Icon name={name} size={24} />);
    expect(screen.toJSON()).not.toBeNull();
    await screen.rerender(<Icon name={name} size={24} filled />);
    expect(screen.toJSON()).not.toBeNull();
    await screen.rerender(<Icon name={name} size={16} bold />);
    expect(screen.toJSON()).not.toBeNull();
  });
});
