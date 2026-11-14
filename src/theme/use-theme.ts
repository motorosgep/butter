/** The theme in effect right now, with light or dark already resolved. */

import { useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { useAppearance } from './preferences';
import { DEFAULT_THEME, THEMES } from './themes';
import type { ResolvedTheme, Scheme } from './types';

export function useTheme(): ResolvedTheme {
  const id = useAppearance((s) => s.theme);
  const mode = useAppearance((s) => s.mode);
  const phone = useColorScheme();
  const scheme: Scheme = mode === 'system' ? (phone === 'dark' ? 'dark' : 'light') : mode;
  const theme = THEMES[id] ?? THEMES[DEFAULT_THEME];
  return useMemo(() => ({ ...theme.schemes[scheme], scheme, theme, shape: theme.shape, fonts: theme.fonts }), [theme, scheme]);
}
