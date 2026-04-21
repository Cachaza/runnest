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
    '--color-background': '26 20 16',
    '--color-badge-cool': '94 168 158',
    '--color-badge-neutral': '150 173 90',
    '--color-badge-warm': '217 149 62',
    '--color-border': '61 48 42',
    '--color-chip': '54 43 36',
    '--color-danger': '255 123 97',
    '--color-hero': '46 34 25',
    '--color-hero-accent': '255 179 107',
    '--color-hero-text': '255 243 228',
    '--color-hero-text-muted': '196 177 156',
    '--color-input-bg': '31 25 20',
    '--color-muted-text': '176 154 130',
    '--color-success': '142 196 133',
    '--color-surface': '38 31 26',
    '--color-text': '255 243 228',
    '--color-tint': '255 138 61',
  }),
  light: vars({
    '--color-background': '244 231 208',
    '--color-badge-cool': '167 210 203',
    '--color-badge-neutral': '221 230 184',
    '--color-badge-warm': '255 208 138',
    '--color-border': '229 207 174',
    '--color-chip': '241 217 183',
    '--color-danger': '185 71 47',
    '--color-hero': '18 50 58',
    '--color-hero-accent': '255 179 107',
    '--color-hero-text': '255 248 242',
    '--color-hero-text-muted': '201 215 216',
    '--color-input-bg': '255 248 236',
    '--color-muted-text': '116 95 72',
    '--color-success': '79 125 82',
    '--color-surface': '255 248 236',
    '--color-text': '32 32 28',
    '--color-tint': '230 95 34',
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
