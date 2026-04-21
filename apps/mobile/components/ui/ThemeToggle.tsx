import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '@/components/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useAppTheme();
  const translateX = useSharedValue(isDark ? 40 : 4);

  useEffect(() => {
    translateX.value = withSpring(isDark ? 40 : 4, {
      damping: 16,
      stiffness: 170,
    });
  }, [isDark, translateX]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      accessibilityLabel="Cambiar tema"
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      onPress={toggleTheme}
      className="h-[42px] w-[84px] flex-row gap-1.5 rounded-full border border-border bg-chip px-1 py-[3px]">
      <Animated.View
        className="absolute left-0 top-[3px] h-[34px] w-[34px] rounded-[17px] bg-surface"
        style={knobStyle}
      />
      <View className="z-10 h-[34px] w-[34px] items-center justify-center">
        <Text className={`text-base font-black leading-[18px] ${isDark ? 'text-muted-text' : 'text-tint'}`}>☀</Text>
      </View>
      <View className="z-10 h-[34px] w-[34px] items-center justify-center">
        <Text className={`text-base font-black leading-[18px] ${isDark ? 'text-tint' : 'text-muted-text'}`}>☾</Text>
      </View>
    </Pressable>
  );
}
