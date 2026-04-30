import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  AppButton,
  AppCard,
  Chip,
  EmptyState,
  ScreenScroll,
  SectionHeader,
} from '@/components/ui/AppUI';
import { useAppTheme } from '@/components/ThemeContext';
import {
  labelForMeetupOrganizer,
  labelForMeetupStyle,
} from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

function formatMeetupDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalizedWeekday}, ${day} · ${time}`;
}

function formatMessageTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const dayMonth = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
  const time = new Intl.DateTimeFormat('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${dayMonth}, ${time}`;
}

function roleLabel(role?: string | null) {
  switch (role) {
    case 'owner':
      return 'Propietario';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderador';
    case 'host':
      return 'Host';
    case 'member':
    default:
      return 'Miembro';
  }
}

type ReplyTarget = {
  authorLabel: string;
  body: string;
  id: number;
};

function messageAuthorLabel(message: Record<string, unknown>) {
  const username = typeof message.authorUsername === 'string' ? message.authorUsername : null;
  const name = typeof message.authorName === 'string' ? message.authorName : null;

  return username ? `@${username}` : name ?? 'Runner';
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function initialsForAuthor(label: string) {
  if (label.startsWith('@')) {
    return label.slice(1, 3).toUpperCase();
  }
  return initialsOf(label);
}

export default function MeetupDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const meetupId = rawId ? Number(rawId) : NaN;
  const hasValidMeetupId = Number.isInteger(meetupId) && meetupId > 0;
  const utils = trpc.useUtils();
  const { colors, isDark } = useAppTheme();
  const [commentBody, setCommentBody] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const meetupQuery = trpc.meetups.byId.useQuery(
    { meetupId },
    {
      enabled: hasValidMeetupId,
      retry: false,
    },
  );
  const messagesQuery = trpc.meetups.messages.useQuery(
    { meetupId },
    {
      enabled: hasValidMeetupId && Boolean(meetupQuery.data?.viewerIsMember || meetupQuery.data?.viewerIsGoing),
      retry: false,
    },
  );
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      await invalidateMeetupState();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      await invalidateMeetupState();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const cancelMeetupMutation = trpc.meetups.cancel.useMutation({
    onSuccess: async () => {
      const communityId = meetupQuery.data?.communityId;

      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
      await utils.meetups.upcomingForViewer.invalidate();
      router.back();
    },
    onError: (error) => {
      Alert.alert('No se pudo cancelar la quedada', error.message);
    },
  });
  const sendMessageMutation = trpc.meetups.sendMessage.useMutation({
    onSuccess: async () => {
      setCommentBody('');
      setReplyTarget(null);
      await utils.meetups.messages.invalidate({ meetupId });
      await utils.meetups.byId.invalidate({ meetupId });

      const communityId = meetupQuery.data?.communityId;

      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }
    },
    onError: (error) => {
      Alert.alert('No se pudo enviar el comentario', error.message);
    },
  });
  const meetup = meetupQuery.data;
  const organizerName = meetup?.createdByUsername
    ? `@${meetup.createdByUsername}`
    : meetup?.createdByName ?? 'organización';
  const organizerRole =
    meetup?.createdByPrimaryRole && meetup.createdByPrimaryRole !== 'member'
      ? roleLabel(meetup.createdByPrimaryRole)
      : null;
  const trimmedCommentBody = commentBody.trim();
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const canUseComments = Boolean(meetup?.viewerIsMember || meetup?.viewerIsGoing);
  const coordinatesLine = useMemo(() => {
    if (
      !meetup ||
      meetup.locationLat === null ||
      meetup.locationLat === undefined ||
      meetup.locationLng === null ||
      meetup.locationLng === undefined
    ) {
      return null;
    }

    return `${meetup.locationLat.toFixed(5)}, ${meetup.locationLng.toFixed(5)}`;
  }, [meetup]);
  const attendeeAvatars = meetup?.attendees.slice(0, 3) ?? [];
  const extraAttendees = Math.max(0, (meetup?.rsvpCount ?? 0) - attendeeAvatars.length);

  async function invalidateMeetupState() {
    await utils.meetups.byId.invalidate({ meetupId });
    await utils.meetups.upcomingPublic.invalidate();
    await utils.meetups.upcomingForViewer.invalidate();

    const communityId = meetupQuery.data?.communityId;

    if (communityId) {
      await utils.communities.byId.invalidate({ id: communityId });
    }
  }

  async function handleRsvp() {
    if (!meetup || isMutatingRsvp) {
      return;
    }

    if (meetup.viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  function handleEdit() {
    if (!meetup) {
      return;
    }

    router.push({
      pathname: '/modal',
      params: { communityId: meetup.communityId, meetupId: String(meetup.id) },
    } as any);
  }

  function confirmCancel() {
    if (!meetup) {
      return;
    }

    Alert.alert(
      'Cancelar quedada',
      'Se borrará la quedada y sus apuntados actuales. Esta acción no se puede deshacer.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        {
          text: 'Cancelar quedada',
          style: 'destructive',
          onPress: () => cancelMeetupMutation.mutate({ meetupId }),
        },
      ],
    );
  }

  async function handleSendComment() {
    if (!trimmedCommentBody || sendMessageMutation.isPending) {
      return;
    }

    await sendMessageMutation.mutateAsync({
      body: trimmedCommentBody,
      meetupId,
      replyToMessageId: replyTarget?.id,
    });
  }

  if (!hasValidMeetupId) {
    return (
      <ScreenScroll title="Quedada">
        <EmptyState title="Quedada no válida." body="Vuelve al grupo y abre una quedada existente." />
      </ScreenScroll>
    );
  }

  if (meetupQuery.isLoading) {
    return (
      <ScreenScroll title="Quedada">
        <EmptyState title="Cargando quedada..." body="Estamos preparando los detalles." />
      </ScreenScroll>
    );
  }

  if (meetupQuery.error || !meetup) {
    return (
      <ScreenScroll title="Quedada">
        <EmptyState
          title="No se pudo abrir la quedada."
          body={meetupQuery.error?.message ?? 'Comprueba que tienes acceso a esta quedada.'}
        />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll
      title="Quedada"
      contentStyle={{ paddingBottom: 44 }}
      onRefresh={() => {
        void invalidateMeetupState();
        void utils.meetups.messages.invalidate({ meetupId });
      }}
      refreshing={meetupQuery.isFetching || messagesQuery.isFetching}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled">
      <View className="gap-3">
        <View className="self-start">
          <Chip tone={meetup.communityMode === 'managed' ? 'warm' : 'cool'}>
            {labelForMeetupStyle(meetup.communityMode)}
          </Chip>
        </View>
        <Text className="text-[28px] font-black leading-[32px] text-text">{meetup.title}</Text>
        <Text className="text-[14px] leading-[20px] text-muted-text">
          {formatMeetupDate(meetup.startsAt)}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip tone="neutral">{meetup.distanceKm} km</Chip>
          <Chip tone={meetup.communityMode === 'managed' ? 'warm' : 'cool'}>
            {labelForMeetupStyle(meetup.communityMode)}
          </Chip>
        </View>
      </View>

      <AppCard>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row items-start gap-2">
            <FontAwesome6 name="location-dot" size={14} color={colors.tint} />
            <View className="flex-1">
              <Text className="text-[15px] font-black leading-5 text-text" numberOfLines={1}>
                {meetup.location}
              </Text>
              {coordinatesLine ? (
                <Text className="text-[12px] leading-[18px] text-muted-text" numberOfLines={1}>
                  {coordinatesLine}
                </Text>
              ) : null}
            </View>
          </View>
          <FontAwesome6 name="up-right-from-square" size={13} color={colors.mutedText} />
        </View>
        <View
          className="mt-1 h-36 items-center justify-center overflow-hidden rounded-card bg-chip"
          style={{ borderColor: colors.border, borderWidth: 1 }}>
          <FontAwesome6 name="map-location-dot" size={28} color={colors.mutedText} />
          <Text className="mt-2 text-[11px] font-black uppercase tracking-[0.8px] text-muted-text">
            Mapa próximamente
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row gap-6">
            <View>
              <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-muted-text">
                Apuntados
              </Text>
              <Text className="text-[17px] font-black text-text">{meetup.rsvpCount}</Text>
            </View>
            <View>
              <Text className="text-[11px] font-black uppercase tracking-[0.6px] text-muted-text">
                Comentarios
              </Text>
              <Text className="text-[17px] font-black text-text">{meetup.messageCount}</Text>
            </View>
          </View>
          {attendeeAvatars.length > 0 ? (
            <View className="flex-row items-center">
              {attendeeAvatars.map((attendee, index) => (
                <View
                  key={attendee.userId}
                  className="h-8 w-8 items-center justify-center rounded-full bg-chip"
                  style={{
                    borderColor: colors.surface,
                    borderWidth: 2,
                    marginLeft: index === 0 ? 0 : -10,
                  }}>
                  <Text className="text-[11px] font-black text-text">
                    {initialsOf(attendee.name ?? attendee.username ?? 'R')}
                  </Text>
                </View>
              ))}
              {extraAttendees > 0 ? (
                <View
                  className="h-8 items-center justify-center rounded-full bg-tint px-2"
                  style={{
                    borderColor: colors.surface,
                    borderWidth: 2,
                    marginLeft: -10,
                  }}>
                  <Text className="text-[11px] font-black text-on-tint">+{extraAttendees}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2">
          <FontAwesome6 name="user" size={11} color={colors.mutedText} />
          <Text className="flex-1 text-[13px] leading-[19px] text-muted-text" numberOfLines={1}>
            {labelForMeetupOrganizer(meetup.communityMode)} {organizerName}
            {organizerRole ? ` · ${organizerRole}` : ''}
          </Text>
        </View>
      </AppCard>

      <View className="gap-2">
        <View className="flex-row gap-2.5" style={{ opacity: isMutatingRsvp ? 0.6 : 1 }}>
          <View className="flex-1">
            <AppButton
              tone={meetup.viewerIsGoing ? 'secondary' : 'primary'}
              disabled={isMutatingRsvp}
              onPress={handleRsvp}>
              {meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
            </AppButton>
          </View>
          <View className="flex-1">
            <AppButton
              tone="secondary"
              onPress={() => router.push(`/crew/${meetup.communityId}` as any)}>
              Ver grupo
            </AppButton>
          </View>
        </View>
        {meetup.viewerCanManage ? (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppButton tone="secondary" disabled={cancelMeetupMutation.isPending} onPress={handleEdit}>
                Editar
              </AppButton>
            </View>
            <View className="flex-1">
              <AppButton tone="danger" disabled={cancelMeetupMutation.isPending} onPress={confirmCancel}>
                Cancelar quedada
              </AppButton>
            </View>
          </View>
        ) : null}
      </View>

      <SectionHeader title={`Quién va · ${meetup.rsvpCount}`} />
      {meetup.viewerIsMember ? (
        meetup.attendees.length === 0 ? (
          <EmptyState title="Todavía no hay gente apuntada." body="Sé la primera persona en confirmar." />
        ) : (
          <AppCard>
            <View className="gap-3">
              {meetup.attendees.map((attendee) => {
                const displayLabel = attendee.username ? `@${attendee.username}` : attendee.name;
                const subLabel = attendee.username ? attendee.name : null;
                const initials = initialsOf(attendee.name ?? attendee.username ?? 'R');

                return (
                  <View key={attendee.userId} className="flex-row items-center gap-3">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-chip">
                      <Text className="text-[12px] font-black text-text">{initials}</Text>
                    </View>
                    <Text className="flex-1 text-[15px] font-black text-text" numberOfLines={1}>
                      {displayLabel}
                    </Text>
                    {subLabel ? (
                      <Text className="text-[12px] font-bold text-muted-text" numberOfLines={1}>
                        {subLabel}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </AppCard>
        )
      ) : (
        <EmptyState
          title="Lista reservada al grupo."
          body="Puedes apuntarte a la quedada, pero la lista completa de asistentes queda dentro del grupo."
        />
      )}

      <SectionHeader title="Comentarios" loading={messagesQuery.isFetching} />
      {canUseComments ? (
        <View className="gap-5">
          {messagesQuery.data && messagesQuery.data.length > 0 ? (
            <View className="gap-5">
              {messagesQuery.data.map((message) => {
                const authorLabel = messageAuthorLabel(message);
                const isHost = message.authorUserId === meetup.createdByUserId;

                return (
                  <View key={message.id} className="flex-row gap-3">
                    <View
                      className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.tint }}>
                      <Text className="text-[14px] font-black text-on-tint">
                        {initialsForAuthor(authorLabel)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[14px] font-black text-text" numberOfLines={1}>
                          {authorLabel}
                        </Text>
                        {isHost ? (
                          <View
                            className="rounded-full px-2 py-[2px]"
                            style={{ backgroundColor: colors.tint }}>
                            <Text className="text-[10px] font-black text-on-tint">Host</Text>
                          </View>
                        ) : null}
                        <View className="flex-1" />
                        <Text className="text-[11px] font-bold text-muted-text">
                          {formatMessageTime(message.createdAt)}
                        </Text>
                      </View>
                      {message.replyTo ? (
                        <View className="mt-2 rounded-[12px] bg-chip px-3 py-2">
                          <Text className="text-[11px] font-black text-muted-text" numberOfLines={1}>
                            {messageAuthorLabel(message.replyTo)}
                          </Text>
                          <Text className="text-[12px] leading-[17px] text-muted-text" numberOfLines={2}>
                            {message.replyTo.body}
                          </Text>
                        </View>
                      ) : null}
                      <Text className="mt-1.5 text-[14px] leading-[20px] text-text">
                        {message.body}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setReplyTarget({
                            authorLabel: message.viewerIsAuthor ? 'Tú' : authorLabel,
                            body: message.body,
                            id: message.id,
                          })
                        }
                        className="mt-1.5 self-start"
                        hitSlop={6}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                        <Text className="text-[12px] font-black text-tint">Responder</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title="Sin comentarios todavía."
              body="Sé la primera persona en comentar esta quedada."
            />
          )}

          <View className="gap-2">
            {replyTarget ? (
              <View className="flex-row items-start justify-between gap-3 rounded-2xl bg-chip px-3 py-2.5">
                <View className="flex-1">
                  <Text className="text-[12px] font-black text-tint" numberOfLines={1}>
                    Respondiendo a {replyTarget.authorLabel}
                  </Text>
                  <Text className="mt-0.5 text-[13px] leading-[18px] text-muted-text" numberOfLines={2}>
                    {replyTarget.body}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReplyTarget(null)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <FontAwesome6 name="xmark" size={14} color={colors.mutedText} />
                </Pressable>
              </View>
            ) : null}
            <View
              className="flex-row items-center gap-2 rounded-full border p-1.5"
              style={{
                backgroundColor: isDark ? colors.surface : '#FFFDF8',
                borderColor: isDark ? colors.border : colors.tint,
                borderWidth: isDark ? 1 : 1.5,
                shadowColor: '#000',
                shadowOffset: { height: 3, width: 0 },
                shadowOpacity: isDark ? 0.1 : 0.14,
                shadowRadius: 10,
                elevation: 4,
              }}>
              <View
                className="flex-1 justify-center rounded-full border px-3"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: isDark ? colors.border : '#F0D4AA',
                  height: 44,
                }}>
                <TextInput
                  value={commentBody}
                  onChangeText={setCommentBody}
                  placeholder={replyTarget ? 'Escribe tu respuesta...' : 'Escribe un comentario...'}
                  placeholderTextColor={colors.mutedText}
                  maxLength={500}
                  editable={!sendMessageMutation.isPending}
                  className="text-[14px] text-text"
                  style={{ paddingVertical: 0 }}
                />
              </View>
              <Pressable
                disabled={!trimmedCommentBody || sendMessageMutation.isPending}
                onPress={handleSendComment}
                accessibilityLabel="Enviar comentario"
                style={({ pressed }) => ({
                  alignItems: 'center',
                  backgroundColor: colors.tint,
                  borderColor: colors.tint,
                  borderRadius: 22,
                  borderWidth: 0,
                  height: 44,
                  justifyContent: 'center',
                  opacity: pressed
                    ? 0.8
                    : !trimmedCommentBody || sendMessageMutation.isPending
                      ? 0.7
                      : 1,
                  width: 44,
                })}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.tint, height: 44, width: 44 }}>
                  <FontAwesome6 name="paper-plane" size={15} color={colors.onTint} solid />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <EmptyState
          title="Apúntate para comentar."
          body="Los comentarios quedan para la coordinación de quienes van a la quedada."
        />
      )}
    </ScreenScroll>
  );
}
