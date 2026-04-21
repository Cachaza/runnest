import { Link, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppCard, Chip, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { trpc } from '@/lib/trpc';

function formatMeetupLabel(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

export default function CrewDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const crewId = rawId ? Number(rawId) : null;
  const utils = trpc.useUtils();
  const crewQuery = trpc.crews.byId.useQuery(
    { id: crewId ?? 0 },
    {
      enabled: Boolean(crewId),
      retry: false,
    },
  );
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      if (crewId) {
        await utils.crews.byId.invalidate({ id: crewId });
      }

      await utils.meetups.upcoming.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      if (crewId) {
        await utils.crews.byId.invalidate({ id: crewId });
      }

      await utils.meetups.upcoming.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const crew = crewQuery.data?.crew;
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  if (crewQuery.error) {
    return (
      <ScreenScroll>
        <AppCard>
          <Text className="text-[25px] font-black text-text">Crew no disponible</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{crewQuery.error.message}</Text>
        </AppCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <HeroPanel
        body={crew?.description ?? 'Cargando detalle de la crew...'}
        kicker={crew?.city ?? 'Crew'}
        title={crew?.name ?? 'Cargando...'}>
        {crew ? (
          <View className="mt-5 flex-row flex-wrap gap-2.5">
            <Chip tone="cool">{crew.pace}</Chip>
            <Chip tone="neutral">{crew.vibe}</Chip>
          </View>
        ) : null}
      </HeroPanel>

      <SectionHeader loading={crewQuery.isPending} title="Próximas quedadas" />

      {!crewQuery.isPending && crewQuery.data?.upcomingMeetups.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Sin quedadas futuras.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando esta crew publique una salida o preparación de carrera, aparecerá aquí.
          </Text>
        </AppCard>
      ) : null}

      {crewQuery.data?.upcomingMeetups.map((meetup) => (
        <AppCard key={meetup.id}>
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">
            {formatMeetupLabel(meetup.startsAt)}
          </Text>
          <Text className="text-[22px] font-black text-text">{meetup.title}</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            {meetup.distanceKm} km · {meetup.location}
          </Text>
          <View className="mt-1 flex-row items-center justify-between gap-3">
            <Text className="text-sm font-bold text-muted-text">{meetup.rsvpCount} apuntados</Text>
            <Pressable
              disabled={isMutatingRsvp}
              onPress={() => handleMeetupAction(meetup.id, meetup.viewerIsGoing)}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingRsvp ? 0.7 : 1 })}
              className="rounded-2xl bg-chip px-4 py-3">
              <Text className="text-sm font-black text-text">
                {meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
              </Text>
            </Pressable>
          </View>
        </AppCard>
      ))}

      <SectionHeader loading={crewQuery.isPending} title="Runners en esta crew" />

      {!crewQuery.isPending && crewQuery.data?.activeRunners.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Aún sin runners públicos.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Los runners aparecerán cuando creen o confirmen quedadas de esta crew.
          </Text>
        </AppCard>
      ) : null}

      {crewQuery.data?.activeRunners.map((runner) => (
        <Link key={runner.id} href={`/runner/${runner.username}` as any} asChild>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <AppCard>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">@{runner.username}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    {[runner.area, runner.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
                  </Text>
                </View>
                {runner.level ? <Chip tone="warm">{runner.level}</Chip> : null}
              </View>
              <View className="mt-0.5 flex-row flex-wrap gap-2.5">
                <Chip tone="cool">{runner.pace}</Chip>
                {runner.goals ? <Chip tone="neutral">{runner.goals.split(',')[0].trim()}</Chip> : null}
              </View>
            </AppCard>
          </Pressable>
        </Link>
      ))}
    </ScreenScroll>
  );
}
