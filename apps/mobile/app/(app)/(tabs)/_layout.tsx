import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ThemeContext';

type TabIconName = React.ComponentProps<typeof FontAwesome6>['name'];

const TAB_META: Record<string, { icon: TabIconName; title: string }> = {
  index: { icon: 'calendar-day', title: 'Hoy' },
  communities: { icon: 'users', title: 'Grupos' },
  quedadas: { icon: 'person-running', title: 'Quedadas' },
  profile: { icon: 'circle-user', title: 'Perfil' },
};

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomOffset = Math.max(insets.bottom, Platform.select({ ios: 10, default: 10 }) ?? 10);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarWrapper, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.tabBarPill,
          {
            backgroundColor: isDark ? colors.surface : 'rgba(255,248,236,0.96)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
            shadowColor: isDark ? '#000' : '#5C4833',
            shadowOpacity: isDark ? 0.5 : 0.2,
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
            <View key={route.key} style={styles.tabSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                  styles.tabItem,
                  focused
                    ? {
                        backgroundColor: 'transparent',
                        shadowColor: isDark ? '#000' : '#5C4833',
                        shadowOpacity: isDark ? 0.18 : 0.1,
                      }
                    : null,
                  { opacity: pressed ? 0.75 : 1 },
                ]}>
                <View style={styles.iconCircle}>
                  <FontAwesome6
                    name={meta.icon}
                    size={20}
                    color={focused ? colors.tabIconSelected : colors.tabIconDefault}
                    solid
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    { color: focused ? colors.tabIconSelected : colors.tabIconDefault },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Grupos',
        }}
      />
      <Tabs.Screen
        name="quedadas"
        options={{
          title: 'Quedadas',
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
  tabBarWrapper: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  tabBarPill: {
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 18,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'space-between',
    maxWidth: 380,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    width: '92%',
  },
  tabSlot: {
    alignItems: 'center',
    flex: 1,
  },
  tabItem: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 16,
    flexDirection: 'column',
    gap: 3,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    width: '100%',
  },
  iconCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  tabLabel: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
