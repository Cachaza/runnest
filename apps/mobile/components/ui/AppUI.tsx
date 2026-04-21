import { PropsWithChildren, ReactNode } from 'react';
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
