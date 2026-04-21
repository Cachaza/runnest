import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import { ProfileForm } from '@/components/ProfileForm';
import { AppCard, Chip, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
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

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const [isEditing, setIsEditing] = useState(false);
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const publicProfileQuery = trpc.profile.publicByUsername.useQuery(
    { username: profile?.username ?? '' },
    {
      enabled: !!profile?.username && !isEditing,
      retry: false,
    },
  );
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    const refreshedProfile = await profileQuery.refetch();
    const refreshedUsername = refreshedProfile.data?.profile?.username;

    if (refreshedUsername && !isEditing) {
      await publicProfileQuery.refetch();
    }
  });
  const canRefresh = !isEditing && Boolean(profile);

  return (
    <ScreenScroll onRefresh={canRefresh ? onRefresh : undefined} refreshing={refreshing}>
      <HeroPanel kicker="Tu cuenta" title={profile?.username ? `@${profile.username}` : session?.user.name ?? 'Runner'} body={session?.user.email}>
        <View style={[styles.statusPill, { backgroundColor: colors.heroAccent }]}>
          <Text style={styles.statusPillText}>
            {profile ? `Perfil listo · ${profile.city} · ${profile.pace}` : 'Perfil pendiente'}
          </Text>
        </View>
      </HeroPanel>

      {isEditing || !profile ? (
        <>
          {profile ? (
            <Pressable
              onPress={() => setIsEditing(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="items-center rounded-[18px] bg-chip py-[15px]">
              <Text className="text-[15px] font-black text-text">Volver a vista pública</Text>
            </Pressable>
          ) : null}
          <ProfileForm
            description="Estos datos ayudan a ordenar crews y quedadas por compatibilidad. Puedes cambiarlos cuando quieras."
            fallbackUsername={session?.user.name}
            isLoading={profileQuery.isPending}
            onSaved={() => setIsEditing(false)}
            profile={profile}
            submitLabel="Guardar perfil"
            title="Editar perfil runner"
          />
        </>
      ) : (
        <>
          <PublicProfilePreview
            isLoading={publicProfileQuery.isPending}
            profile={publicProfileQuery.data?.profile}
            upcomingMeetups={publicProfileQuery.data?.upcomingMeetups ?? []}
          />
          <AppCard>
            <Text className="text-[25px] font-black text-text">Editar y privacidad</Text>
            <Text className="text-[15px] leading-[23px] text-muted-text">
              Esta es la ficha que verán otros runners si tienes el perfil público activado.
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => setIsEditing(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                className="flex-1 items-center rounded-[18px] bg-tint py-[15px]">
                <Text className="text-[15px] font-black text-[#FFF8EC]">Editar perfil</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings' as any)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                className="flex-1 items-center rounded-[18px] bg-chip py-[15px]">
                <Text className="text-[15px] font-black text-text">Privacidad</Text>
              </Pressable>
            </View>
          </AppCard>
        </>
      )}

      <AppCard>
        <Text className="text-[25px] font-black text-text">Ajustes</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Configura la apariencia, notificaciones y opciones de sesión de tu cuenta.
        </Text>
        <Pressable
          onPress={() => router.push('/settings' as any)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="mt-4 items-center rounded-[18px] bg-chip py-[15px]">
          <Text className="text-[15px] font-black text-text">Abrir ajustes</Text>
        </Pressable>
      </AppCard>
    </ScreenScroll>
  );
}

function PublicProfilePreview({
  isLoading,
  profile,
  upcomingMeetups,
}: {
  isLoading: boolean;
  profile?: {
    area: string | null;
    availabilitySlots: AvailabilitySlot[];
    city: string | null;
    distance: string | null;
    goals: string | null;
    isSelf: boolean;
    level: string | null;
    pace: string;
    username: string | null;
  };
  upcomingMeetups: {
    communityName: string;
    distanceKm: number;
    id: number;
    location: string;
    startsAt: string | Date;
    title: string;
  }[];
}) {
  const goals = listFromCommaValue(profile?.goals);

  return (
    <>
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Vista pública</Text>
        <Text className="text-[25px] font-black text-text">
          {profile?.username ? `@${profile.username}` : isLoading ? 'Cargando...' : 'Perfil no disponible'}
        </Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          {[profile?.area, profile?.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {profile?.level ? <Chip tone="warm">{profile.level}</Chip> : null}
          {profile?.pace ? <Chip tone="cool">{profile.pace}</Chip> : null}
          {profile?.distance ? <Chip tone="neutral">{profile.distance}</Chip> : null}
        </View>
        {goals.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {goals.map((goal) => (
              <Chip key={goal}>{goal}</Chip>
            ))}
          </View>
        ) : null}
        <Text className="mt-2 text-[15px] leading-[23px] text-muted-text">
          {formatAvailability(profile?.availabilitySlots)}
        </Text>
      </AppCard>

      <SectionHeader loading={isLoading} title="Tus próximas quedadas públicas" />
      {!isLoading && upcomingMeetups.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Sin quedadas próximas.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando crees o confirmes una quedada, aparecerá en tu ficha pública.
          </Text>
        </AppCard>
      ) : null}
      {upcomingMeetups.map((meetup) => (
        <AppCard key={meetup.id}>
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">
            {formatMeetupLabel(meetup.startsAt)}
          </Text>
          <Text className="text-[22px] font-black text-text">{meetup.title}</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            {meetup.communityName} · {meetup.distanceKm} km · {meetup.location}
          </Text>
        </AppCard>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  statusPillText: {
    color: '#1A1410',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
