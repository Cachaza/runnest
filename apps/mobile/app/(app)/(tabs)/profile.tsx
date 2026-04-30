import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppCard,
  AppButton,
  Chip,
  EmptyState,
  ScreenScroll,
  SectionHeader,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

function listFromCommaValue(value?: string | null) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function formatDayMonth(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const day = new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' })
    .format(date)
    .toUpperCase();
  const time = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return { day, month, time };
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();

  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const hasProfile = Boolean(profile);

  const publicProfileQuery = trpc.profile.publicByUsername.useQuery(
    { username: profile?.username ?? '' },
    { enabled: !!profile?.username, retry: false },
  );
  const publicProfile = publicProfileQuery.data?.profile;
  const upcomingMeetups = publicProfileQuery.data?.upcomingMeetups ?? [];

  const membershipsQuery = trpc.communities.myMemberships.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const communitiesCount = membershipsQuery.data?.length ?? 0;

  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    const refreshedProfile = await profileQuery.refetch();
    const refreshedUsername = refreshedProfile.data?.profile?.username;
    await membershipsQuery.refetch();
    if (refreshedUsername) {
      await publicProfileQuery.refetch();
    }
  });

  const initials = (
    profile?.username?.[0] ??
    session?.user.name?.[0] ??
    'R'
  ).toUpperCase();

  const subtitle = profile
    ? [profile.city, profile.pace].filter(Boolean).join(' · ')
    : null;

  const goals = listFromCommaValue(publicProfile?.goals);

  return (
    <ScreenScroll onRefresh={hasProfile ? onRefresh : undefined} refreshing={refreshing}>
      {/* Top row: settings + edit */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push('/settings' as any)}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
          <FontAwesome6 name="gear" size={18} color={colors.mutedText} />
        </Pressable>
        {hasProfile ? (
          <Pressable
            onPress={() => router.push('/profile-edit' as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            className="rounded-full border border-border bg-surface px-4 py-2">
            <Text className="text-[13px] font-black text-text">Editar perfil</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Avatar + identity */}
      <View className="items-center gap-3 pt-2">
        {/* Avatar */}
        <View className="relative">
          <View
            className="h-[90px] w-[90px] items-center justify-center rounded-full"
            style={{ backgroundColor: colors.chip }}>
            <Text className="text-[34px] font-black" style={{ color: colors.text }}>
              {initials}
            </Text>
          </View>
          <View
            className="absolute bottom-1 right-1 h-[15px] w-[15px] rounded-full border-2"
            style={{ backgroundColor: '#5EA88A', borderColor: colors.background }}
          />
        </View>

        {/* Username */}
        <Text className="text-[28px] font-black text-text">
          {profile?.username ? `@${profile.username}` : session?.user.name ?? 'Runner'}
        </Text>

        {/* Location · pace */}
        {subtitle ? (
          <Text className="text-[14px] text-muted-text">{subtitle}</Text>
        ) : null}

        {/* Level / pace / distance chips */}
        {publicProfile ? (
          <View className="flex-row flex-wrap justify-center gap-2">
            {publicProfile.level ? <Chip tone="warm">{publicProfile.level}</Chip> : null}
            {publicProfile.pace ? <Chip tone="cool">{publicProfile.pace}</Chip> : null}
            {publicProfile.distance ? (
              <Chip tone="neutral">{publicProfile.distance}</Chip>
            ) : null}
          </View>
        ) : null}

        {/* Goals chips */}
        {goals.length > 0 ? (
          <View className="flex-row flex-wrap justify-center gap-2">
            {goals.map((goal) => (
              <Chip key={goal}>{goal}</Chip>
            ))}
          </View>
        ) : null}
      </View>

      {/* No-profile CTA */}
      {!hasProfile && !profileQuery.isPending ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Completa tu perfil</Text>
          <Text className="text-[15px] leading-[22px] text-muted-text">
            Ciudad, ritmo y disponibilidad. Así el grupo te conoce y sabe quién corre contigo.
          </Text>
          <AppButton onPress={() => router.push('/profile-edit' as any)} style={{ marginTop: 4 }}>
            Empezar ahora
          </AppButton>
        </AppCard>
      ) : null}

      {hasProfile ? (
        <>
          {/* Stats row */}
          <View
            className="flex-row overflow-hidden rounded-card border border-border bg-surface">
            <StatCell label="Quedadas" value={upcomingMeetups.length} />
            <View className="w-[1px] bg-border" />
            <StatCell label="Comunidades" value={communitiesCount} />
            {publicProfile?.pace ? (
              <>
                <View className="w-[1px] bg-border" />
                <StatCell label="Ritmo" value={publicProfile.pace} />
              </>
            ) : null}
          </View>

          {/* Bio */}
          {profile?.bio ? (
            <>
              <SectionHeader title="Sobre mí" />
              <Text className="px-1 text-[15px] leading-[22px] text-muted-text">
                {profile.bio}
              </Text>
            </>
          ) : null}

          {/* Upcoming meetups */}
          <SectionHeader
            title="Mis próximas quedadas"
            right={
              <Link href={'/quedadas' as any} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Text className="text-[13px] font-black text-tint">Ver todas</Text>
                </Pressable>
              </Link>
            }
          />

          {upcomingMeetups.length === 0 &&
          !publicProfileQuery.isPending ? (
            <EmptyState
              title="Sin quedadas próximas."
              body="Cuando te apuntes a una salida, aparecerá aquí."
            />
          ) : null}

          {upcomingMeetups.map((meetup) => {
            const { day, month, time } = formatDayMonth(meetup.startsAt);
            return (
              <Link key={meetup.id} href={`/meetup/${meetup.id}` as any} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                  <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
                    <View className="w-10 items-center">
                      <Text className="text-[22px] font-black leading-[26px] text-text">
                        {day}
                      </Text>
                      <Text className="text-[10px] font-black uppercase tracking-[0.5px] text-tint">
                        {month}
                      </Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className="text-[16px] font-black leading-[20px] text-text"
                        numberOfLines={1}>
                        {meetup.title}
                      </Text>
                      <Text className="text-[12px] font-bold text-muted-text" numberOfLines={1}>
                        {meetup.distanceKm} km · {meetup.location} · {time}
                      </Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={13} color={colors.mutedText} />
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </>
      ) : null}
    </ScreenScroll>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center gap-1 py-4">
      <Text className="text-[26px] font-black leading-[30px] text-text">{value}</Text>
      <Text className="text-[11px] font-bold text-muted-text">{label}</Text>
    </View>
  );
}
