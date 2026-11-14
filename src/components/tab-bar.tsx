/**
 * The tab bar from the Butter design: a pill that floats above the bottom of
 * the screen, icons only, the current tab sitting in a butter capsule. Tab
 * screens leave TAB_BAR_SPACE at the bottom of their scroll content so the
 * last row is never hidden under it.
 */

import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { alpha } from '@/lib/cube/appearance';

import { Icon, cardChrome, useColors } from './ui';

/** Icon per tab route, by its file name in src/app/(tabs). */
const TAB_ICONS: Record<string, string> = {
  index: 'home-outline',
  network: 'wifi',
  settings: 'cog-outline',
};

/** Bottom padding a tab screen's scroll content needs to clear the bar. */
export const TAB_BAR_SPACE = 120;

export function PillTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const c = useColors();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          { backgroundColor: c.tabBar },
          // Hard-edged themes give the bar their outline and offset shadow; soft ones a wide blur.
          c.shape.shadow === 'offset' ? cardChrome(c) : { boxShadow: `0px 8px 28px ${c.tabShadow}` },
          c.shape.shadow !== 'offset' && c.cardOutline ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardOutline } : null,
        ]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [
                styles.tab,
                focused ? { backgroundColor: c.state.on } : null,
                focused && c.shape.borderWidth ? { borderWidth: 2, borderColor: c.line, borderRadius: c.shape.well.radius } : null,
                focused && c.glow ? { boxShadow: `0px 0px 16px ${alpha(c.state.on, c.glow * 0.6)}` } : null,
                { opacity: pressed ? 0.7 : 1 },
              ]}>
              <Icon name={TAB_ICONS[route.name] ?? 'circle-outline'} size={22} color={focused ? c.onState.on : c.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 44, right: 44 },
  pill: { flexDirection: 'row', justifyContent: 'space-around', padding: 8, borderRadius: 30 },
  tab: { width: 64, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
