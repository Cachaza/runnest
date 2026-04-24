import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { usePullToRefresh } from '@/components/usePullToRefresh';
import { AppCard, Chip, EmptyState, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { trpc } from '@/lib/trpc';

type AvailabilitySlot = {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  period: 'morning' | 'midday' | 'afternoon' | 'evening';
};

const DAY_LABELS = new Map([
  ['mon', 'L'],
  ['tue', 'M'],
  ['wed', 'X'],
  ['thu', 'J'],
  ['fri', 'V'],
  ['sat', 'S'],
  ['sun', 'D'],
]);

const PERIOD_LABELS = new Map([
  ['morning', 'mañana'],
  ['midday', 'mediodía'],
  ['afternoon', 'tarde'],
  ['evening', 'noche'],
]);

function listFromCommaValue(value?: string | null) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function formatAvailability(slots?: AvailabilitySlot[] | null) {
  if (!slots || slots.length === 0) {
    return 'Sin disponibilidad pública';
  }

  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    .map((day) => {
      const periods = slots
        .filter((slot) => slot.day === day)
        .map((slot) => PERIOD_LABELS.get(slot.period))
        .filter(Boolean);

      return periods.length > 0 ? `${DAY_LABELS.get(day)} ${periods.join('/')}` : null;
    })
    .filter(Boolean)
    .join(', ');
}

function formatMeetupLabel(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

export default function PublicRunnerScreen() {
  const params = useLocalSearchParams<{ username?: string }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const runnerQuery = trpc.profile.publicByUsername.useQuery(
    { username: username ?? '' },
    {
      enabled: Boolean(username),
      retry: false,
    },
  );
  const runner = runnerQuery.data?.profile;
  const goals = listFromCommaValue(runner?.goals);
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    if (!username) {
      return;
    }

    await runnerQuery.refetch();
  });

  if (runnerQuery.error) {
    return (
      <ScreenScroll title="Runner" onRefresh={username ? onRefresh : undefined} refreshing={refreshing}>
        <AppCard>
          <Text className="text-[25px] font-black text-text">Perfil no disponible</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{runnerQuery.error.message}</Text>
        </AppCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll onRefresh={username ? onRefresh : undefined} refreshing={refreshing}>
      <HeroPanel
        kicker={runner?.isSelf ? 'Tu perfil público' : 'Runner'}
        title={runner?.username ? `@${runner.username}` : 'Cargando...'}
        body={[runner?.area, runner?.city].filter(Boolean).join(' · ') || 'AppRunners'}
      />

      <AppCard>
        <Text className="text-[25px] font-black text-text">Perfil runner</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {runner?.level ? <Chip tone="warm">{runner.level}</Chip> : null}
          {runner?.pace ? <Chip tone="cool">{runner.pace}</Chip> : null}
          {runner?.distance ? <Chip tone="neutral">{runner.distance}</Chip> : null}
        </View>
        {goals.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {goals.map((goal) => (
              <Chip key={goal}>{goal}</Chip>
            ))}
          </View>
        ) : null}
        <Text className="mt-2 text-[15px] leading-[23px] text-muted-text">
          {formatAvailability(runner?.availabilitySlots)}
        </Text>
      </AppCard>

      <SectionHeader loading={runnerQuery.isPending} title="Próximas quedadas" />

      {!runnerQuery.isPending && runnerQuery.data?.upcomingMeetups.length === 0 ? (
        <EmptyState
          title="Sin quedadas próximas."
          body="Cuando este runner cree o confirme una quedada pública, aparecerá aquí."
        />
      ) : null}

      {runnerQuery.data?.upcomingMeetups.map((meetup) => (
        <Link key={meetup.id} href={`/meetup/${meetup.id}` as any} asChild>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <AppCard>
              <Text className="text-xs font-black uppercase tracking-[1px] text-tint">
                {formatMeetupLabel(meetup.startsAt)}
              </Text>
              <Text className="text-[22px] font-black text-text">{meetup.title}</Text>
              <Text className="text-[15px] leading-[23px] text-muted-text">
                {meetup.communityName} · {meetup.distanceKm} km · {meetup.location}
              </Text>
            </AppCard>
          </Pressable>
        </Link>
      ))}
    </ScreenScroll>
  );
}
