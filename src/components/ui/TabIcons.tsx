import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/motion';
import { motion } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Figma A98: the named part of an active tab icon animates in 220 ms, ease-out. */
const PART_EASE = Easing.out(Easing.cubic);

/** 0 = "Active · part start", 1 = "Active"; drops back to 0 (unseen) when the tab is left. */
function usePartProgress(active: boolean) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active || reduced) {
      progress.set(active ? 1 : 0);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: motion.duration.tabPart, easing: PART_EASE }));
  }, [active, reduced, progress]);
  return progress;
}

type TabIconProps = {
  color: string;
  /** True while this tab is the selected one; starts the part animation. */
  active: boolean;
};

/* Glyph and part paths are the Figma "Tab icon/home" and "Tab icon/settings" Active layers
   (Phosphor Fill geometry, plus the chimney that Phosphor's House Fill does not have). */
const HOME_GLYPH =
  'M21 11.25V20.25C21 20.4489 20.921 20.6397 20.7803 20.7803C20.6397 20.921 20.4489 21 20.25 21H15C14.8011 21 14.6103 20.921 14.4697 20.7803C14.329 20.6397 14.25 20.4489 14.25 20.25V15.375C14.25 15.2755 14.2105 15.1802 14.1402 15.1098C14.0698 15.0395 13.9745 15 13.875 15H10.125C10.0255 15 9.93016 15.0395 9.85983 15.1098C9.78951 15.1802 9.75 15.2755 9.75 15.375V20.25C9.75 20.4489 9.67098 20.6397 9.53033 20.7803C9.38968 20.921 9.19891 21 9 21H3.75C3.55109 21 3.36032 20.921 3.21967 20.7803C3.07902 20.6397 3 20.4489 3 20.25V11.25C3.00018 10.8522 3.15834 10.4709 3.43969 10.1897L10.9397 2.68969C11.221 2.4086 11.6023 2.2507 12 2.2507C12.3977 2.2507 12.779 2.4086 13.0603 2.68969L20.5603 10.1897C20.8417 10.4709 20.9998 10.8522 21 11.25Z';
const HOME_CHIMNEY =
  'M15.75 3.75C15.75 3.65054 15.7895 3.55516 15.8598 3.48484C15.9302 3.41451 16.0255 3.375 16.125 3.375H17.625C17.7245 3.375 17.8198 3.41451 17.8902 3.48484C17.9605 3.55516 18 3.65054 18 3.75V7.875H15.75V3.75Z';
const SETTINGS_GLYPH =
  'M3.75 6.75H20.25C20.4489 6.75 20.6397 6.82902 20.7803 6.96967C20.921 7.11032 21 7.30109 21 7.5C21 7.69891 20.921 7.88968 20.7803 8.03033C20.6397 8.17098 20.4489 8.25 20.25 8.25H3.75C3.55109 8.25 3.36032 8.17098 3.21967 8.03033C3.07902 7.88968 3 7.69891 3 7.5C3 7.30109 3.07902 7.11032 3.21967 6.96967C3.36032 6.82902 3.55109 6.75 3.75 6.75ZM3.75 15.75H20.25C20.4489 15.75 20.6397 15.829 20.7803 15.9697C20.921 16.1103 21 16.3011 21 16.5C21 16.6989 20.921 16.8897 20.7803 17.0303C20.6397 17.171 20.4489 17.25 20.25 17.25H3.75C3.55109 17.25 3.36032 17.171 3.21967 17.0303C3.07902 16.8897 3 16.6989 3 16.5C3 16.3011 3.07902 16.1103 3.21967 15.9697C3.36032 15.829 3.55109 15.75 3.75 15.75ZM7.125 7.5C7.125 6.80381 7.40156 6.13613 7.89384 5.64384C8.38613 5.15156 9.05381 4.875 9.75 4.875C10.4462 4.875 11.1139 5.15156 11.6062 5.64384C12.0984 6.13613 12.375 6.80381 12.375 7.5C12.375 8.19619 12.0984 8.86387 11.6062 9.35616C11.1139 9.84844 10.4462 10.125 9.75 10.125C9.05381 10.125 8.38613 9.84844 7.89384 9.35616C7.40156 8.86387 7.125 8.19619 7.125 7.5Z';
const SETTINGS_KNOB =
  'M13.125 16.5C13.125 15.8038 13.4016 15.1361 13.8938 14.6438C14.3861 14.1516 15.0538 13.875 15.75 13.875C16.4462 13.875 17.1139 14.1516 17.6062 14.6438C18.0984 15.1361 18.375 15.8038 18.375 16.5C18.375 17.1962 18.0984 17.8639 17.6062 18.3562C17.1139 18.8484 16.4462 19.125 15.75 19.125C15.0538 19.125 14.3861 18.8484 13.8938 18.3562C13.4016 17.8639 13.125 17.1962 13.125 16.5Z';

/** Home, active: the filled house; the chimney grows up from the roof line. */
export function HomeTabIcon({ color, active }: TabIconProps) {
  const progress = usePartProgress(active);
  const chimney = useAnimatedProps(() => ({ scaleY: Math.max(progress.get(), 0.02) }));
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d={HOME_GLYPH} fill={color} />
      <AnimatedPath
        d={HOME_CHIMNEY}
        fill={color}
        originX={16.875}
        originY={7.875}
        animatedProps={chimney}
      />
    </Svg>
  );
}

/** Settings, active: two bars and the top knob; the lower knob slides in from the left. */
export function SettingsTabIcon({ color, active }: TabIconProps) {
  const progress = usePartProgress(active);
  const knob = useAnimatedProps(() => ({
    translateX: -3 * (1 - progress.get()),
    opacity: progress.get(),
  }));
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d={SETTINGS_GLYPH} fill={color} />
      <AnimatedPath d={SETTINGS_KNOB} fill={color} animatedProps={knob} />
    </Svg>
  );
}
