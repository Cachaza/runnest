import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

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
import { labelForMeetupStyle } from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

function formatDayMonth(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const day = new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).toUpperCase();
  return { day, month };
}

function formatTime(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

type MeetupRowItem = {
  communityMode: string;
  communityName: string;
  distanceKm: number;
  id: number;
  location: string;
  rsvpCount: number;
  startsAt: string | Date;
  title: string;
  viewerIsGoing?: boolean;
};

function MeetupRow({
  meetup,
  onRsvpPress,
  isMutating,
}: {
  isMutating?: boolean;
  meetup: MeetupRowItem;
  onRsvpPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const { day, month } = formatDayMonth(meetup.startsAt);
  const time = formatTime(meetup.startsAt);

  return (
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
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          <Chip tone={meetup.communityMode === 'managed' ? 'warm' : 'cool'}>
            {labelForMeetupStyle(meetup.communityMode as any)}
          </Chip>
        </View>
      </View>
      {onRsvpPress ? (
        <Pressable
          disabled={isMutating}
          onPress={onRsvpPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutating ? 0.6 : 1 })}
          className={`rounded-full px-3 py-2 ${meetup.viewerIsGoing ? 'bg-chip' : 'bg-tint'}`}>
          <Text className={`text-[11px] font-black ${meetup.viewerIsGoing ? 'text-text' : 'text-on-tint'}`}>
            {meetup.viewerIsGoing ? 'Salgo' : 'Me apunto'}
          </Text>
        </Pressable>
      ) : (
        <Link href={`/meetup/${meetup.id}` as any} asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            className="rounded-full bg-chip px-3 py-2">
            <Text className="text-[11px] font-black text-text">Ver</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

export default function QuedadasScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const utils = trpc.useUtils();

  const viewerMeetupsQuery = trpc.meetups.upcomingForViewer.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const publicMeetupsQuery = trpc.meetups.upcomingPublic.useQuery();

  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.meetups.upcomingForViewer.invalidate(),
        utils.meetups.upcomingPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.meetups.upcomingForViewer.invalidate(),
        utils.meetups.upcomingPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar', error.message);
    },
  });

  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;

  const viewerMeetups = viewerMeetupsQuery.data ?? [];
  const publicMeetups = publicMeetupsQuery.data ?? [];
  const viewerMeetupIds = new Set(viewerMeetups.map((m) => m.id));
  const otherPublicMeetups = publicMeetups.filter((m) => !viewerMeetupIds.has(m.id));

  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      publicMeetupsQuery.refetch(),
      ...(session ? [viewerMeetupsQuery.refetch()] : []),
    ]);
  });

  async function handleRsvp(meetupId: number, viewerIsGoing: boolean) {
    if (!session) return;
    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
    } else {
      await rsvpMutation.mutateAsync({ meetupId });
    }
  }

  return (
    <ScreenScroll onRefresh={onRefresh} refreshing={refreshing}>
      <View className="gap-5 rounded-hero bg-hero p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.9px] text-hero-accent">
              Quedadas
            </Text>
            <Text className="mt-2 text-[28px] font-black leading-[31px] text-hero-text">
              Tus próximas salidas.
            </Text>
            <Text className="mt-1 text-[15px] leading-[21px] text-hero-text-muted">
              Quedadas de tus grupos y las públicas cerca de ti.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/modal' as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            className="mt-1 flex-row items-center gap-2 rounded-full bg-tint px-4 py-3">
            <FontAwesome6 name="plus" size={12} color={colors.onTint} solid />
            <Text className="text-[12px] font-black text-on-tint">Nueva</Text>
          </Pressable>
        </View>

        {session ? (
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-card border border-white/10 px-4 py-3">
              <Text className="text-[24px] font-black leading-7 text-hero-text">
                {viewerMeetups.filter((m) => m.viewerIsGoing).length}
              </Text>
              <Text className="mt-1 text-[12px] font-bold text-hero-text-muted">Confirmadas</Text>
            </View>
            <View className="flex-1 rounded-card border border-white/10 px-4 py-3">
              <Text className="text-[24px] font-black leading-7 text-hero-text">
                {viewerMeetups.length}
              </Text>
              <Text className="mt-1 text-[12px] font-bold text-hero-text-muted">De tus grupos</Text>
            </View>
          </View>
        ) : null}
      </View>

      {session ? (
        <>
          <SectionHeader
            loading={viewerMeetupsQuery.isPending}
            title="De tus grupos"
          />

          {!viewerMeetupsQuery.isPending && viewerMeetups.length === 0 ? (
            <EmptyState
              title="Sin salidas próximas."
              body="Únete a un grupo para ver aquí sus quedadas."
            />
          ) : null}

          {viewerMeetups.map((meetup) => (
            <Link key={meetup.id} href={`/meetup/${meetup.id}` as any} asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <MeetupRow
                  meetup={meetup}
                  onRsvpPress={() => handleRsvp(meetup.id, meetup.viewerIsGoing)}
                  isMutating={isMutatingRsvp}
                />
              </Pressable>
            </Link>
          ))}
        </>
      ) : null}

      <SectionHeader
        loading={publicMeetupsQuery.isPending}
        title={session ? 'Otras públicas' : 'Próximas públicas'}
      />

      {!publicMeetupsQuery.isPending && publicMeetups.length === 0 ? (
        <EmptyState
          title="Sin quedadas públicas."
          body="Cuando haya salidas públicas activas, aparecerán aquí."
        />
      ) : null}

      {(session ? otherPublicMeetups : publicMeetups).map((meetup) => (
        <Link key={meetup.id} href={`/meetup/${meetup.id}` as any} asChild>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <MeetupRow
              meetup={meetup}
              onRsvpPress={
                session
                  ? () => handleRsvp(meetup.id, (meetup as any).viewerIsGoing ?? false)
                  : undefined
              }
              isMutating={isMutatingRsvp}
            />
          </Pressable>
        </Link>
      ))}
    </ScreenScroll>
  );
}
