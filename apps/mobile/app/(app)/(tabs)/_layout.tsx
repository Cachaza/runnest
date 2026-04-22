import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ThemeContext';
import { useAppHeaderOptions } from '@/components/useAppHeaderOptions';

type TabIconName = React.ComponentProps<typeof FontAwesome6>['name'];

const TAB_META: Record<string, { icon: TabIconName; title: string }> = {
  index: { icon: 'calendar-day', title: 'Hoy' },
  communities: { icon: 'users', title: 'Comunidades' },
  profile: { icon: 'circle-user', title: 'Perfil' },
};

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomOffset = Math.max(insets.bottom, Platform.select({ ios: 18, default: 14 }) ?? 14);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarWrapper, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.tabBarPill,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(92,72,51,0.08)',
            shadowColor: isDark ? '#000' : '#5C4833',
            shadowOpacity: isDark ? 0.45 : 0.16,
          },
        ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const meta = TAB_META[route.name];
          if (!meta) {
            return null;
          }
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? meta.title;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.tabItem,
                focused ? { backgroundColor: colors.tint } : null,
                { opacity: pressed ? 0.85 : 1 },
              ]}>
              <FontAwesome6
                name={meta.icon}
                size={focused ? 16 : 18}
                color={focused ? colors.onTint : colors.tabIconDefault}
                solid
              />
              {focused ? (
                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, { color: colors.onTint }]}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useAppTheme();
  const headerOptions = useAppHeaderOptions();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        ...headerOptions,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
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
                      <Text style={[styles.newMeetupText, { color: colors.onTint }]}>+ Quedada</Text>
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
          title: 'Comunidades',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Link href="/community-access" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.newMeetupButton,
                        {
                          backgroundColor: colors.chip,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <Text style={[styles.newMeetupText, { color: colors.text }]}>Código</Text>
                    </View>
                  )}
                </Pressable>
              </Link>
              <Link href="/community-new" asChild>
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
                      <Text style={[styles.newMeetupText, { color: colors.onTint }]}>+ Comunidad</Text>
                    </View>
                  )}
                </Pressable>
              </Link>
            </View>
          ),
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
  tabBarWrapper: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
  },
  tabBarPill: {
    borderWidth: 1,
    borderRadius: 999,
    elevation: 16,
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  tabItem: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
