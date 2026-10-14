import { StyleSheet, Text, View } from 'react-native';

import { useHub } from '@/lib/hub/store';

import { useColors } from './ui';

/** One line under the title: shows anything other than "online". */
export function StatusBanner() {
  const c = useColors();
  const status = useHub((s) => s.status);
  const detail = useHub((s) => s.statusDetail);
  if (status === 'online' || status === 'idle') return null;
  const text =
    status === 'connecting'
      ? 'Connecting to the hub…'
      : status === 'unauthorised'
        ? 'The hub no longer accepts this token. Pair again from Settings.'
        : `Hub unreachable${detail ? ` (${detail})` : ''}. Retrying…`;
  const bg = status === 'connecting' ? c.backgroundSelected : 'rgba(210,59,59,0.14)';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  text: { fontSize: 13, fontWeight: '500' },
});
