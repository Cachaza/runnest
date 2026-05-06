import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';

import Colors from '@/constants/Colors';
import { hexToRgbTriplet } from '@/lib/colors';

export type AppColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  colorScheme: AppColorScheme;
  colors: typeof Colors.light;
  isDark: boolean;
  setTheme: (theme: AppColorScheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ColorToken = keyof typeof Colors.light;

const cssVariableByToken: Record<ColorToken, `--color-${string}`> = {
  background: '--color-background',
  accentBorder: '--color-accent-border',
  badgeCool: '--color-badge-cool',
  badgeNeutral: '--color-badge-neutral',
  badgeWarm: '--color-badge-warm',
  border: '--color-border',
  chip: '--color-chip',
  danger: '--color-danger',
  dangerSurface: '--color-danger-surface',
  elevatedSurface: '--color-elevated-surface',
  hero: '--color-hero',
  heroAccent: '--color-hero-accent',
  heroOverlay: '--color-hero-overlay',
  heroText: '--color-hero-text',
  heroTextMuted: '--color-hero-text-muted',
  inputBg: '--color-input-bg',
  mutedText: '--color-muted-text',
  onAccent: '--color-on-accent',
  onTint: '--color-on-tint',
  shadow: '--color-shadow',
  success: '--color-success',
  surface: '--color-surface',
  tabIconDefault: '--color-tab-icon-default',
  tabIconSelected: '--color-tab-icon-selected',
  text: '--color-text',
  tint: '--color-tint',
};

function createThemeVariables(colors: typeof Colors.light) {
  return vars(
    Object.entries(cssVariableByToken).reduce<Record<string, string>>((themeVars, [token, variable]) => {
      themeVars[variable] = hexToRgbTriplet(colors[token as ColorToken]);
      return themeVars;
    }, {}),
  );
}

const themeVariables = {
  dark: createThemeVariables(Colors.dark),
  light: createThemeVariables(Colors.light),
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
