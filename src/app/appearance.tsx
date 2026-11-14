/**
 * Settings → Appearance: pick the look (Butter or Bold Blocks), each shown as
 * a small light and dark preview drawn from its own palette, and whether the
 * app follows the phone's light/dark setting or keeps one. Saved on this phone
 * only, so everyone in the house can have their own.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { alpha } from '@/lib/cube/appearance';
import { Body, Heading, Icon, cardChrome, useColors } from '@/components/ui';
import { THEMES, useAppearance, type ColorMode, type Palette, type Theme, type ThemeId } from '@/theme';

const MODES: { mode: ColorMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function AppearanceScreen() {
  const c = useColors();
  const theme = useAppearance((s) => s.theme);
  const mode = useAppearance((s) => s.mode);
  const setTheme = useAppearance((s) => s.setTheme);
  const setMode = useAppearance((s) => s.setMode);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Heading style={[styles.section, { color: c.textSecondary }]}>Theme</Heading>
      <View style={styles.themes}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => (
          <ThemeCard key={id} theme={THEMES[id]} selected={theme === id} onPress={() => void setTheme(id)} />
        ))}
      </View>

      <Heading style={[styles.section, { color: c.textSecondary }]}>Light or dark</Heading>
      <View accessibilityRole="radiogroup" style={[styles.segments, { backgroundColor: c.backgroundSelected, borderRadius: c.shape.cardRadius - 4 }]}>
        {MODES.map((m) => {
          const on = mode === m.mode;
          return (
            <Pressable
              key={m.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => void setMode(m.mode)}
              style={[styles.segment, { borderRadius: c.shape.cardRadius - 8 }, on ? [{ backgroundColor: c.backgroundElement }, cardChrome(c, false)] : null]}>
              <Text style={[styles.segmentText, { color: on ? c.text : c.textSecondary, fontWeight: on ? '700' : '500' }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Body muted style={styles.note}>
        System follows your phone, so Home turns dark in the evening when your phone does.
      </Body>
      <Body muted style={styles.note}>
        Saved on this phone only, so everyone in the house can pick their own look.
      </Body>
    </ScrollView>
  );
}

function ThemeCard({ theme, selected, onPress }: { theme: Theme; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${theme.name} theme`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeCard,
        { backgroundColor: c.backgroundElement, borderRadius: c.shape.cardRadius, borderColor: selected ? c.accent : c.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={styles.previews}>
        <Preview theme={theme} palette={theme.schemes.light} />
        <Preview theme={theme} palette={theme.schemes.dark} />
      </View>
      <View style={styles.themeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.themeName, { color: c.text, fontFamily: theme.fonts.family?.['800'] ?? theme.fonts.family?.['700'] }]}>{theme.name}</Text>
          <Text style={[styles.themeNote, { color: c.textSecondary }]}>{theme.description}</Text>
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: c.accent }]}>
            <Icon name="check" size={14} color={c.onAccent} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A thumbnail of Home in one scheme of a theme: the sky, the solar card and two tiles. */
function Preview({ theme, palette }: { theme: Theme; palette: Palette }) {
  const outlined = theme.shape.borderWidth > 0;
  const block = (bg: string, lifted: boolean) => [
    { backgroundColor: bg, borderRadius: 6 },
    outlined ? { borderWidth: 1.5, borderColor: palette.line } : null,
    outlined && lifted ? { boxShadow: `2px 2px 0px ${palette.line}` } : null,
  ];
  return (
    <View style={[styles.preview, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={[{ height: 30 }, block(palette.sky.kinds.clear.day.top, true)]} />
      <View style={[{ height: 24 }, block(palette.solar.making.fill, true)]} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={[{ flex: 1, height: 22 }, block(outlined ? palette.state.on : alpha(palette.state.on, 0.35), true)]} />
        <View style={[{ flex: 1, height: 22 }, block(palette.backgroundElement, false)]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 10, marginHorizontal: 4 },
  themes: { flexDirection: 'row', gap: 12 },
  themeCard: { flex: 1, padding: 10, borderWidth: 2.5 },
  previews: { flexDirection: 'row', gap: 6 },
  preview: { flex: 1, height: 120, borderRadius: 12, padding: 6, gap: 5, borderWidth: 1 },
  themeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  themeName: { fontSize: 15, fontWeight: '800' },
  themeNote: { fontSize: 12, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14 },
  note: { fontSize: 13, marginTop: 10, marginHorizontal: 4, lineHeight: 19 },
});
