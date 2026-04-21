import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function TabLayout() {
  const { colors, isDark } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderRadius: 24,
          bottom: Platform.select({ ios: 24, default: 16 }),
          elevation: 12,
          height: Platform.select({ ios: 72, default: 64 }),
          left: 18,
          marginHorizontal: 0,
          paddingBottom: Platform.select({ ios: 8, default: 8 }),
          paddingTop: 8,
          position: 'absolute',
          right: 18,
          shadowColor: isDark ? '#000' : '#5C4833',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerRight: () => <HeaderThemeToggle />,
        headerShadowVisible: false,
        headerTintColor: colors.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          headerRight: () => (
            <View style={styles.headerActions}>
              <ThemeToggle />
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.newMeetupButton,
                        {
                          backgroundColor: colors.tint,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <Text style={styles.newMeetupText}>+ Quedada</Text>
                    </View>
                  )}
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Crews',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}

function HeaderThemeToggle() {
  return (
    <View style={styles.headerThemeToggle}>
      <ThemeToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginRight: 15,
  },
  headerThemeToggle: {
    marginRight: 15,
  },
  newMeetupButton: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newMeetupText: {
    color: '#FFF8EC',
    fontSize: 13,
    fontWeight: '900',
  },
});
