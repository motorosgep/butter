/** Small, themed building blocks shared by every screen. */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, type ResolvedTheme } from '@/theme';

export { BUTTER, BUTTER_DARK } from '@/theme';

/** The current theme's colours for the current scheme. Same as `useTheme()`; kept for the many screens that call it. */
export function useColors() {
  return useTheme();
}

/** The outline and shadow the theme gives cards and tiles; empty for a flat theme. */
export function cardChrome(c: ResolvedTheme): ViewStyle {
  const { borderWidth, shadow } = c.shape;
  return {
    ...(borderWidth ? { borderWidth, borderColor: c.line } : c.cardOutline ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardOutline } : null),
    ...(shadow === 'offset' ? { boxShadow: `4px 4px 0px ${c.line}` } : shadow === 'soft' ? { boxShadow: `0px 1px 2px ${c.shadow}, 0px 6px 18px ${c.shadow}` } : null),
  };
}

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const c = useColors();
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color ?? c.text} />;
}

export function Screen({ children, style, edges }: { children: ReactNode; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  const c = useColors();
  return (
    <SafeAreaView edges={edges ?? ['top', 'left', 'right']} style={[styles.screen, { backgroundColor: c.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text }, style]}>{children}</Text>;
}

export function Heading({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.heading, { color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, numberOfLines }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.body, { color: muted ? c.textSecondary : c.text }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const base = [styles.card, { backgroundColor: c.backgroundElement, borderRadius: c.shape.cardRadius }, cardChrome(c), style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function Row({ children, style, between }: { children: ReactNode; style?: StyleProp<ViewStyle>; between?: boolean }) {
  return <View style={[styles.row, between && styles.between, style]}>{children}</View>;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  busy,
  style,
  ...props
}: PressableProps & { title: string; variant?: 'primary' | 'secondary' | 'danger'; icon?: string; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : c.backgroundElement;
  const fg = variant === 'secondary' ? c.text : c.onAccent;
  const textColor = variant === 'danger' ? c.onDanger : fg;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || props.disabled}
      {...props}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed || props.disabled ? 0.6 : 1 }, style]}>
      {busy ? <ActivityIndicator color={textColor} /> : null}
      {!busy && icon ? <MaterialCommunityIcons name={icon as IconName} size={18} color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accent : c.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.chipText, { color: selected ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon as IconName} size={44} color={c.textSecondary} />
      <Heading style={{ marginTop: 12, textAlign: 'center' }}>{title}</Heading>
      {body ? (
        <Body muted style={{ textAlign: 'center', marginTop: 6 }}>
          {body}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  card: { borderRadius: 16, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { justifyContent: 'space-between' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
});
