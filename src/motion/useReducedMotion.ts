import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the system asks for reduced motion (Android "Remove animations", iOS Reduce Motion).
 * Unlike Reanimated's hook this follows live changes, so a setting flipped while the app is open
 * takes effect at once. Every animation in the app reads this hook (Figma Motion: global rules).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && value) setReduced(true);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
