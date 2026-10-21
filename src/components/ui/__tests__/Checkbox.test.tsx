import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  it('exposes its checked state and toggles on press', async () => {
    const onChange = jest.fn();
    await render(<Checkbox label="I agree" value={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'I agree' });
    expect(box).not.toBeChecked();
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
