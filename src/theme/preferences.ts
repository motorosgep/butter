/**
 * The look this phone uses: which theme, and whether to follow the phone's
 * light/dark setting or force one. Saved on the phone only, so each person in
 * the house can pick their own.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { DEFAULT_THEME, isThemeId } from './themes';
import type { ColorMode, ThemeId } from './types';

const KEY = 'butter.appearance.v1';

interface Stored {
  theme: ThemeId;
  mode: ColorMode;
}

interface AppearanceState extends Stored {
  hydrated: boolean;
  hydrate(): Promise<void>;
  setTheme(theme: ThemeId): Promise<void>;
  setMode(mode: ColorMode): Promise<void>;
}

const isMode = (value: unknown): value is ColorMode => value === 'system' || value === 'light' || value === 'dark';

function parse(json: string | null): Stored {
  const fallback: Stored = { theme: DEFAULT_THEME, mode: 'system' };
  if (!json) return fallback;
  try {
    const raw = JSON.parse(json) as Partial<Record<keyof Stored, unknown>>;
    return { theme: isThemeId(raw.theme) ? raw.theme : fallback.theme, mode: isMode(raw.mode) ? raw.mode : fallback.mode };
  } catch {
    return fallback;
  }
}

export const useAppearance = create<AppearanceState>((set, get) => {
  const save = () => AsyncStorage.setItem(KEY, JSON.stringify({ theme: get().theme, mode: get().mode } satisfies Stored));
  return {
    theme: DEFAULT_THEME,
    mode: 'system',
    hydrated: false,
    async hydrate() {
      if (get().hydrated) return;
      const stored = parse(await AsyncStorage.getItem(KEY).catch(() => null));
      set({ ...stored, hydrated: true });
    },
    async setTheme(theme) {
      set({ theme });
      await save();
    },
    async setMode(mode) {
      set({ mode });
      await save();
    },
  };
});

/**
 * Tells the system which scheme the app wants, so the status bar, native
 * headers and the tab bar match a forced Light or Dark. Mount once, at the root.
 */
export function useSyncSystemScheme() {
  const mode = useAppearance((s) => s.mode);
  const hydrated = useAppearance((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode, hydrated]);
}
