import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';

import Colors from '@/constants/Colors';

export type AppColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  colorScheme: AppColorScheme;
  colors: typeof Colors.light;
  isDark: boolean;
  setTheme: (theme: AppColorScheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const themeVariables = {
  dark: vars({
    '--color-background': '13 18 24',
    '--color-badge-cool': '53 73 92',
    '--color-badge-neutral': '41 53 65',
    '--color-badge-warm': '189 231 94',
    '--color-border': '44 57 71',
    '--color-chip': '36 49 65',
    '--color-danger': '255 115 115',
    '--color-danger-surface': '59 30 36',
    '--color-hero': '21 50 74',
    '--color-hero-accent': '199 244 100',
    '--color-hero-text': '255 255 255',
    '--color-hero-text-muted': '215 224 234',
    '--color-input-bg': '18 26 35',
    '--color-muted-text': '170 180 192',
    '--color-on-accent': '21 50 74',
    '--color-on-tint': '21 50 74',
    '--color-success': '169 217 90',
    '--color-surface': '26 30 34',
    '--color-text': '246 247 251',
    '--color-tint': '199 244 100',
  }),
  light: vars({
    '--color-background': '246 247 251',
    '--color-badge-cool': '220 232 242',
    '--color-badge-neutral': '239 243 246',
    '--color-badge-warm': '234 251 193',
    '--color-border': '228 233 239',
    '--color-chip': '237 242 246',
    '--color-danger': '201 67 67',
    '--color-danger-surface': '252 236 236',
    '--color-hero': '21 50 74',
    '--color-hero-accent': '199 244 100',
    '--color-hero-text': '255 255 255',
    '--color-hero-text-muted': '215 224 234',
    '--color-input-bg': '255 255 255',
    '--color-muted-text': '92 102 115',
    '--color-on-accent': '21 50 74',
    '--color-on-tint': '21 50 74',
    '--color-success': '107 157 36',
    '--color-surface': '255 255 255',
    '--color-text': '26 30 34',
    '--color-tint': '199 244 100',
  }),
};

function normalizeScheme(scheme: ReturnType<typeof useSystemColorScheme>): AppColorScheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = normalizeScheme(useSystemColorScheme());
  const [colorScheme, setColorScheme] = useState<AppColorScheme>(systemScheme);
  const [hasManualChoice, setHasManualChoice] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme-preference').then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        setColorScheme(saved);
        setHasManualChoice(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!hasManualChoice) {
      setColorScheme(systemScheme);
    }
  }, [hasManualChoice, systemScheme]);

  const setTheme = useCallback((theme: AppColorScheme) => {
    setHasManualChoice(true);
    setColorScheme(theme);
    AsyncStorage.setItem('theme-preference', theme).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setHasManualChoice(true);
    setColorScheme((current) => {
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('theme-preference', nextTheme).catch(() => {});
      return nextTheme;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      colors: Colors[colorScheme],
      isDark: colorScheme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [colorScheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={themeVariables[colorScheme]} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  const fallbackScheme = normalizeScheme(useSystemColorScheme());

  if (context) {
    return context;
  }

  return {
    colorScheme: fallbackScheme,
    colors: Colors[fallbackScheme],
    isDark: fallbackScheme === 'dark',
    setTheme: () => undefined,
    toggleTheme: () => undefined,
  };
}
