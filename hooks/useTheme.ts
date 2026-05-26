import { useCallback, useEffect, useState } from 'react';
import { useColorScheme as useNwColorScheme } from 'nativewind';
import { storage } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'color_scheme';

function readStoredPreference(): ThemePreference {
  const raw = storage.getString(KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

/**
 * Mount once at the root to apply the persisted preference. Idempotent.
 */
export function useThemeBootstrap() {
  const { setColorScheme } = useNwColorScheme();
  useEffect(() => {
    setColorScheme(readStoredPreference());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Full control of the theme preference. Use in the Profile screen and
 * anywhere else that needs to *change* the preference (not just read).
 */
export function useTheme() {
  const { colorScheme, setColorScheme } = useNwColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    storage.set(KEY, pref);
    setColorScheme(pref);
  }, [setColorScheme]);

  return {
    preference,
    setPreference,
    scheme: (colorScheme ?? 'light') as 'light' | 'dark',
  };
}
