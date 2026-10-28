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

  it('pads below only by the real bottom inset, with no extra margin', async () => {
    await render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} bottomInset={0} />);
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 0 });
    await render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} bottomInset={24} />);
    expect(screen.getAllByTestId('tab-bar').at(-1)).toHaveStyle({ paddingBottom: 24 });
  });

  it('is a flush 88 dp bar with 20 dp top corners and a top border', async () => {
    await render(<TabBar items={items} activeKey="home" onSelect={jest.fn()} />);
    expect(screen.getByTestId('tab-bar')).toHaveStyle({
      minHeight: 88,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
    });
  });

  it('tells only the selected tab that its icon is active', async () => {
    const icon = jest.fn(({ focused }: { focused: boolean; active: boolean }) => (
      <Text>{String(focused)}</Text>
    ));
    await render(
      <TabBar
        items={[
          { key: 'a', label: 'A', icon },
          { key: 'b', label: 'B', icon },
        ]}
        activeKey="b"
        onSelect={jest.fn()}
      />,
    );
    const activeCalls = icon.mock.calls.filter(([p]) => p.active);
    expect(activeCalls).toHaveLength(1);
  });
});
