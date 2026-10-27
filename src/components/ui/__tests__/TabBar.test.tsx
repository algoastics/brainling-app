import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TabBar } from '../TabBar';

const items = [
  {
    key: 'home',
    label: 'Home',
    icon: ({ focused }: { focused: boolean }) => (
      <Text>{focused ? 'home-filled' : 'home-outline'}</Text>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: ({ focused }: { focused: boolean }) => (
      <Text>{focused ? 'set-filled' : 'set-outline'}</Text>
    ),
  },
];

describe('TabBar', () => {
  it('marks the active tab selected and renders both icon variants for the cross-fade', async () => {
    await render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} />);
    expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Settings' })).not.toBeSelected();
    expect(screen.getByText('home-filled')).toBeTruthy();
    expect(screen.getByText('home-outline')).toBeTruthy();
  });

  it('selects an inactive tab and ignores a tap on the active one', async () => {
    const onSelect = jest.fn();
    await render(<TabBar items={items} activeKey="home" onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    expect(onSelect).toHaveBeenCalledWith('settings');
  });
});
