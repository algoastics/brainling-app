import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

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
});
