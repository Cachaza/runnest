import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';

type HeaderBackButtonProps = {
  onPress: () => void;
};

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel="Volver"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View
        className="flex-row items-center gap-2 rounded-full border px-3 py-2"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}>
        <FontAwesome6 name="chevron-left" size={13} color={colors.text} />
        <Text className="text-xs font-black uppercase tracking-[0.6px] text-text">Volver</Text>
      </View>
    </Pressable>
  );
}
