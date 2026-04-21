import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { AppCard, Chip, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
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

export default function CommunitiesScreen() {
  const { colors, isDark } = useAppTheme();
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const crewsQuery = trpc.crews.list.useQuery();
  const recommendedQuery = trpc.crews.recommended.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const meetupsQuery = trpc.meetups.upcoming.useQuery();
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      await utils.meetups.upcoming.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      await utils.meetups.upcoming.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const recommendedCrews = recommendedQuery.data ?? [];
  const crews = recommendedCrews.length > 0 ? recommendedCrews : (crewsQuery.data ?? []);
  const isLoadingCrews = crewsQuery.isPending || recommendedQuery.isPending;
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (!session) {
      return;
    }

    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  return (
    <ScreenScroll>
      <HeroPanel
        body="Ordenadas por ciudad, ritmo y compatibilidad para que encuentres gente con la que repetir."
        kicker="Comunidades"
        title="Crews cerca de ti"
      />

      <SectionHeader
        loading={isLoadingCrews}
        title={recommendedCrews.length > 0 ? 'Recomendadas para ti' : 'Todas las crews'}
      />

      {crewsQuery.error ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">No se pudieron cargar las crews</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{crewsQuery.error.message}</Text>
        </AppCard>
      ) : null}

      {!isLoadingCrews && crews.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Aún no hay crews activas.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando se creen comunidades aparecerán aquí con su ciudad, ritmo y vibe.
          </Text>
        </AppCard>
      ) : null}

      {crews.map((crew) => {
        const recommendationReason = (crew as { recommendationReason?: string }).recommendationReason;

        return (
          <AppCard key={crew.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[22px] font-black text-text">{crew.name}</Text>
                <Text className="mt-[3px] text-sm font-bold text-muted-text">{crew.city}</Text>
              </View>
              {recommendationReason ? (
                <Chip tone="warm">{recommendationReason}</Chip>
              ) : null}
            </View>
            <Text className="text-[15px] leading-[23px] text-muted-text">{crew.description}</Text>
            <View className="mt-0.5 flex-row flex-wrap gap-2.5">
              <Chip tone="cool">{crew.pace}</Chip>
              <Chip tone="neutral">{crew.vibe}</Chip>
            </View>
          </AppCard>
        );
      })}

      <SectionHeader loading={meetupsQuery.isPending} title="Próximas quedadas" />

      {meetupsQuery.error ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">No se pudieron cargar quedadas</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            {meetupsQuery.error.message}
          </Text>
        </AppCard>
      ) : null}

      {!meetupsQuery.isPending && !meetupsQuery.error && meetupsQuery.data?.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Sin quedadas publicadas.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Crea una desde Today para empezar a mover a la comunidad.
          </Text>
        </AppCard>
      ) : null}

      {meetupsQuery.data?.map((meetup) => (
        <View
          key={meetup.id}
          style={[
            styles.timelineItem,
            {
              backgroundColor: colors.hero,
              borderColor: colors.border,
              shadowColor: isDark ? '#000' : '#5C4833',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}>
          <View style={[styles.datePill, { backgroundColor: colors.heroAccent }]}>
            <Text style={styles.datePillText}>{formatMeetupLabel(meetup.startsAt)}</Text>
          </View>
          <View style={styles.timelineBody}>
            <Text style={[styles.timelineTitle, { color: colors.heroText }]}>{meetup.title}</Text>
            <Text style={[styles.timelineNote, { color: colors.heroTextMuted }]}>
              {meetup.crewName} · {meetup.distanceKm} km · {meetup.location}
            </Text>
            <View style={styles.timelineFooter}>
              <Text style={[styles.rsvpMeta, { color: colors.heroTextMuted }]}>
                {meetup.rsvpCount} apuntados
              </Text>
              <Pressable
                disabled={isMutatingRsvp}
                onPress={() => handleMeetupAction(meetup.id, meetup.viewerIsGoing)}
                style={({ pressed }) => [
                  styles.rsvpButton,
                  {
                    backgroundColor: meetup.viewerIsGoing
                      ? isDark ? 'rgba(255,243,228,0.12)' : 'rgba(255,248,236,0.16)'
                      : colors.heroAccent,
                    opacity: pressed ? 0.7 : isMutatingRsvp ? 0.7 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.rsvpButtonText,
                    { color: meetup.viewerIsGoing ? colors.heroText : '#1A1410' },
                  ]}>
                  {meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  datePill: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 74,
    paddingHorizontal: 10,
    width: 84,
  },
  datePillText: {
    color: '#1A1410',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rsvpButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rsvpButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  rsvpMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineBody: {
    flex: 1,
    gap: 6,
  },
  timelineFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timelineItem: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  timelineNote: {
    fontSize: 14,
    lineHeight: 21,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
