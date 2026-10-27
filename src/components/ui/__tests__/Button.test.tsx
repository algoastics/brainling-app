import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { Chip } from '../Chip';

const mockImpact = jest.fn<(style: string) => Promise<void>>(async () => undefined);
jest.mock('expo-haptics', () => ({
  impactAsync: (style: string) => mockImpact(style),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

describe('Button', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports busy and hides the label while loading', async () => {
    await render(<Button label="Save" onPress={jest.fn()} loading />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeBusy();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('fires a Medium haptic on press-in of the primary button and Light on secondary', async () => {
    mockImpact.mockClear();
    await render(
      <>
        <Button label="Go" onPress={jest.fn()} />
        <Button label="Later" kind="secondary" onPress={jest.fn()} />
      </>,
    );
    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');
    expect(mockImpact).toHaveBeenLastCalledWith('medium');
    await fireEvent(screen.getByRole('button', { name: 'Later' }), 'pressIn');
    expect(mockImpact).toHaveBeenLastCalledWith('light');
  });

  it('gives no haptic for a disabled button', async () => {
    mockImpact.mockClear();
    await render(<Button label="Go" disabled onPress={jest.fn()} />);
    await fireEvent(screen.getByRole('button', { name: 'Go' }), 'pressIn');
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('fires a Light haptic on chip press-in and still selects on press', async () => {
    mockImpact.mockClear();
    const onPress = jest.fn();
    await render(<Chip label="50" selected={false} onPress={onPress} testID="chip" />);
    await fireEvent(screen.getByTestId('chip'), 'pressIn');
    expect(mockImpact).toHaveBeenLastCalledWith('light');
    await fireEvent.press(screen.getByTestId('chip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
