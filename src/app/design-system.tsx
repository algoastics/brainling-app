import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppBar,
  AppChip,
  Banner,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Chip,
  CoinPill,
  CounterRing,
  Dialog,
  HealthBar,
  ListRow,
  ProgressDots,
  ProTag,
  Radio,
  Screen,
  Segmented,
  StepBar,
  StreakPill,
  Text,
  TextField,
  Toast,
  Toggle,
  type ButtonKind,
} from '@/components/ui';
import { ThemeProvider, health, space, stateForHealth, type ColorSchemeName } from '@/theme';

const BUTTON_KINDS: readonly ButtonKind[] = [
  'primary',
  'secondary',
  'ghost',
  'text',
  'good',
  'danger',
  'pro',
];
const SCHEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;
const SAMPLE_BUDGET = 30;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="heading.h3" accessibilityRole="header">
        {id} · {title}
      </Text>
      {children}
    </View>
  );
}

function Catalogue({
  scheme,
  onSchemeChange,
}: {
  scheme: ColorSchemeName;
  onSchemeChange: (s: ColorSchemeName) => void;
}) {
  const [name, setName] = useState('');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [radio, setRadio] = useState<'a' | 'b'>('a');
  const [chip, setChip] = useState(false);
  const [count, setCount] = useState(12);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState(false);
  const h = health(count, SAMPLE_BUDGET);
  const state = stateForHealth(h);

  return (
    <View style={styles.fill}>
      <Screen>
        <AppBar title="Design system" onBack={() => router.back()} right={<ProTag />} />
        <Segmented options={SCHEMES} value={scheme} onChange={onSchemeChange} />

        <Section id="C01" title="Buttons">
          {BUTTON_KINDS.map((kind) => (
            <Button key={kind} kind={kind} label={kind} onPress={() => setToast((t) => !t)} />
          ))}
          <View style={styles.row}>
            <Button size="sm" label="Small" onPress={() => setToast((t) => !t)} />
            <Button size="sm" label="Loading" loading onPress={() => setToast((t) => !t)} />
            <Button size="sm" label="Disabled" disabled onPress={() => setToast((t) => !t)} />
          </View>
        </Section>

        <Section id="C02" title="Inputs & controls">
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField label="Error" value="" onChangeText={setName} error="This field is required" />
          <TextField label="Disabled" value="" onChangeText={setName} disabled />
          <View style={styles.row}>
            <Toggle value={on} onChange={setOn} accessibilityLabel="Sample toggle" />
            <Chip label="Chip" selected={chip} onChange={setChip} />
          </View>
          <Checkbox label="Checkbox" value={checked} onChange={setChecked} />
          <Radio label="Option A" value={radio === 'a'} onChange={() => setRadio('a')} />
          <Radio label="Option B" value={radio === 'b'} onChange={() => setRadio('b')} />
        </Section>

        <Section id="C03" title="Cards & lists">
          <Card elevated>
            <Text variant="body.lg">Elevated card</Text>
          </Card>
          <Card tone="primary">
            <Text>Tinted card</Text>
          </Card>
          <Card>
            <ListRow
              title="List row"
              subtitle="Subtitle"
              value="Value"
              chevron
              onPress={() => setSheet(true)}
            />
            <ListRow title="With toggle" toggle={{ value: on, onChange: setOn }} />
            <ListRow title="Danger row" danger onPress={() => setDialog(true)} />
          </Card>
        </Section>

        <Section id="C04" title="Counters & meters">
          <View style={styles.center}>
            <CounterRing
              count={count}
              budget={SAMPLE_BUDGET}
              state={state}
              accessibilityLabel={`${count} of ${SAMPLE_BUDGET}`}
            />
          </View>
          <View style={styles.row}>
            <Button size="sm" label="+1" onPress={() => setCount((c) => c + 1)} />
            <Button size="sm" kind="secondary" label="Reset" onPress={() => setCount(0)} />
          </View>
          <HealthBar health={h} state={state} accessibilityLabel={`Health ${h}, ${state}`} />
          <AppChip app="App name" count={count} limit={SAMPLE_BUDGET} />
        </Section>

        <Section id="C05" title="Coins & streak">
          <View style={styles.row}>
            <CoinPill amount={240} />
            <StreakPill days={0} />
            <StreakPill days={3} />
            <StreakPill days={12} />
            <StreakPill days={45} />
            <StreakPill days={120} />
            <StreakPill days={8} frozen />
          </View>
        </Section>

        <Section id="C09" title="Navigation">
          <ProgressDots count={4} index={1} />
          <StepBar steps={5} current={2} />
        </Section>

        <Section id="C10" title="Modals & toasts">
          <Banner
            tone="warn"
            title="Banner"
            body="Inline status message."
            actions={[{ label: 'Action', onPress: () => setToast((t) => !t) }]}
          />
          <View style={styles.row}>
            <Button size="sm" label="Sheet" onPress={() => setSheet(true)} />
            <Button size="sm" label="Dialog" onPress={() => setDialog(true)} />
            <Button size="sm" label="Toast" onPress={() => setToast((t) => !t)} />
          </View>
        </Section>
      </Screen>
      <Toast visible={toast} message="Toast message" tone="good" />
      <BottomSheet
        visible={sheet}
        onDismiss={() => setSheet(false)}
        title="Bottom sheet"
        body="Sheet body text."
        actions={[{ label: 'Done', onPress: () => setSheet(false) }]}
      />
      <Dialog
        visible={dialog}
        onDismiss={() => setDialog(false)}
        title="Dialog"
        body="Dialog body text."
        actions={[
          { label: 'Confirm', kind: 'danger', onPress: () => setDialog(false) },
          { label: 'Cancel', kind: 'text', onPress: () => setDialog(false) },
        ]}
      />
    </View>
  );
}

/** Developer catalogue of C01–C10 in light and dark (M0 DoD); only reachable in dev builds. */
export default function DesignSystemScreen() {
  const [scheme, setScheme] = useState<ColorSchemeName>('light');
  return (
    <ThemeProvider scheme={scheme}>
      <Catalogue scheme={scheme} onSchemeChange={setScheme} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  section: { gap: space[12], marginTop: space[16] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], alignItems: 'center' },
  center: { alignItems: 'center' },
});
