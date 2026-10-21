import { router } from 'expo-router';
import { memo, useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascot';
import { Button, Text } from '@/components/ui';
import { useT } from '@/i18n';
import {
  AppTile,
  DesignDots,
  Flame,
  Icon,
  Positioned,
  RollingNumber,
  Title,
  Trophy,
  useDesignScale,
} from '@/onboarding/components';
import { ONBOARDING_ROUTES } from '@/onboarding/flow';
import { fonts, space, useTheme } from '@/theme';

const CARDS = ['card1', 'card2', 'card3'] as const;
type CardKey = (typeof CARDS)[number];

/** Kit hero band: 520 of the 915 dp frame. */
const HERO_H = 520;
/** Mascot art: body centre sits at 55 % of its square box. */
const mascotCy = (cy: number, size: number) => cy - 0.05 * size;

type HeroProps = { card: CardKey; active: boolean; k: number; width: number };

const Hero = memo(function Hero({ card, active, k, width }: HeroProps) {
  const t = useT();
  const { colors } = useTheme();
  const at = { k, frameWidth: width };
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t(`onboarding.welcome.${card}.art`)}
      style={{ height: HERO_H * k, backgroundColor: colors.primarySoft }}
    >
      {card === 'card1' ? (
        <>
          {(
            [
              ['instagram', 60, 110],
              ['youtube', 300, 150],
              ['tiktok', 90, 380],
              ['facebook', 310, 390],
            ] as const
          ).map(([app, x, y]) => (
            <Positioned key={app} cx={x + 22} cy={y + 22} w={44} h={44} {...at}>
              <AppTile app={app} size={44 * k} />
            </Positioned>
          ))}
          <Positioned cx={206} cy={235} w={300} h={130} {...at}>
            <RollingNumber
              value={300}
              active={active}
              lineHeight={130 * k}
              textStyle={{
                fontFamily: fonts.display.bold,
                fontSize: 120 * k,
                color: colors.primary,
              }}
            />
          </Positioned>
          <Positioned cx={206} cy={304} w={300} h={26} {...at}>
            <Text variant="body.lg" color="ink2" style={{ fontSize: 18 * k, lineHeight: 24 * k }}>
              {t('onboarding.welcome.reelsToday')}
            </Text>
          </Positioned>
        </>
      ) : card === 'card2' ? (
        <>
          <Positioned cx={120} cy={mascotCy(280, 260)} w={260} h={260} {...at}>
            <Mascot state="happy" size={260 * k} />
          </Positioned>
          <Positioned cx={207} cy={281} w={26} h={26} {...at}>
            <Icon name="next" size={26 * k} color={colors.muted} />
          </Positioned>
          <Positioned cx={296} cy={mascotCy(280, 260)} w={260} h={260} {...at}>
            <Mascot state="fried" size={260 * k} />
          </Positioned>
        </>
      ) : (
        <>
          <Positioned cx={206} cy={mascotCy(280, 280)} w={280} h={280} {...at}>
            <Mascot state="glowing" size={280 * k} />
          </Positioned>
          <Positioned cx={80} cy={180} w={56} h={68} {...at}>
            <Flame size={56 * k} />
          </Positioned>
          <Positioned cx={322} cy={182} w={44} h={44} {...at}>
            <Trophy size={44 * k} />
          </Positioned>
        </>
      )}
    </View>
  );
});

type CardProps = { card: CardKey; active: boolean; width: number; k: number };

const WelcomeCard = memo(function WelcomeCard({ card, active, width, k }: CardProps) {
  const t = useT();
  return (
    <View style={{ width }}>
      <Hero card={card} active={active} k={k} width={width} />
      <View style={styles.copy}>
        <Title style={styles.title}>{t(`onboarding.welcome.${card}.title`)}</Title>
        <Text color="ink2" style={styles.body}>
          {t(`onboarding.welcome.${card}.body`)}
        </Text>
      </View>
    </View>
  );
});

/** S02 · S02-card2 · S02-card3 — welcome carousel. "I already have an account" (S12) is hidden until v1.1. */
export default function WelcomeScreen() {
  const t = useT();
  const { colors } = useTheme();
  const k = useDesignScale();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = CARDS.length - 1;

  const onPageEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const next = useCallback(() => {
    if (index < last) {
      pager.current?.scrollTo({ x: (index + 1) * width, animated: true });
      setIndex(index + 1);
    } else {
      router.push(ONBOARDING_ROUTES.quiz);
    }
  }, [index, last, width]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageEnd}
        style={styles.root}
      >
        {CARDS.map((card, i) => (
          <WelcomeCard key={card} card={card} active={i === index} width={width} k={k} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <DesignDots count={CARDS.length} index={index} />
        <Button
          label={index === last ? t('onboarding.welcome.getStarted') : t('onboarding.welcome.next')}
          accessibilityHint={t('onboarding.welcome.cardPosition', {
            index: index + 1,
            total: CARDS.length,
          })}
          iconRight={<Icon name="next" size={20} color={colors.onPrimary} strokeWidth={2.6} />}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  copy: { paddingHorizontal: 28, paddingTop: space[24], gap: 18 },
  title: { fontSize: 30, lineHeight: 34 },
  body: { fontSize: 15.5, lineHeight: 22, fontFamily: fonts.body.semibold },
  footer: { paddingHorizontal: space[24], paddingBottom: space[24], gap: space[24] },
});
