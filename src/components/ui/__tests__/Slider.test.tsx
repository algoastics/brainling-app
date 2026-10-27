import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Slider } from '../Slider';

const base = {
  min: 10,
  max: 200,
  step: 10,
  accessibilityLabel: 'Daily limit',
  testID: 'slider',
} as const;

describe('Slider', () => {
  it('exposes the snapped value to assistive tech', async () => {
    await render(<Slider {...base} value={64} onChange={jest.fn()} />);
    const node = screen.getByTestId('slider');
    expect(node.props.accessibilityValue).toEqual({ min: 10, max: 200, now: 60 });
    expect(node.props.accessibilityRole).toBe('adjustable');
  });

  it('steps with the accessibility actions and stays inside the range', async () => {
    const onChange = jest.fn();
    await render(<Slider {...base} value={200} onChange={onChange} />);
    const node = screen.getByTestId('slider');
    await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(200);
    await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(190);
  });
});
