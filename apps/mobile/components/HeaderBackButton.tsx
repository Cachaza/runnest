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
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View className="flex-row items-center gap-1.5 px-1 py-1">
        <FontAwesome6 name="chevron-left" size={14} color={colors.tint} />
        <Text className="text-[14px] font-black text-tint">Volver</Text>
      </View>
    </Pressable>
  );
}
