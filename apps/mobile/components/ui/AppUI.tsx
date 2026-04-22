import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { PropsWithChildren, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';

type StyledChildrenProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type ScreenScrollProps = PropsWithChildren<
  ScrollViewProps & {
    contentStyle?: StyleProp<ViewStyle>;
    onRefresh?: () => void;
    refreshing?: boolean;
  }
>;

type HeroPanelProps = {
  body?: string;
  children?: ReactNode;
  kicker: string;
  title: string;
};

type SectionHeaderProps = {
  loading?: boolean;
  right?: ReactNode;
  title: string;
};

type ChipProps = {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  selected?: boolean;
  tone?: 'default' | 'warm' | 'cool' | 'neutral';
};

type EmptyStateProps = {
  body: string;
  title: string;
};

type AppButtonProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'primary' | 'secondary' | 'danger';
};

export function ScreenScroll({
  children,
  contentStyle,
  onRefresh,
  refreshControl,
  refreshing = false,
  style,
  ...props
}: ScreenScrollProps) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      alwaysBounceVertical={props.alwaysBounceVertical ?? Boolean(onRefresh ?? refreshControl)}
      className="flex-1 bg-background"
      style={style}
      contentContainerClassName="gap-4 px-[18px] pt-[18px] pb-[140px]"
      contentContainerStyle={contentStyle}
      refreshControl={
        refreshControl ??
        (onRefresh ? (
          <RefreshControl
            colors={[colors.tint]}
            onRefresh={onRefresh}
            progressBackgroundColor={colors.surface}
            refreshing={refreshing}
            tintColor={colors.tint}
          />
        ) : undefined)
      }
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}

export function HeroPanel({ body, children, kicker, title }: HeroPanelProps) {
  return (
    <View className="min-h-56 rounded-hero bg-hero p-6">
      <Text className="text-xs font-black uppercase tracking-[1.1px] text-hero-accent">{kicker}</Text>
      <Text className="mt-[18px] text-[40px] font-black leading-[44px] text-hero-text">{title}</Text>
      {body ? <Text className="mt-3.5 text-[17px] leading-[25px] text-hero-text-muted">{body}</Text> : null}
      {children}
    </View>
  );
}

export function AppCard({ children, style }: StyledChildrenProps) {
  return (
    <View className="gap-2.5 rounded-card border border-border bg-surface p-5" style={style}>
      {children}
    </View>
  );
}

export function SectionHeader({ loading, right, title }: SectionHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View className="mt-3 flex-row items-center justify-between">
      <Text className="text-[22px] font-black leading-7 text-text">{title}</Text>
      {loading ? <ActivityIndicator color={colors.tint} /> : right}
    </View>
  );
}

export function EmptyState({ body, title }: EmptyStateProps) {
  return (
    <View className="rounded-card px-5 py-4">
      <Text className="text-[17px] font-bold leading-6 text-muted-text">{title}</Text>
      <Text className="mt-1 text-[14px] leading-[21px] text-muted-text/70">{body}</Text>
    </View>
  );
}

export function Chip({ children, onPress, selected = false, tone = 'default' }: ChipProps) {
  const toneClassName = {
    cool: 'bg-badge-cool',
    default: 'bg-chip',
    neutral: 'bg-badge-neutral',
    warm: 'bg-badge-warm',
  }[tone];
  const chipClassName = `rounded-full px-3.5 py-[9px] ${selected ? 'bg-tint' : toneClassName}`;
  const textClassName = `text-xs font-black uppercase ${selected ? 'text-on-tint' : 'text-text'}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={chipClassName}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Text className={textClassName}>{children}</Text>
      </Pressable>
    );
  }

  return (
    <View className={chipClassName}>
      <Text className={textClassName}>{children}</Text>
    </View>
  );
}

export function AppButton({ children, disabled, style, tone = 'primary', ...props }: AppButtonProps) {
  const isPrimary = tone === 'primary';
  const backgroundClassName = tone === 'danger' ? 'bg-danger-surface' : isPrimary ? 'bg-tint' : 'bg-chip';
  const textClassName = tone === 'danger' ? 'text-danger' : isPrimary ? 'text-on-tint' : 'text-text';

  return (
    <Pressable
      disabled={disabled}
      className={`items-center rounded-[18px] px-4 py-[15px] ${backgroundClassName}`}
      style={({ pressed }) => [
        style,
        { opacity: pressed && !disabled ? 0.8 : disabled ? 0.5 : 1 },
      ]}
      {...props}>
      <Text className={`text-[15px] font-black ${textClassName}`}>{children}</Text>
    </Pressable>
  );
}

type SegmentedTabsOption<T extends string> = {
  badge?: number;
  label: string;
  value: T;
};

type SegmentedTabsProps<T extends string> = {
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedTabsOption<T>>;
  value: T;
};

export function SegmentedTabs<T extends string>({
  onChange,
  options,
  value,
}: SegmentedTabsProps<T>) {
  const { isDark } = useAppTheme();

  return (
    <View className="flex-row gap-1 rounded-full bg-chip p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        const badgeCount = option.badge ?? 0;
        const showBadge = badgeCount > 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2 py-2.5 ${
              isActive ? 'bg-surface' : ''
            }`}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              shadowColor: isActive ? (isDark ? '#000' : '#5C4833') : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isActive ? (isDark ? 0.3 : 0.08) : 0,
              shadowRadius: 6,
              elevation: isActive ? 2 : 0,
            })}>
            <Text
              numberOfLines={1}
              className={`text-[13px] font-black ${isActive ? 'text-text' : 'text-muted-text'}`}>
              {option.label}
            </Text>
            {showBadge ? (
              <View
                className={`min-w-[18px] items-center rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-tint' : 'bg-badge-warm'
                }`}>
                <Text
                  className={`text-[10px] font-black ${
                    isActive ? 'text-on-tint' : 'text-on-accent'
                  }`}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

type HorizontalScrollerProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function HorizontalScroller({ children, contentStyle }: HorizontalScrollerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={contentStyle}
      contentContainerClassName="gap-3 pr-2">
      {children}
    </ScrollView>
  );
}

type QuickActionProps = {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'neutral';
};

export function QuickAction({ icon, label, onPress, tone = 'neutral' }: QuickActionProps) {
  const { colors } = useAppTheme();
  const isPrimary = tone === 'primary';
  const iconColor = isPrimary ? colors.onTint : colors.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      className={`flex-1 items-center gap-2 rounded-card border border-border px-3 py-4 ${
        isPrimary ? 'bg-tint' : 'bg-surface'
      }`}>
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${isPrimary ? '' : 'bg-chip'}`}
        style={isPrimary ? { backgroundColor: 'rgba(255,255,255,0.18)' } : undefined}>
        <FontAwesome6 name={icon} size={16} color={iconColor} solid />
      </View>
      <Text
        numberOfLines={1}
        className={`text-[12px] font-black uppercase tracking-[0.5px] ${
          isPrimary ? 'text-on-tint' : 'text-text'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuickActionRow({ children }: PropsWithChildren) {
  return <View className="flex-row gap-2.5">{children}</View>;
}

type CollapsibleCardProps = PropsWithChildren<{
  badge?: number;
  defaultOpen?: boolean;
  subtitle?: string;
  title: string;
}>;

export function CollapsibleCard({
  badge,
  children,
  defaultOpen = false,
  subtitle,
  title,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { colors } = useAppTheme();
  const showBadge = typeof badge === 'number' && badge > 0;

  return (
    <View className="overflow-hidden rounded-card border border-border bg-surface">
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        className="flex-row items-center justify-between gap-3 px-5 py-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[17px] font-black text-text">{title}</Text>
            {showBadge ? (
              <View className="min-w-[22px] items-center rounded-full bg-tint px-2 py-[3px]">
                <Text className="text-[11px] font-black text-on-tint">
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text className="mt-0.5 text-[13px] font-bold text-muted-text">{subtitle}</Text>
          ) : null}
        </View>
        <FontAwesome6
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.mutedText}
        />
      </Pressable>
      {open ? <View className="gap-3 px-5 pb-5 pt-1">{children}</View> : null}
    </View>
  );
}

type MetaRowProps = {
  items: Array<{ label: string; value: string | number }>;
};

export function MetaRow({ items }: MetaRowProps) {
  return (
    <View className="flex-row flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <View key={item.label}>
          <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-muted-text">
            {item.label}
          </Text>
          <Text className="text-[17px] font-black text-text">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}
