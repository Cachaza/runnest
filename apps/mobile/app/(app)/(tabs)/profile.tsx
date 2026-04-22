import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppCard,
  Chip,
  EmptyState,
  HeroPanel,
  MetaRow,
  QuickAction,
  QuickActionRow,
  ScreenScroll,
  SectionHeader,
  SegmentedTabs,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

type AvailabilitySlot = {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  period: 'morning' | 'midday' | 'afternoon' | 'evening';
};

type TabValue = 'profile' | 'agenda';

const DAY_LABELS: { day: AvailabilitySlot['day']; label: string }[] = [
  { day: 'mon', label: 'L' },
  { day: 'tue', label: 'M' },
  { day: 'wed', label: 'X' },
  { day: 'thu', label: 'J' },
  { day: 'fri', label: 'V' },
  { day: 'sat', label: 'S' },
  { day: 'sun', label: 'D' },
];

const PERIOD_LABELS: { period: AvailabilitySlot['period']; label: string }[] = [
  { period: 'morning', label: 'Mañana' },
  { period: 'midday', label: 'Mediodía' },
  { period: 'afternoon', label: 'Tarde' },
  { period: 'evening', label: 'Noche' },
];

function listFromCommaValue(value?: string | null) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
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

export default function ProfileScreen() {
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<TabValue>('profile');
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const hasProfile = Boolean(profile);
  const publicProfileQuery = trpc.profile.publicByUsername.useQuery(
    { username: profile?.username ?? '' },
    {
      enabled: !!profile?.username,
      retry: false,
    },
  );
  const publicProfile = publicProfileQuery.data?.profile;
  const upcomingMeetups = publicProfileQuery.data?.upcomingMeetups ?? [];
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    const refreshedProfile = await profileQuery.refetch();
    const refreshedUsername = refreshedProfile.data?.profile?.username;

    if (refreshedUsername) {
      await publicProfileQuery.refetch();
    }
  });

  const heroTitle = profile?.username
    ? `@${profile.username}`
    : session?.user.name ?? 'Runner';
  const heroBody = profile
    ? [profile.city, profile.pace ? `Ritmo ${profile.pace}` : null]
        .filter(Boolean)
        .join(' · ')
    : 'Completa tu perfil para aparecer en los matches';

  return (
    <ScreenScroll onRefresh={hasProfile ? onRefresh : undefined} refreshing={refreshing}>
      <HeroPanel kicker="Tu cuenta" title={heroTitle} body={heroBody} />

      {!hasProfile && !profileQuery.isPending ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Crea tu perfil runner</Text>
          <Text className="text-[15px] leading-[22px] text-muted-text">
            Necesitamos un par de datos para recomendarte crews y quedadas compatibles.
          </Text>
          <Pressable
            onPress={() => router.push('/profile-edit' as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            className="mt-3 items-center rounded-[18px] bg-tint py-[15px]">
            <Text className="text-[15px] font-black text-on-tint">Empezar ahora</Text>
          </Pressable>
        </AppCard>
      ) : null}

      {hasProfile ? (
        <>
          <QuickActionRow>
            <QuickAction
              icon="pen-to-square"
              label="Editar"
              onPress={() => router.push('/profile-edit' as any)}
              tone="primary"
            />
            <QuickAction
              icon="eye"
              label="Vista pública"
              onPress={() => {
                if (profile?.username) {
                  router.push(`/runner/${profile.username}` as any);
                }
              }}
            />
            <QuickAction
              icon="gear"
              label="Ajustes"
              onPress={() => router.push('/settings' as any)}
            />
          </QuickActionRow>

          <StatsRow
            meetupsCount={upcomingMeetups.length}
            level={profile?.level}
            distance={profile?.distance}
          />

          <SegmentedTabs<TabValue>
            value={tab}
            onChange={setTab}
            options={[
              { label: 'Perfil', value: 'profile' },
              {
                label: 'Agenda',
                value: 'agenda',
                badge: upcomingMeetups.length,
              },
            ]}
          />

          {tab === 'profile' ? (
            <ProfileSummary
              isLoading={publicProfileQuery.isPending && !publicProfile}
              profile={publicProfile}
              bio={profile?.bio}
            />
          ) : null}

          {tab === 'agenda' ? (
            <AgendaSection
              isLoading={publicProfileQuery.isPending && upcomingMeetups.length === 0}
              meetups={upcomingMeetups}
            />
          ) : null}
        </>
      ) : null}
    </ScreenScroll>
  );
}

function StatsRow({
  meetupsCount,
  level,
  distance,
}: {
  meetupsCount: number;
  level?: string | null;
  distance?: string | null;
}) {
  const items: { label: string; value: string | number }[] = [
    { label: 'Próximas', value: meetupsCount },
  ];

  if (level) {
    items.push({ label: 'Nivel', value: level });
  }

  if (distance) {
    items.push({ label: 'Distancia', value: distance });
  }

  return (
    <AppCard>
      <MetaRow items={items} />
    </AppCard>
  );
}

function ProfileSummary({
  isLoading,
  profile,
  bio,
}: {
  bio?: string | null;
  isLoading: boolean;
  profile?: {
    area: string | null;
    availabilitySlots: AvailabilitySlot[];
    city: string | null;
    distance: string | null;
    goals: string | null;
    level: string | null;
    pace: string;
    username: string | null;
  };
}) {
  const goals = listFromCommaValue(profile?.goals);
  const availabilitySlots = profile?.availabilitySlots ?? [];
  const hasAvailability = availabilitySlots.length > 0;

  if (isLoading && !profile) {
    return (
      <EmptyState
        title="Cargando tu ficha pública..."
        body="Un momento, estamos preparando la vista que verán otros runners."
      />
    );
  }

  return (
    <>
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Ficha pública</Text>
        <Text className="mt-1 text-[22px] font-black text-text">
          {profile?.username ? `@${profile.username}` : 'Perfil no disponible'}
        </Text>
        <Text className="text-[14px] leading-[21px] text-muted-text">
          {[profile?.area, profile?.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {profile?.level ? <Chip tone="warm">{profile.level}</Chip> : null}
          {profile?.pace ? <Chip tone="cool">{profile.pace}</Chip> : null}
          {profile?.distance ? <Chip tone="neutral">{profile.distance}</Chip> : null}
        </View>
        {bio ? (
          <Text className="mt-3 text-[15px] leading-[22px] text-text">{bio}</Text>
        ) : null}
      </AppCard>

      {goals.length > 0 ? (
        <AppCard>
          <Text className="text-xs font-black uppercase tracking-[1px] text-muted-text">Metas</Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {goals.map((goal) => (
              <Chip key={goal}>{goal}</Chip>
            ))}
          </View>
        </AppCard>
      ) : null}

      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-muted-text">
          Disponibilidad
        </Text>
        {hasAvailability ? (
          <AvailabilityMatrix slots={availabilitySlots} />
        ) : (
          <Text className="mt-2 text-[14px] leading-[21px] text-muted-text">
            Aún no has marcado tus horarios favoritos. Añádelos desde Editar para recibir
            mejores recomendaciones.
          </Text>
        )}
      </AppCard>
    </>
  );
}

function AvailabilityMatrix({ slots }: { slots: AvailabilitySlot[] }) {
  const slotKeys = new Set(slots.map((slot) => `${slot.day}:${slot.period}`));

  return (
    <View className="mt-2 gap-1.5">
      <View className="flex-row">
        <View className="w-20" />
        <View className="flex-1 flex-row gap-1">
          {DAY_LABELS.map((day) => (
            <View key={day.day} className="h-7 flex-1 items-center justify-center">
              <Text className="text-[11px] font-black text-muted-text">{day.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {PERIOD_LABELS.map((period) => (
        <View key={period.period} className="flex-row items-center">
          <Text className="w-20 text-[11px] font-black uppercase tracking-[0.5px] text-muted-text">
            {period.label}
          </Text>
          <View className="flex-1 flex-row gap-1">
            {DAY_LABELS.map((day) => {
              const selected = slotKeys.has(`${day.day}:${period.period}`);

              return (
                <View
                  key={`${day.day}:${period.period}`}
                  className={`h-7 flex-1 rounded-lg ${selected ? 'bg-tint' : 'bg-chip'}`}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function AgendaSection({
  isLoading,
  meetups,
}: {
  isLoading: boolean;
  meetups: {
    communityName: string;
    distanceKm: number;
    id: number;
    location: string;
    startsAt: string | Date;
    title: string;
  }[];
}) {
  if (meetups.length === 0 && isLoading) {
    return (
      <EmptyState
        title="Cargando tu agenda..."
        body="Un momento, recogiendo las próximas quedadas en las que apareces."
      />
    );
  }

  if (meetups.length === 0) {
    return (
      <EmptyState
        title="Sin próximas quedadas."
        body="Cuando crees o confirmes una quedada pública, aparecerá aquí y en tu ficha."
      />
    );
  }

  return (
    <>
      <SectionHeader title="Próximas quedadas" />
      {meetups.map((meetup) => (
        <AppCard key={meetup.id}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs font-black uppercase tracking-[1px] text-tint">
                {formatMeetupLabel(meetup.startsAt)}
              </Text>
              <Text className="mt-0.5 text-[20px] font-black text-text">{meetup.title}</Text>
              <Text className="mt-0.5 text-[14px] leading-[21px] text-muted-text">
                {meetup.communityName} · {meetup.distanceKm} km · {meetup.location}
              </Text>
            </View>
            <FontAwesome6 name="person-running" size={18} color="#745F48" />
          </View>
        </AppCard>
      ))}
    </>
  );
}
