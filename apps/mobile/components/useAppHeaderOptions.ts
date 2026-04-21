import { useAppTheme } from '@/components/ThemeContext';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export function useAppHeaderOptions() {
  const { colors } = useAppTheme();

  return {
    // Match the tabs header behavior on web to avoid default-looking static output.
    headerShown: useClientOnlyValue(false, true),
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text,
  };
}
