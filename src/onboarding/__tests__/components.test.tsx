import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Confetti, Icon, OnboardingHeader, StepCard } from '../components';

describe('onboarding components', () => {
  it('renders the progress header with an accessible label and back button', async () => {
    const onBack = jest.fn();
    await render(<OnboardingHeader step={2} total={3} onBack={onBack} />);
    expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('labels numbered steps for TalkBack', async () => {
    await render(<StepCard index={2} text="Tap ⋮ (top right)" />);
    expect(screen.getByLabelText('2. Tap ⋮ (top right)')).toBeTruthy();
  });

  it('caps confetti at 60 particles', async () => {
    await render(<Confetti count={500} burst />);
    const tree = screen.toJSON();
    const root = Array.isArray(tree) ? tree[0] : tree;
    expect(root?.children?.length).toBe(60);
  });

  it('hides decorative icons from accessibility', async () => {
    await render(<Icon name="check" color="#000" />);
    expect(JSON.stringify(screen.toJSON())).toContain('no-hide-descendants');
  });
});
