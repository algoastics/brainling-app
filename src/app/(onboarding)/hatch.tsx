import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from '@/components/mascot';
import { Button, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import {
  Confetti,
  DesignDots,
  Egg,
  Icon,
  OnboardingHeader,
  OnboardingLayout,
  Title,
} from '@/onboarding/components';
import { checkName, HATCH_TAPS, ONBOARDING_ROUTES } from '@/onboarding/flow';
import { MASCOT_COLOURS, useOnboardingStore, type MascotColour } from '@/onboarding/store';
import { layout, palette, radius, space, useTheme } from '@/theme';

const SWATCH: Record<MascotColour, string> = {
  pink: palette.pink500,
  ice: palette.ice500,
  mint: palette.mint500,
};

type SwatchProps = {
  colour: MascotColour;
  selected: boolean;
  label: string;
  onSelect: (c: MascotColour) => void;
};

const Swatch = memo(function Swatch({ colour, selected, label, onSelect }: SwatchProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={() => onSelect(colour)}
      style={[styles.swatchRing, { borderColor: selected ? colors.primary : 'transparent' }]}
    >
      <View style={[styles.swatch, { backgroundColor: SWATCH[colour] }]} />
    </Pressable>
  );
});

/** S05 egg: tap the brain-pod three times (A06: light haptic per crack, medium on the pop). */
const HatchEgg = memo(function HatchEgg({ onHatched }: { onHatched: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [taps, setTaps] = useState(0);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    },
    [],
  );
  const wobble = useSharedValue(0);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.get()}deg` }, { scale: scale.get() }],
  }));

  const tap = useCallback(() => {
    const next = Math.min(taps + 1, HATCH_TAPS);
    setTaps(next);
    if (next < HATCH_TAPS) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!reduceMotion) {
        wobble.set(
          withSequence(
            withTiming(-8, { duration: 70 }),
            withTiming(8, { duration: 90 }),
            withTiming(0, { duration: 70 }),
          ),
        );
      }
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (reduceMotion) {
      onHatched();
      return;
    }
    scale.set(withSequence(withSpring(1.12, { damping: 8 }), withTiming(0.2, { duration: 180 })));
    popTimer.current = setTimeout(onHatched, 420);
  }, [onHatched, reduceMotion, scale, taps, wobble]);

  return (
    <>
      <Text color="muted" style={styles.subtitle}>
        {t('onboarding.hatch.subtitle', { count: HATCH_TAPS })}
      </Text>
      <View style={styles.stage}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.hatch.eggLabel')}
          accessibilityHint={t('onboarding.hatch.tapCount', { step: taps + 1, total: HATCH_TAPS })}
          onPress={tap}
          disabled={taps >= HATCH_TAPS}
          style={[styles.halo, { backgroundColor: colors.primarySoft }]}
        >
          <Animated.View style={anim}>
            <Egg size={210} cracks={taps} />
          </Animated.View>
        </Pressable>
      </View>
      <DesignDots count={HATCH_TAPS} index={Math.min(taps, HATCH_TAPS - 1)} />
      <Text
        variant="body.sm"
        color="muted"
        style={styles.tapCount}
        accessibilityLiveRegion="polite"
      >
        {t('onboarding.hatch.tapCount', {
          step: Math.min(taps + 1, HATCH_TAPS),
          total: HATCH_TAPS,
        })}
      </Text>
    </>
  );
});

/** S05 / S05-named — hatch the Thumbwell, then name it and pick a colour (stored locally only). */
export default function HatchScreen() {
  const t = useT();
  const { colors } = useTheme();
  const savedName = useOnboardingStore((s) => s.mascotName);
  const savedColour = useOnboardingStore((s) => s.mascotColour);
  const setMascot = useOnboardingStore((s) => s.setMascot);
  const [hatched, setHatched] = useState(savedName.length > 0);
  const [name, setName] = useState(savedName);
  const [colour, setColour] = useState<MascotColour>(savedColour);
  const [touched, setTouched] = useState(false);
  const check = checkName(name);
  const error = touched && check !== 'ok' ? t('onboarding.hatch.nameError') : undefined;

  const onHatched = useCallback(() => setHatched(true), []);
  const onChange = useCallback((v: string) => {
    setName(v);
    setTouched(true);
  }, []);
  const save = useCallback(() => {
    setTouched(true);
    if (checkName(name) !== 'ok') return;
    setMascot(name, colour);
    router.push(ONBOARDING_ROUTES.disclosure);
  }, [colour, name, setMascot]);

  return (
    <OnboardingLayout
      header={<OnboardingHeader step={3} total={3} onBack={router.back} />}
      footer={
        hatched ? (
          <Button
            label={t('onboarding.hatch.save')}
            iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
            onPress={save}
          />
        ) : undefined
      }
    >
      <Title>{t(hatched ? 'onboarding.hatch.namedTitle' : 'onboarding.hatch.title')}</Title>
      {hatched ? (
        <Animated.View entering={FadeIn.duration(250)}>
          <View style={styles.stage}>
            <View style={[styles.halo, { backgroundColor: colors.primarySoft }]}>
              <Confetti count={14} spread={150} />
              <Animated.View entering={FadeIn.duration(300)}>
                <Mascot state="glowing" size={190} />
              </Animated.View>
            </View>
          </View>
          <TextField
            label={t('onboarding.hatch.nameLabel')}
            value={name}
            onChangeText={onChange}
            error={error}
            maxLength={40}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Text variant="body.sm" style={styles.colourLabel}>
            {t('onboarding.hatch.colour')}
          </Text>
          <View style={styles.swatches} accessibilityRole="radiogroup">
            {MASCOT_COLOURS.map((c) => (
              <Swatch
                key={c}
                colour={c}
                selected={c === colour}
                label={t(`onboarding.hatch.colours.${c}`)}
                onSelect={setColour}
              />
            ))}
            <View
              style={[styles.locked, { backgroundColor: colors.surface2 }]}
              importantForAccessibility="no"
            >
              <Icon name="lock" size={18} color={colors.muted} />
            </View>
            <Text variant="caption" color="muted">
              {t('onboarding.hatch.moreInShop')}
            </Text>
          </View>
        </Animated.View>
      ) : (
        <HatchEgg onHatched={onHatched} />
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space[8], fontSize: 14 },
  stage: { alignItems: 'center', marginVertical: space[24] },
  halo: {
    width: 280,
    height: 280,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapCount: { textAlign: 'center', marginTop: space[16] },
  colourLabel: { marginTop: space[16], marginBottom: space[8] },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  swatchRing: {
    width: layout.minTouch + 8,
    height: layout.minTouch + 8,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 44, height: 44, borderRadius: radius.pill },
  locked: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
