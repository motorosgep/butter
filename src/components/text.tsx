/**
 * Text in the current theme's typeface. React Native picks a weight from the
 * family name, not from `fontWeight`, once a custom font is set; so this reads
 * the weight the style asks for and swaps in the theme's file for it. Use it
 * instead of React Native's `Text` everywhere.
 */

import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { useTheme, type Weight } from '@/theme';

const WEIGHTS: Weight[] = ['300', '400', '500', '600', '700', '800', '900'];

function normalise(weight: unknown): Weight {
  if (weight === 'bold') return '700';
  if (weight === 'normal' || weight === undefined) return '400';
  const w = String(weight) as Weight;
  return WEIGHTS.includes(w) ? w : '400';
}

export function Text({ style, ...props }: TextProps) {
  const { fonts } = useTheme();
  const family = fonts.family;
  const flat = StyleSheet.flatten(style);
  // No theme typeface, or the caller named a font itself: leave it alone.
  if (!family || flat?.fontFamily) return <RNText style={style} {...props} />;
  const wanted = normalise(flat?.fontWeight);
  // The nearest weight the theme ships, preferring heavier when equally near.
  const have = WEIGHTS.filter((w) => family[w]);
  const pick = have.reduce((best, w) => (Math.abs(+w - +wanted) < Math.abs(+best - +wanted) || (Math.abs(+w - +wanted) === Math.abs(+best - +wanted) && +w > +best) ? w : best), have[0]);
  return <RNText {...props} style={[style, { fontFamily: family[pick], fontWeight: 'normal' }]} />;
}
