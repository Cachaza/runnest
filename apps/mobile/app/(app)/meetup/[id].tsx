import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  AppButton,
  AppCard,
  Chip,
  EmptyState,
  HeroPanel,
  MetaRow,
  QuickAction,
  QuickActionRow,
  ScreenScroll,
  SectionHeader,
} from '@/components/ui/AppUI';
import { useAppTheme } from '@/components/ThemeContext';
import {
  labelForCommunityKind,
  labelForMeetupOrganizer,
  labelForMeetupStyle,
} from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

function formatMeetupDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function formatMessageTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
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
  const { colors } = useAppTheme();
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
  const locationLine = useMemo(() => {
    if (!meetup) {
      return null;
    }

    const coordinates =
      meetup.locationLat !== null &&
      meetup.locationLat !== undefined &&
      meetup.locationLng !== null &&
      meetup.locationLng !== undefined
        ? `${meetup.locationLat.toFixed(5)}, ${meetup.locationLng.toFixed(5)}`
        : null;

    return coordinates ? `${meetup.location} · ${coordinates}` : meetup.location;
  }, [meetup]);

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
      onRefresh={() => {
        void invalidateMeetupState();
        void utils.meetups.messages.invalidate({ meetupId });
      }}
      refreshing={meetupQuery.isFetching || messagesQuery.isFetching}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled">
      <HeroPanel
        kicker={`${labelForCommunityKind(meetup.communityKind)} · ${meetup.communityName}`}
        title={meetup.title}
        body={formatMeetupDate(meetup.startsAt)}>
        <View className="mt-5 flex-row flex-wrap gap-2">
          <Chip tone={meetup.communityMode === 'managed' ? 'warm' : 'cool'}>
            {labelForMeetupStyle(meetup.communityMode)}
          </Chip>
          <Chip tone="neutral">{meetup.distanceKm} km</Chip>
        </View>
      </HeroPanel>

      <AppCard>
        <MetaRow
          items={[
            { label: 'Apuntados', value: meetup.rsvpCount },
            { label: 'Comentarios', value: meetup.messageCount },
          ]}
        />
        <View className="mt-1 flex-row items-center gap-2">
          <FontAwesome6 name="user" size={11} color={colors.mutedText} />
          <Text className="flex-1 text-[14px] leading-[21px] text-muted-text" numberOfLines={1}>
            {labelForMeetupOrganizer(meetup.communityMode)} {organizerName}
            {organizerRole ? ` · ${organizerRole}` : ''}
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <View className="flex-row items-center gap-2">
          <FontAwesome6 name="location-dot" size={13} color={colors.mutedText} />
          <Text className="text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
            Ubicación
          </Text>
        </View>
        <Text className="mt-1 text-[20px] font-black leading-6 text-text">{meetup.location}</Text>
        {locationLine && locationLine !== meetup.location ? (
          <Text className="text-[13px] leading-[19px] text-muted-text">{locationLine}</Text>
        ) : null}
      </AppCard>

      <View className="gap-2">
        <View style={{ opacity: isMutatingRsvp ? 0.6 : 1 }}>
          <QuickActionRow>
            <QuickAction
              icon={meetup.viewerIsGoing ? 'circle-check' : 'person-running'}
              label={meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
              onPress={handleRsvp}
              tone={meetup.viewerIsGoing ? 'neutral' : 'primary'}
            />
            <QuickAction
              icon="users"
              label="Ver grupo"
              onPress={() => router.push(`/crew/${meetup.communityId}` as any)}
            />
          </QuickActionRow>
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
        <View className="gap-3">
          {messagesQuery.data && messagesQuery.data.length > 0 ? (
            <View className="gap-3">
              {messagesQuery.data.map((message) => {
                const authorLabel = message.viewerIsAuthor ? 'Tú' : messageAuthorLabel(message);

                if (message.viewerIsAuthor) {
                  return (
                    <View key={message.id} className="w-full items-end">
                      <View className="max-w-[82%]">
                        <View className="gap-1 rounded-[18px] bg-tint px-3.5 py-3">
                          {message.replyTo ? (
                            <View className="mb-1 rounded-[12px] bg-on-tint/15 px-2.5 py-2">
                              <Text className="text-[11px] font-black text-on-tint" numberOfLines={1}>
                                {messageAuthorLabel(message.replyTo)}
                              </Text>
                              <Text className="text-[12px] leading-[17px] text-on-tint" numberOfLines={2}>
                                {message.replyTo.body}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="text-[15px] leading-[22px] text-on-tint">{message.body}</Text>
                          <Pressable
                            onPress={() =>
                              setReplyTarget({ authorLabel, body: message.body, id: message.id })
                            }
                            className="self-start pt-0.5"
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                            <Text className="text-[12px] font-black text-on-tint">Responder</Text>
                          </Pressable>
                        </View>
                        <Text className="mt-1 px-1 text-right text-[10px] font-bold text-muted-text">
                          {formatMessageTime(message.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={message.id} className="w-full items-start">
                    <View className="max-w-[86%] flex-row items-end gap-2">
                      <View className="mb-[18px] h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chip">
                        <Text className="text-[10px] font-black text-text">
                          {initialsForAuthor(authorLabel)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <View className="gap-1 rounded-[18px] border border-border bg-surface px-3.5 py-3">
                          {message.replyTo ? (
                            <View className="mb-1 rounded-[12px] bg-background px-2.5 py-2">
                              <Text className="text-[11px] font-black text-muted-text" numberOfLines={1}>
                                {messageAuthorLabel(message.replyTo)}
                              </Text>
                              <Text className="text-[12px] leading-[17px] text-muted-text" numberOfLines={2}>
                                {message.replyTo.body}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="text-[12px] font-black text-muted-text" numberOfLines={1}>
                            {authorLabel}
                          </Text>
                          <Text className="text-[15px] leading-[22px] text-text">{message.body}</Text>
                          <Pressable
                            onPress={() =>
                              setReplyTarget({ authorLabel, body: message.body, id: message.id })
                            }
                            className="self-start pt-0.5"
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                            <Text className="text-[12px] font-black text-tint">Responder</Text>
                          </Pressable>
                        </View>
                        <Text className="mt-1 px-1 text-[10px] font-bold text-muted-text">
                          {formatMessageTime(message.createdAt)}
                        </Text>
                      </View>
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

          <AppCard>
            {replyTarget ? (
              <View className="mb-2 flex-row items-start justify-between gap-3 rounded-2xl bg-background px-3 py-2.5">
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
                  className="rounded-full bg-chip px-3 py-1.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Text className="text-[12px] font-black text-text">Quitar</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              placeholder={replyTarget ? 'Escribe tu respuesta' : 'Escribe un comentario'}
              placeholderTextColor="#8C7F76"
              multiline
              maxLength={500}
              editable={!sendMessageMutation.isPending}
              className="min-h-[92px] rounded-2xl border border-border bg-background px-3 py-3 text-[14px] leading-[20px] text-text"
            />
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-[11px] font-bold text-muted-text">{trimmedCommentBody.length}/500</Text>
              <Pressable
                disabled={!trimmedCommentBody || sendMessageMutation.isPending}
                onPress={handleSendComment}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.75 : !trimmedCommentBody || sendMessageMutation.isPending ? 0.5 : 1,
                })}
                className="flex-row items-center gap-2 rounded-full bg-tint px-4 py-2">
                <FontAwesome6 name="paper-plane" size={11} color={colors.onTint} />
                <Text className="text-[13px] font-black text-on-tint">
                  {sendMessageMutation.isPending ? 'Enviando...' : 'Enviar'}
                </Text>
              </Pressable>
            </View>
          </AppCard>
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
