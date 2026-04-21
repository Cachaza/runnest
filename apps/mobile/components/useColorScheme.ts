import { useAppTheme } from '@/components/ThemeContext';

export const useColorScheme = () => {
  const { colorScheme } = useAppTheme();

  return colorScheme;
};
