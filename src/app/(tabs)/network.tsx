/**
 * The home network, read by the ihost-bridge add-on from the TP-Link Deco
 * mesh: whether the internet is up, the Deco units, every client and the Deco
 * it is connected to, and which addresses are fixed. Smart-home devices can be
 * given fixed addresses here, so they keep them when the router hands out new
 * ones. The hub's security modes sit at the foot: they are rarely used and no
 * longer have a tab of their own.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { SecurityCard } from '@/components/security-card';
import { StatusBanner } from '@/components/status-banner';
import { TAB_BAR_SPACE } from '@/components/tab-bar';
import { Text } from '@/components/text';
import { Body, Button, Card, Chip, Empty, Heading, Icon, Row, Screen, Title, useColors } from '@/components/ui';
import { clientName, linkLabel, mbps, unpinnedSmartHome, type NetClient, type Network } from '@/lib/network/bridge';
import { useNetwork, type NetworkState } from '@/lib/network/store';

type Filter = 'online' | 'smart' | 'all';

export default function NetworkScreen() {
  const state = useNetwork();
  const { network, unavailable, error, loading, bridgeUrl } = state;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await state.refresh();
    setRefreshing(false);
  };

  let body;
  if (unavailable) {
    body = <Empty icon="lan-disconnect" title="Network not available" body={unavailable} />;
  } else if (!network) {
    body = loading ? (
      <ActivityIndicator style={{ marginTop: 40 }} />
    ) : (
      <Empty icon="alert-circle-outline" title="Could not read the network" body={error} />
    );
  } else if (!network.configured) {
    body = (
      <>
        <Empty icon="router-wireless" title="No router set up" body="Add your TP-Link Deco on the ihost-bridge add-on's web page (Network: the Deco's address and admin password). The clients then show here." />
        {bridgeUrl ? <Button title="Open the bridge" variant="secondary" icon="open-in-new" onPress={() => void Linking.openURL(bridgeUrl)} /> : null}
      </>
    );
  } else {
    body = <NetworkView network={network} state={state} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <Title style={{ marginBottom: 14 }}>Network</Title>
        <StatusBanner />
        {body}
        <SecurityCard />
      </ScrollView>
    </Screen>
  );
}

function NetworkView({ network, state }: { network: Network; state: NetworkState }) {
  const c = useColors();
  const [filter, setFilter] = useState<Filter>('online');
  const [reviewing, setReviewing] = useState(false);
  const internet = network.internet;
  const groups = useMemo(() => groupByDeco(network, filter), [network, filter]);
  const unpinned = unpinnedSmartHome(network);
  const online = network.clients.filter((cl) => cl.online).length;

  return (
    <View>
      {network.error ? (
        <Card style={{ marginBottom: 10 }}>
          <Row>
            <Icon name="alert-circle-outline" size={20} color={c.danger} />
            <Body style={{ flex: 1 }}>{network.error}</Body>
          </Row>
        </Card>
      ) : null}

      <Card>
        <Row>
          <Icon name="web" size={24} color={internet?.online ? c.ok : c.danger} />
          <View style={{ flex: 1 }}>
            <Heading>{internet ? (internet.online ? 'Internet is up' : 'Internet is down') : 'Internet: no reading yet'}</Heading>
            <Body muted style={{ marginTop: 2 }}>
              {`${network.units.length} Deco unit${network.units.length === 1 ? '' : 's'} · ${online} device${online === 1 ? '' : 's'} online${network.lan ? ` · ${network.lan.network}` : ''}`}
            </Body>
          </View>
        </Row>
        {network.units.map((u) => (
          <Row key={u.mac} style={{ marginTop: 10 }}>
            <Icon name="router-wireless" size={20} color={u.online ? c.text : c.textSecondary} />
            <Body style={{ flex: 1 }}>{`${u.name}${u.role === 'master' ? ' (main)' : ''}`}</Body>
            <Body muted>{`${u.model} · ${u.firmware.split(' ')[0]}`}</Body>
          </Row>
        ))}
        {network.traffic_now ? (
          <Row style={{ marginTop: 12 }}>
            <Button title={`Traffic · ↓ ${mbps(network.traffic_now.down)} ↑ ${mbps(network.traffic_now.up)} Mbit/s`} variant="secondary" icon="chart-line" onPress={() => router.push('/traffic')} />
          </Row>
        ) : null}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Heading style={{ fontSize: 15 }}>Fixed addresses</Heading>
        <Body muted style={{ marginTop: 4 }}>
          {unpinned.length
            ? `${unpinned.length} smart-home device${unpinned.length === 1 ? ' has' : 's have'} no fixed address, so the router may move ${unpinned.length === 1 ? 'it' : 'them'} and the hub loses track. Pin them at the address they have now.`
            : `Every smart-home device Butter recognises keeps its address. ${network.reservations.items.length} fixed address${network.reservations.items.length === 1 ? '' : 'es'} on the Deco${network.reservations.max ? ` (room for ${network.reservations.max})` : ''}.`}
        </Body>
        {unpinned.length && !reviewing ? (
          <Row style={{ marginTop: 10 }}>
            <Button title="Review and pin" icon="pin-outline" onPress={() => setReviewing(true)} />
          </Row>
        ) : null}
        {reviewing ? <PinReview candidates={network.clients.filter((cl) => cl.online && cl.ip && cl.reserved_ip !== cl.ip)} suggested={unpinned} state={state} onDone={() => setReviewing(false)} /> : null}
      </Card>

      <Row style={{ marginTop: 18, flexWrap: 'wrap' }}>
        <Chip label="Online" selected={filter === 'online'} onPress={() => setFilter('online')} />
        <Chip label="Smart home" selected={filter === 'smart'} onPress={() => setFilter('smart')} />
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </Row>

      {groups.map(([deco, clients]) => (
        <View key={deco}>
          <Heading style={styles.section}>{deco}</Heading>
          <Card style={{ paddingVertical: 4 }}>
            {clients.map((cl, i) => (
              <ClientRow key={cl.mac} client={cl} first={i === 0} state={state} />
            ))}
          </Card>
        </View>
      ))}
      {groups.length === 0 ? <Body muted style={{ marginTop: 14 }}>Nothing to show with this filter.</Body> : null}
    </View>
  );
}

function groupByDeco(network: Network, filter: Filter): [string, NetClient[]][] {
  const keep = (cl: NetClient) => (filter === 'online' ? cl.online : filter === 'smart' ? cl.smart_home : true);
  const groups = new Map<string, NetClient[]>();
  for (const cl of network.clients.filter(keep)) {
    const key = cl.online ? (cl.deco ?? 'Other') : 'Offline';
    groups.set(key, [...(groups.get(key) ?? []), cl]);
  }
  const order = (key: string) => (key === 'Offline' ? 2 : network.units.find((u) => u.name === key)?.role === 'master' ? 0 : 1);
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
}

function ClientRow({ client, first, state }: { client: NetClient; first: boolean; state: NetworkState }) {
  const c = useColors();
  const pinned = !!client.reserved_ip && client.reserved_ip === client.ip;
  const moved = !!client.reserved_ip && client.ip && client.reserved_ip !== client.ip;

  const act = () => {
    const name = clientName(client);
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'Cancel', style: 'cancel' }];
    if (client.ip && client.online && !pinned) {
      buttons.push({
        text: `Pin ${client.ip}`,
        onPress: () => void run(() => state.pin([{ mac: client.mac, ip: client.ip }]), `${name} keeps ${client.ip} from its next reconnect.`),
      });
    }
    if (client.reserved_ip) {
      buttons.push({ text: 'Remove fixed address', style: 'destructive', onPress: () => void run(() => state.unpin(client.mac), `The Deco no longer keeps an address for ${name}.`) });
    }
    if (buttons.length === 1) return;
    Alert.alert(name, `${client.mac}\n${client.reserved_ip ? `Fixed address: ${client.reserved_ip}` : 'No fixed address.'}\nThis changes the Deco's address settings.`, buttons);
  };

  return (
    <Pressable onPress={act} style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, pressed && { opacity: 0.7 }]}>
      <Icon name={client.wired ? 'ethernet' : client.smart_home ? 'home-automation' : 'cellphone-wireless'} size={20} color={client.online ? c.text : c.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: client.online ? c.text : c.textSecondary }]} numberOfLines={1}>
          {clientName(client)}
        </Text>
        <Body muted style={{ fontSize: 13 }} numberOfLines={1}>
          {[client.ip || '—', client.online ? linkLabel(client) : 'offline', client.known_as && client.name ? client.name : null].filter(Boolean).join(' · ')}
        </Body>
      </View>
      {pinned ? <Icon name="pin" size={16} color={c.accent} /> : null}
      {moved ? <Body muted style={{ fontSize: 12 }}>{`fixed ${client.reserved_ip}`}</Body> : null}
    </Pressable>
  );
}

async function run(task: () => Promise<unknown>, done: string) {
  try {
    await task();
    Alert.alert('Done', done);
  } catch (e) {
    Alert.alert('The Deco did not take it', e instanceof Error ? e.message : String(e));
  }
}

/** Tick the devices to pin, then confirm once. Suggested ones start ticked. */
function PinReview({ candidates, suggested, state, onDone }: { candidates: NetClient[]; suggested: NetClient[]; state: NetworkState; onDone: () => void }) {
  const c = useColors();
  const [picked, setPicked] = useState(() => new Set(suggested.map((cl) => cl.mac)));
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? candidates : candidates.filter((cl) => cl.smart_home);
  const chosen = candidates.filter((cl) => picked.has(cl.mac));

  const toggle = (mac: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(mac)) next.delete(mac);
      else next.add(mac);
      return next;
    });

  const confirm = () => {
    const lines = chosen.map((cl) => `${clientName(cl)}: ${cl.ip}`).join('\n');
    Alert.alert(`Pin ${chosen.length} address${chosen.length === 1 ? '' : 'es'}?`, `${lines}\n\nThe Deco then always gives these devices the same address. Each keeps the one it has now, so nothing moves; you can remove a pin later here.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pin',
        onPress: () => {
          setBusy(true);
          state
            .pin(chosen.map((cl) => ({ mac: cl.mac, ip: cl.ip })))
            .then((r) => {
              Alert.alert('Done', `${r.added + r.changed} address${r.added + r.changed === 1 ? '' : 'es'} pinned${r.unchanged ? `, ${r.unchanged} already were` : ''}.`);
              onDone();
            })
            .catch((e: unknown) => Alert.alert('The Deco did not take it', e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  return (
    <View style={{ marginTop: 10 }}>
      {list.map((cl) => {
        const on = picked.has(cl.mac);
        return (
          <Pressable key={cl.mac} onPress={() => toggle(cl.mac)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? c.accent : c.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                {clientName(cl)}
              </Text>
              <Body muted style={{ fontSize: 13 }}>{`${cl.ip} · ${cl.deco ?? ''}`}</Body>
            </View>
          </Pressable>
        );
      })}
      <Pressable onPress={() => setShowAll((v) => !v)} style={{ paddingVertical: 8 }}>
        <Body style={{ color: c.info }}>{showAll ? 'Only smart-home devices' : `Show every device (${candidates.length})`}</Body>
      </Pressable>
      {showAll ? <Body muted style={{ fontSize: 13 }}>Leave phones and laptops out: they often change their Wi-Fi address, so a pin would not follow them.</Body> : null}
      <Row style={{ marginTop: 10 }}>
        <Button title={`Pin ${chosen.length}`} icon="pin" busy={busy} disabled={!chosen.length} onPress={confirm} />
        <Button title="Cancel" variant="secondary" disabled={busy} onPress={onDone} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: TAB_BAR_SPACE },
  section: { marginTop: 18, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontSize: 15, fontWeight: '600' },
});
