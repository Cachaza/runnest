import { useAppTheme } from '@/components/ThemeContext';

export function useColorScheme() {
  const { colorScheme } = useAppTheme();

  return colorScheme;
}
