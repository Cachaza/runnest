import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppCard,
  Chip,
  EmptyState,
  ScreenScroll,
  SectionHeader,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import {
  labelForMeetupStyle,
} from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

function formatDayMonth(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const day = new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).toUpperCase();
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
  return { day, month, time };
}

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const viewerMeetupsQuery = trpc.meetups.upcomingForViewer.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const myMembershipsQuery = trpc.communities.myMemberships.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });

  const profile = profileQuery.data?.profile;
  const nextMeetup = viewerMeetupsQuery.data?.[0];
  const upcomingMeetups = viewerMeetupsQuery.data?.slice(1, 4) ?? [];
  const memberships = myMembershipsQuery.data ?? [];

  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      viewerMeetupsQuery.refetch(),
      myMembershipsQuery.refetch(),
      ...(session ? [profileQuery.refetch()] : []),
    ]);
  });

  return (
    <ScreenScroll onRefresh={onRefresh} refreshing={refreshing}>
      {/* Hero */}
      <View className="gap-5 rounded-hero bg-hero p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.9px] text-hero-accent">Hoy</Text>
            <Text className="mt-2 text-[28px] font-black leading-[31px] text-hero-text">
              Hola, {session?.user.name?.split(' ')[0] ?? 'runner'}.
            </Text>
            <Text className="mt-1 text-[15px] leading-[21px] text-hero-text-muted">
              Aquí ves la próxima salida y quién se apunta.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Notificaciones"
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 999,
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            })}>
            <FontAwesome6 name="bell" size={16} color={colors.heroAccent} />
          </Pressable>
        </View>

        {/* Quick actions */}
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => router.push('/modal' as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            className="flex-1 items-center gap-2 rounded-card border border-tint/30 bg-tint px-3 py-3">
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <FontAwesome6 name="plus" size={15} color={colors.onTint} solid />
            </View>
            <Text className="text-[11px] font-black text-on-tint">Quedada</Text>
          </Pressable>
          <Link href="/community-access" asChild>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="flex-1 items-center gap-2 rounded-card border border-white/10 px-3 py-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <FontAwesome6 name="key" size={15} color={colors.heroText} solid />
              </View>
              <Text className="text-[11px] font-black text-hero-text">Código</Text>
            </Pressable>
          </Link>
          <Link href="/communities" asChild>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="flex-1 items-center gap-2 rounded-card border border-white/10 px-3 py-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <FontAwesome6 name="users" size={15} color={colors.heroText} solid />
              </View>
              <Text className="text-[11px] font-black text-hero-text">Grupos</Text>
            </Pressable>
          </Link>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-card border border-white/10 px-4 py-3">
            {myMembershipsQuery.isPending ? (
              <ActivityIndicator color={colors.heroAccent} size="small" />
            ) : (
              <Text className="text-[24px] font-black leading-7 text-hero-text">{memberships.length}</Text>
            )}
            <Text className="mt-1 text-[12px] font-bold text-hero-text-muted">Comunidades</Text>
          </View>
          <View className="flex-1 rounded-card border border-white/10 px-4 py-3">
            {viewerMeetupsQuery.isPending ? (
              <ActivityIndicator color={colors.heroAccent} size="small" />
            ) : (
              <Text className="text-[24px] font-black leading-7 text-hero-text">
                {viewerMeetupsQuery.data?.length ?? 0}
              </Text>
            )}
            <Text className="mt-1 text-[12px] font-bold text-hero-text-muted">Esta semana</Text>
          </View>
        </View>
      </View>

      {/* Próxima quedada card */}
      {viewerMeetupsQuery.isPending ? (
        <AppCard>
          <View className="flex-row items-center gap-2.5">
            <ActivityIndicator color={colors.tint} />
            <Text className="text-[15px] font-bold text-muted-text">Cargando próximas quedadas...</Text>
          </View>
        </AppCard>
      ) : nextMeetup ? (
        <AppCard>
          <Text className="text-[11px] font-black uppercase tracking-[0.9px] text-tint">
            La próxima del grupo
          </Text>
          <View className="mt-1 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[22px] font-black leading-[26px] text-text">{nextMeetup.title}</Text>
              <Text className="mt-1 text-[14px] leading-[20px] text-muted-text">
                {nextMeetup.communityName} · {nextMeetup.location}
              </Text>
            </View>
            {(() => {
              const { day, month, time } = formatDayMonth(nextMeetup.startsAt);
              return (
                <View className="items-center rounded-card bg-chip px-3 py-2">
                  <Text className="text-[19px] font-black leading-[22px] text-text">{day}</Text>
                  <Text className="text-[10px] font-black uppercase tracking-[0.4px] text-tint">{month}</Text>
                  <Text className="text-[11px] font-bold text-muted-text">{time}</Text>
                </View>
              );
            })()}
          </View>
          <View className="mt-1 flex-row flex-wrap gap-2">
            <Chip tone={nextMeetup.communityMode === 'managed' ? 'warm' : 'cool'}>
              {labelForMeetupStyle(nextMeetup.communityMode)}
            </Chip>
            <Chip tone="neutral">{nextMeetup.distanceKm} km</Chip>
            <Chip tone="neutral">{nextMeetup.rsvpCount} apuntados</Chip>
          </View>
          <View className="mt-2 flex-row gap-2.5">
            <Link href={`/meetup/${nextMeetup.id}` as any} asChild>
              <Pressable
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                className="flex-1 items-center rounded-[18px] bg-tint py-[13px]">
                <Text className="text-[14px] font-black text-on-tint">Ver quedada</Text>
              </Pressable>
            </Link>
            <Link href="/community-access" asChild>
              <Pressable
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                className="flex-1 items-center rounded-[18px] bg-chip py-[13px]">
                <Text className="text-[14px] font-black text-text">Entrar con código</Text>
              </Pressable>
            </Link>
          </View>
        </AppCard>
      ) : (
        <AppCard>
          <Text className="text-[11px] font-black uppercase tracking-[0.9px] text-tint">
            La próxima del grupo
          </Text>
          <Text className="mt-1 text-[22px] font-black leading-[26px] text-text">Sin salidas próximas.</Text>
          <Text className="text-[14px] leading-[20px] text-muted-text">
            Crea una salida o entra en un grupo para que aparezcan aquí.
          </Text>
          <View className="mt-2 flex-row gap-2.5">
            <Link href="/community-access" asChild>
              <Pressable
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                className="flex-1 items-center rounded-[18px] bg-tint py-[13px]">
                <Text className="text-[14px] font-black text-on-tint">Entrar con código</Text>
              </Pressable>
            </Link>
          </View>
        </AppCard>
      )}

      {/* Próximas quedadas list */}
      {session && upcomingMeetups.length > 0 ? (
        <>
          <SectionHeader
            title="Tus próximas quedadas"
            right={
              <Link href={'/quedadas' as any} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Text className="text-[13px] font-black text-tint">Ver todas</Text>
                </Pressable>
              </Link>
            }
          />
          {upcomingMeetups.map((meetup) => {
            const { day, month, time } = formatDayMonth(meetup.startsAt);
            return (
              <Link key={meetup.id} href={`/meetup/${meetup.id}` as any} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                  <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
                    <View className="w-10 items-center">
                      <Text className="text-[22px] font-black leading-[26px] text-text">{day}</Text>
                      <Text className="text-[10px] font-black uppercase tracking-[0.5px] text-tint">{month}</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[16px] font-black leading-[20px] text-text" numberOfLines={1}>
                        {meetup.title}
                      </Text>
                      <Text className="text-[12px] font-bold text-muted-text" numberOfLines={1}>
                        {time} · {meetup.distanceKm} km · {meetup.location}
                      </Text>
                    </View>
                    <View className={`rounded-full px-3 py-2 ${meetup.viewerIsGoing ? 'bg-tint' : 'bg-chip'}`}>
                      <Text className={`text-[11px] font-black ${meetup.viewerIsGoing ? 'text-on-tint' : 'text-text'}`}>
                        {meetup.viewerIsGoing ? 'Salgo' : 'Me apunto'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </>
      ) : null}

      {/* Profile card */}
      <AppCard>
        {profileQuery.isPending ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Link href="/profile" asChild>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[17px] font-black text-text">
                  {profile ? 'Perfil completo' : 'Completa tu perfil'}
                </Text>
                <Text className="mt-0.5 text-[14px] leading-[20px] text-muted-text">
                  {profile
                    ? `${profile.city} · ${profile.pace}${profile.availability ? ` · ${profile.availability}` : ''}`
                    : 'Gestiona tu actividad y preferencias.'}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={13} color={colors.mutedText} />
            </Pressable>
          </Link>
        )}
      </AppCard>
    </ScreenScroll>
  );
}
