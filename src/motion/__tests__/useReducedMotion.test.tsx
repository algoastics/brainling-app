import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../useReducedMotion';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useReducedMotion', () => {
  it('starts false and turns true when the system asks for reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('follows the setting while the app is open', async () => {
    let listener: ((value: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (value: boolean) => void,
    ) => {
      listener = handler;
      return { remove };
    }) as never);
    const { result, unmount } = await renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    await act(async () => listener?.(true));
    expect(result.current).toBe(true);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
