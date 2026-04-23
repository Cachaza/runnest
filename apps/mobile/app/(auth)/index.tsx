import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';

const HERO_CHIPS = ['Salidas', 'Apuntes', 'Sin WhatsApp'];

const FEATURES = [
  {
    icon: 'users',
    title: 'Tu grupo',
    body: 'Organiza salidas con la gente con la que ya corres. Sin pasar por WhatsApp.',
  },
  {
    icon: 'calendar-day',
    title: 'Quedadas',
    body: 'Crea una salida, mira quién se apunta y listo. Desde el móvil en dos segundos.',
  },
  {
    icon: 'share-nodes',
    title: 'Códigos',
    body: 'Comparte un código. Cualquiera del grupo entra directo, sin pedir permiso.',
  },
] as const;

export default function LandingScreen() {
  const { colors } = useAppTheme();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-[18px] pb-12 pt-14">
        {/* Hero */}
        <View className="rounded-[34px] bg-hero px-7 pb-8 pt-6">
          <Text className="text-[11px] font-black uppercase tracking-[2px] text-hero-accent">
            AppRunners
          </Text>
          <Text className="mt-5 text-[42px] font-black leading-[46px] text-hero-text">
            Coordina{'\n'}las quedadas{'\n'}del grupo.
          </Text>
          <Text className="mt-3 text-[16px] leading-[25px] text-hero-text-muted">
            Dónde quedamos, a qué hora y quién viene. Todo aquí en la app.
          </Text>
          <View className="mt-5 flex-row flex-wrap gap-2">
            {HERO_CHIPS.map((chip) => (
              <View key={chip} className="rounded-full bg-hero-accent px-3 py-2">
                <Text className="text-xs font-black uppercase tracking-[0.4px] text-on-accent">
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Features */}
        <View className="gap-3">
          {FEATURES.map((feature) => (
            <View
              key={feature.title}
              className="flex-row gap-4 rounded-[24px] border border-border bg-surface p-5">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-hero-accent">
                <FontAwesome6 name={feature.icon} size={18} color={colors.onAccent} />
              </View>
              <View className="flex-1">
                <Text className="text-[17px] font-black text-text">{feature.title}</Text>
                <Text className="mt-1 text-[14px] leading-[20px] text-muted-text">
                  {feature.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="mt-4 gap-4">
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="items-center rounded-[20px] bg-tint py-[18px]">
            <Text className="text-[16px] font-black text-on-tint">Empezar</Text>
          </Pressable>

          <View className="flex-row justify-center gap-1.5">
            <Text className="text-[13px] text-muted-text">¿Ya tienes cuenta?</Text>
            <Pressable hitSlop={6} onPress={() => router.push('/(auth)/sign-in')}>
              <Text className="text-[13px] font-black text-tint">Iniciar sesión</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
