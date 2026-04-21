import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { useAppHeaderOptions } from '@/components/useAppHeaderOptions';

export default function TabLayout() {
  const { colors, isDark } = useAppTheme();
  const headerOptions = useAppHeaderOptions();

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
        ...headerOptions,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color }) => <FontAwesome6 name="calendar-day" size={20} color={color} />,
          headerRight: () => (
            <View style={styles.headerActions}>
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
          tabBarIcon: ({ color }) => <FontAwesome6 name="users-line" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <FontAwesome6 name="circle-user" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
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
