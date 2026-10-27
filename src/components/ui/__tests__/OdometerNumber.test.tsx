import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { OdometerNumber } from '../OdometerNumber';

describe('OdometerNumber', () => {
  it('shows the value as one accessible number with its caption', async () => {
    await render(<OdometerNumber testID="odo" value={60} label="reels per day" />);
    expect(screen.getByTestId('odo')).toHaveAccessibilityValue({ text: '60' });
    expect(screen.getByLabelText('60 reels per day')).toBeTruthy();
    expect(screen.getByText('reels per day')).toBeTruthy();
  });

  it('follows a changed value and adds a slot when the number gains a digit', async () => {
    const view = await render(<OdometerNumber testID="odo" value={99} />);
    await view.rerender(<OdometerNumber testID="odo" value={100} />);
    expect(screen.getByTestId('odo')).toHaveAccessibilityValue({ text: '100' });
    // Digits are hidden from screen readers; the wrapper carries the value.
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeTruthy();
  });
});
