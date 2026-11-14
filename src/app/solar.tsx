/**
 * Solar production for the home: what the panels make now, today's output as
 * a curve, the energy by day, month, year and lifetime, and, when the
 * ihost-bridge add-on reads the plant, its history as charts. Also where a
 * FusionSolar kiosk link is pasted, changed or removed for homes without the
 * bridge.
 */

import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarChart, LineChart, type Bar, type Tick } from '@/components/chart';
import { Body, Button, Card, Chip, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import { selectActiveHub, useHub } from '@/lib/hub/store';
import type { Span } from '@/lib/solar/bridge';
import { clock, formatEnergy, formatPower, parseSolarLink, solarLinkUrl, type Solar, type SolarLink } from '@/lib/solar/fusionsolar';
import { refreshHomeSolar, useHomeSolar, useSolarYields, type HomeSolar } from '@/lib/solar/store';

const DAY = 24 * 60;
const TICKS: Tick[] = [0, 6, 12, 18, 24].map((h) => ({ t: h * 60, label: `${String(h).padStart(2, '0')}:00` }));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SolarScreen() {
  const hub = useHub(selectActiveHub);
  const setSolar = useHub((s) => s.setSolar);
  const link = hub?.solar;
  const home = useHomeSolar();
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!hub) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Empty icon="solar-power-variant-outline" title="No hub selected" />
      </Screen>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshHomeSolar(home, link);
    setRefreshing(false);
  };

  const remove = () => {
    Alert.alert('Remove the kiosk link?', 'Butter forgets the link on this phone. Nothing changes in FusionSolar or on the bridge.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void setSolar(hub.id, undefined) },
    ]);
  };

  const { solar } = home;
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: solar && home.available ? solar.name : 'Solar' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={home.available && !editing ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}>
        {editing || !home.available ? (
          <LinkForm
            current={link}
            onSave={async (next) => {
              await setSolar(hub.id, next);
              setEditing(false);
            }}
            onCancel={home.available ? () => setEditing(false) : undefined}
          />
        ) : solar ? (
          <SolarView solar={solar} home={home} hasLink={!!link} onChange={() => setEditing(true)} onRemove={remove} />
        ) : (
          <Card>
            <Row>
              {home.loading ? <ActivityIndicator /> : <Icon name="alert-circle-outline" size={20} />}
              <Body style={{ flex: 1 }}>{home.loading ? 'Reading the panels…' : (home.error ?? 'No figures yet')}</Body>
            </Row>
            <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <Button title="Try again" variant="secondary" icon="refresh" onPress={() => void onRefresh()} />
              <Button title={link ? 'Change link' : 'Add a kiosk link'} variant="secondary" onPress={() => setEditing(true)} />
              {link ? <Button title="Remove" variant="secondary" onPress={remove} /> : null}
            </Row>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

// ----- the link ------------------------------------------------------------------

function LinkForm({ current, onSave, onCancel }: { current?: SolarLink; onSave: (link: SolarLink) => Promise<void>; onCancel?: () => void }) {
  const c = useColors();
  const [draft, setDraft] = useState('');
  const text = draft.trim();
  const parsed = parseSolarLink(text);
  return (
    <View>
      <Heading>Your FusionSolar kiosk link</Heading>
      <Body muted style={{ marginTop: 4 }}>
        In the FusionSolar app or website, open your plant, choose Kiosk view, switch it on and copy the link. It lets Butter read production without your Huawei account; only the link&apos;s key is sent, straight to Huawei.
      </Body>
      <Body muted style={{ marginTop: 8 }}>
        If the ihost-bridge add-on runs on your hub, set solar up on its web page instead: it then shows here by itself, with history charts, on every phone.
      </Body>
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        placeholder={current ? solarLinkUrl(current) : 'https://…fusionsolar.huawei.com/…kiosk?kk=…'}
        placeholderTextColor={c.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        multiline
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
      />
      {text && !parsed ? (
        <Body muted style={{ marginTop: 8 }}>
          That does not look like a kiosk link. It should be on fusionsolar.huawei.com and end in kk= and a key.
        </Body>
      ) : null}
      <Row style={{ marginTop: 12 }}>
        <Button title="Save" icon="check" disabled={!parsed} onPress={() => parsed && void onSave(parsed)} />
        {onCancel ? <Button title="Cancel" variant="secondary" onPress={onCancel} /> : null}
      </Row>
    </View>
  );
}

// ----- the figures ----------------------------------------------------------------

function SolarView({ solar, home, hasLink, onChange, onRemove }: { solar: Solar; home: HomeSolar; hasLink: boolean; onChange: () => void; onRemove: () => void }) {
  const c = useColors();
  const making = solar.power > 0;
  const viaBridge = home.source === 'bridge';
  const { kioskUrl, bridgeUrl } = home;
  return (
    <View>
      <Card style={{ paddingVertical: 18 }}>
        <Row style={{ alignItems: 'center', gap: 14 }}>
          <View style={[styles.badge, { backgroundColor: making ? c.accentSoft : c.backgroundSelected }]}>
            <Icon name="solar-power-variant" size={30} color={making ? c.accent : c.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hero, { color: c.text }]}>{formatPower(solar.power)}</Text>
            <Text style={[styles.heroLabel, { color: c.textSecondary }]}>{making ? 'Producing now' : 'Not producing right now'}</Text>
          </View>
        </Row>
      </Card>

      <View style={styles.tiles}>
        <Tile icon="calendar-today" value={formatEnergy(solar.today)} label="Today" tint={c.accent} />
        <Tile icon="calendar-month" value={formatEnergy(solar.month)} label="This month" />
        <Tile icon="calendar-blank" value={formatEnergy(solar.year)} label="This year" />
      </View>
      <View style={styles.tiles}>
        <Tile icon="sigma" value={formatEnergy(solar.lifetime)} label="Lifetime" />
        <Tile icon="summit" value={solar.peak > 0 ? formatPower(solar.peak) : '–'} label="Peak today" />
        <Tile icon="molecule-co2" value={solar.co2 !== undefined ? (solar.co2 >= 1000 ? `${(solar.co2 / 1000).toFixed(1)} t` : `${Math.round(solar.co2)} kg`) : '–'} label="CO₂ avoided" />
      </View>

      <Heading style={styles.section}>Today</Heading>
      <Card>
        {solar.curve.length > 1 ? (
          <LineChart points={solar.curve} from={0} to={DAY} ticks={TICKS} color={c.accent} format={(v) => `${v.toFixed(1)} kW`} zeroBased minSpan={1} />
        ) : (
          <Body muted>The panels have not reported yet today.</Body>
        )}
      </Card>

      <Heading style={styles.section}>History</Heading>
      {viaBridge && bridgeUrl ? (
        <History url={bridgeUrl} />
      ) : (
        <Card>
          <Body muted>
            Charts by day, month and year need the ihost-bridge add-on on your hub: it reads the plant around the clock and keeps the record. Set solar up on the bridge&apos;s web page and they appear here.
          </Body>
        </Card>
      )}

      <Row style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {kioskUrl ? <Button title="Open kiosk" variant="secondary" icon="open-in-new" onPress={() => void Linking.openURL(kioskUrl)} /> : null}
        {viaBridge && bridgeUrl ? <Button title="Bridge settings" variant="secondary" icon="cog-outline" onPress={() => void Linking.openURL(bridgeUrl)} /> : null}
        {!viaBridge ? <Button title="Change link" variant="secondary" icon="link-variant" onPress={onChange} /> : null}
        {!viaBridge && hasLink ? <Button title="Remove" variant="secondary" onPress={onRemove} /> : null}
      </Row>

      <Pressable disabled={!kioskUrl} onPress={() => kioskUrl && void Linking.openURL(kioskUrl)} style={{ marginTop: 16 }}>
        <Body muted style={{ fontSize: 12, textAlign: 'center' }}>
          {`${viaBridge ? 'Read by ihost-bridge on your hub' : 'From FusionSolar'}${solar.updated !== undefined ? ` · plant reported at ${clock(solar.updated)}` : ''}${home.error ? ` · could not refresh: ${home.error}` : ''}`}
        </Body>
      </Pressable>
    </View>
  );
}

// ----- history ---------------------------------------------------------------------

const SPANS: [Span, string][] = [
  ['day', 'Days'],
  ['month', 'Months'],
  ['year', 'Years'],
];

function History({ url }: { url: string }) {
  const c = useColors();
  const today = useMemo(() => new Date(), []);
  const [span, setSpan] = useState<Span>('day');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const { list, error, loading } = useSolarYields(url, span, year, month);
  const items = useMemo(() => list?.items ?? [], [list]);

  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth() + 1;
  const atNow = span === 'day' ? year === thisYear && month === thisMonth : year === thisYear;

  const { bars, ticks, from, to } = useMemo(() => {
    const bars: Bar[] = [];
    let ticks: Tick[] = [];
    let from = 0;
    let to = 1;
    if (span === 'day') {
      to = new Date(year, month, 0).getDate();
      for (const item of items) {
        const day = Number(item.key.slice(8, 10));
        bars.push({ start: day - 1, end: day, v: item.kwh, muted: atNow && day === today.getDate() });
      }
      ticks = [1, 8, 15, 22, 29].filter((d) => d <= to).map((d) => ({ t: d - 0.5, label: String(d) }));
    } else if (span === 'month') {
      to = 12;
      for (const item of items) {
        const m = Number(item.key.slice(5, 7));
        bars.push({ start: m - 1, end: m, v: item.kwh, muted: atNow && m === thisMonth });
      }
      ticks = [0, 3, 6, 9].map((m) => ({ t: m + 0.5, label: MONTHS[m] }));
    } else {
      const years = items.map((item) => Number(item.key));
      const first = Math.min(thisYear, ...years);
      from = first;
      to = thisYear + 1;
      for (const item of items) bars.push({ start: Number(item.key), end: Number(item.key) + 1, v: item.kwh, muted: Number(item.key) === thisYear });
      const step = Math.ceil((to - from) / 5);
      for (let y = first; y <= thisYear; y += step) ticks.push({ t: y + 0.5, label: String(y) });
    }
    return { bars, ticks, from, to };
  }, [items, span, year, month, atNow, today, thisYear, thisMonth]);

  const total = items.reduce((sum, item) => sum + item.kwh, 0);
  const best = items.reduce<(typeof items)[number] | undefined>((top, item) => (!top || item.kwh > top.kwh ? item : top), undefined);
  const label = span === 'day' ? `${MONTHS[month - 1]} ${year}` : span === 'month' ? String(year) : 'All years';
  const step = (dir: -1 | 1) => {
    if (span === 'month') return setYear(year + dir);
    const next = new Date(year, month - 1 + dir, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };
  const bestLabel = !best ? '' : span === 'day' ? `${Number(best.key.slice(8, 10))} ${MONTHS[month - 1]}` : span === 'month' ? MONTHS[Number(best.key.slice(5, 7)) - 1] : best.key;

  return (
    <Card>
      <Row style={{ flexWrap: 'wrap' }}>
        {SPANS.map(([value, name]) => (
          <Chip key={value} label={name} selected={span === value} onPress={() => setSpan(value)} />
        ))}
      </Row>
      <Row between style={{ marginTop: 12, marginBottom: 8 }}>
        {span !== 'year' ? <NavButton icon="chevron-left" onPress={() => step(-1)} /> : <View style={styles.nav} />}
        <Text style={[styles.navLabel, { color: c.text }]}>{label}</Text>
        {span !== 'year' && !atNow ? <NavButton icon="chevron-right" onPress={() => step(1)} /> : <View style={styles.nav} />}
      </Row>
      {bars.length ? (
        <BarChart bars={bars} from={from} to={to} ticks={ticks} color={c.accent} format={(v) => formatEnergy(v)} height={160} />
      ) : (
        <View style={styles.blank}>{loading ? <ActivityIndicator /> : <Body muted>{error ?? 'Nothing on record for this period.'}</Body>}</View>
      )}
      {bars.length ? (
        <Row between style={{ marginTop: 10 }}>
          <Body style={{ fontSize: 14 }}>{`Total ${formatEnergy(total)}`}</Body>
          {best && best.kwh > 0 && items.length > 1 ? <Body muted style={{ fontSize: 13 }}>{`Best: ${bestLabel} · ${formatEnergy(best.kwh)}`}</Body> : null}
        </Row>
      ) : null}
      {list && (!list.api || list.apiError) ? (
        <Body muted style={{ fontSize: 12, marginTop: 8 }}>
          {list.apiError
            ? `Huawei's API: ${list.apiError}. Showing what the bridge already has.`
            : 'The bridge is keeping its own record from the day solar was set up. Add a Huawei API account on its web page to fill in the years before.'}
        </Body>
      ) : null}
    </Card>
  );
}

function NavButton({ icon, onPress }: { icon: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.nav, { backgroundColor: c.backgroundSelected, opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

function Tile({ icon, value, label, tint }: { icon: string; value: string; label: string; tint?: string }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c.backgroundElement }]}>
      <Icon name={icon} size={20} color={tint ?? c.textSecondary} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: c.text }]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: c.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  input: { fontSize: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginTop: 12, minHeight: 64, textAlignVertical: 'top' },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  hero: { fontSize: 44, fontWeight: '700', letterSpacing: -1.2, lineHeight: 50, fontVariant: ['tabular-nums'] },
  heroLabel: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  tileValue: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  nav: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 15, fontWeight: '600' },
  blank: { height: 120, alignItems: 'center', justifyContent: 'center' },
});
