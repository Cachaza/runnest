import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { Chip, ScreenHeader } from '@/components/ui/AppUI';
import {
  createMeetupBody,
  createMeetupCtaLabel,
  createMeetupTitle,
  labelForCommunityKind,
  labelForMeetupStyle,
  labelForMode,
} from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

const meetupSchema = z.object({
  communityId: z.string().min(1),
  distanceKm: z.number().int().positive(),
  location: z.string().min(2),
  startsAt: z.string().datetime(),
  title: z.string().min(2),
});

type MeetupFormValues = {
  communityId: string;
  distanceKm: string;
  location: string;
  startsAt: string;
  title: string;
};

export default function ModalScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ communityId?: string; meetupId?: string }>();
  const initialCommunityId = Array.isArray(params.communityId) ? params.communityId[0] : params.communityId;
  const meetupIdParam = Array.isArray(params.meetupId) ? params.meetupId[0] : params.meetupId;
  const meetupId = meetupIdParam ? Number.parseInt(meetupIdParam, 10) : null;
  const isEditing = meetupId !== null && !Number.isNaN(meetupId);
  const utils = trpc.useUtils();
  const [formError, setFormError] = useState<string | null>(null);
  const communitiesQuery = trpc.communities.hostable.useQuery();
  const editableMeetupQuery = trpc.meetups.editableById.useQuery(
    { meetupId: meetupId ?? 0 },
    {
      enabled: isEditing,
      retry: false,
    },
  );
  const createMeetup = trpc.meetups.create.useMutation({
    onSuccess: async (_createdMeetup, variables) => {
      await utils.meetups.upcomingPublic.invalidate();
      await utils.communities.byId.invalidate({ id: variables.communityId });
      await utils.profile.publicByUsername.invalidate();
      router.back();
    },
    onError: (error) => {
      setFormError(error.message);
    },
  });
  const updateMeetup = trpc.meetups.update.useMutation({
    onSuccess: async (_updatedMeetup, variables) => {
      const editableCommunityId = editableMeetupQuery.data?.communityId;

      await utils.meetups.upcomingPublic.invalidate();
      await utils.profile.publicByUsername.invalidate();
      if (editableCommunityId) {
        await utils.communities.byId.invalidate({ id: editableCommunityId });
      }
      if (variables.meetupId) {
        await utils.meetups.editableById.invalidate({ meetupId: variables.meetupId });
      }
      router.back();
    },
    onError: (error) => {
      setFormError(error.message);
    },
  });
  const { control, handleSubmit, setValue, watch } = useForm<MeetupFormValues>({
    defaultValues: {
      communityId: '',
      distanceKm: '6',
      location: '',
      startsAt: '',
      title: '',
    },
  });
  const selectedCommunityId = watch('communityId');
  const selectedCommunity = useMemo(
    () => communitiesQuery.data?.find((community) => community.id === selectedCommunityId) ?? null,
    [communitiesQuery.data, selectedCommunityId],
  );
  const selectedMode = editableMeetupQuery.data?.communityMode ?? selectedCommunity?.mode;
  const submitLabel = isEditing
    ? 'Guardar cambios'
    : createMeetupCtaLabel(selectedMode);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    if (initialCommunityId) {
      setValue('communityId', initialCommunityId);
    }
  }, [initialCommunityId, isEditing, setValue]);

  useEffect(() => {
    if (!editableMeetupQuery.data) {
      return;
    }

    const startsAt = new Date(editableMeetupQuery.data.startsAt);
    const startsAtValue = Number.isNaN(startsAt.getTime())
      ? ''
      : new Intl.DateTimeFormat('sv-SE', {
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
          .format(startsAt)
          .replace(' ', ' ');

    setValue('communityId', editableMeetupQuery.data.communityId);
    setValue('distanceKm', String(editableMeetupQuery.data.distanceKm));
    setValue('location', editableMeetupQuery.data.location);
    setValue('startsAt', startsAtValue);
    setValue('title', editableMeetupQuery.data.title);
  }, [editableMeetupQuery.data, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    if (!values.communityId) {
      setFormError('Elige un grupo antes de publicar la quedada.');
      return;
    }

    const parsedDate = new Date(values.startsAt.replace(' ', 'T'));
    const parsedDistance = Number.parseInt(values.distanceKm, 10);

    if (Number.isNaN(parsedDate.getTime())) {
      setFormError('Usa una fecha válida con formato YYYY-MM-DD HH:MM.');
      return;
    }

    const parsed = meetupSchema.safeParse({
      communityId: values.communityId,
      distanceKm: parsedDistance,
      location: values.location.trim(),
      startsAt: parsedDate.toISOString(),
      title: values.title.trim(),
    });

    if (!parsed.success) {
      Alert.alert('Revisa la quedada', 'Completa título, lugar, distancia y fecha.');
      return;
    }

    if (isEditing && meetupId) {
      await updateMeetup.mutateAsync({
        meetupId,
        ...parsed.data,
      });
      return;
    }

    await createMeetup.mutateAsync(parsed.data);
  });

  const isSubmitting = createMeetup.isPending || updateMeetup.isPending;

  return (
    <View className="flex-1 bg-background">
    <ScreenHeader title={isEditing ? 'Editar quedada' : 'Nueva salida'} />
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="justify-center p-[18px]">
      <View className="rounded-[32px] border border-border bg-surface p-[22px]">
        <Text className="text-xs font-black uppercase tracking-[1.1px] text-tint">
          {isEditing ? 'Editar quedada' : 'Nueva quedada'}
        </Text>
        <Text className="mt-2.5 text-[32px] font-black leading-9 text-text">
          {isEditing ? 'Ajusta el plan y vuelve a compartirlo.' : createMeetupTitle(selectedMode)}
        </Text>
        <Text className="mt-3 text-[15px] leading-[23px] text-muted-text">
          {isEditing
            ? 'Corrige título, lugar, distancia o fecha sin romper la coordinación del grupo.'
            : createMeetupBody(selectedMode)}
        </Text>

        <Text className="mt-[18px] text-[13px] font-black uppercase tracking-[0.8px] text-muted-text">Comunidad</Text>
        <View className="mt-3 flex-row flex-wrap gap-2.5">
          {communitiesQuery.data?.map((community) => (
            <Chip
              key={community.id}
              selected={selectedCommunityId === community.id}
              onPress={
                isEditing
                  ? undefined
                  : () => {
                      setValue('communityId', community.id);
                      setFormError(null);
                    }
              }>
              {community.name}
            </Chip>
          ))}
        </View>

        {editableMeetupQuery.error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{editableMeetupQuery.error.message}</Text>
        ) : null}

        {communitiesQuery.error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{communitiesQuery.error.message}</Text>
        ) : null}

        {!communitiesQuery.isPending && !communitiesQuery.error && (communitiesQuery.data?.length ?? 0) === 0 ? (
          <Text className="mt-2.5 text-sm font-bold leading-5 text-muted-text">
            Aún no perteneces a ninguna comunidad donde puedas organizar quedadas.
          </Text>
        ) : null}

        {selectedCommunity ? (
          <>
            <View className="mt-2.5 flex-row flex-wrap gap-2">
              <Chip tone="neutral">{labelForMode(selectedCommunity.mode)}</Chip>
              <Chip tone="cool">{selectedCommunity.visibility === 'private' ? 'Solo miembros' : 'Visible para todos'}</Chip>
            </View>
            {isEditing ? (
              <Text className="mt-2 text-sm font-bold leading-5 text-muted-text">
                En edición no puedes mover la quedada a otra comunidad.
              </Text>
            ) : null}
            <Text className="mt-2.5 text-sm font-bold leading-5 text-muted-text">
              {labelForCommunityKind(selectedCommunity.kind)} · {selectedCommunity.city}
            </Text>
          </>
        ) : null}

        <View className="mt-4 gap-3">
          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Título</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  onChangeText={onChange}
                  placeholder="Tirada del domingo"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Lugar</Text>
            <Controller
              control={control}
              name="location"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  onChangeText={onChange}
                  placeholder="Parque del Retiro"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Distancia (km)</Text>
            <Controller
              control={control}
              name="distanceKm"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  keyboardType="numeric"
                  onChangeText={onChange}
                  placeholder="8"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Fecha y hora</Text>
            <Controller
              control={control}
              name="startsAt"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  autoCapitalize="none"
                  onChangeText={onChange}
                  placeholder="2026-05-02 19:30"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
          </View>
        </View>

        {formError ? (
          <View style={[styles.errorCard, { backgroundColor: colors.chip }]}>
            <Text className="text-sm font-extrabold leading-5 text-danger">{formError}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={isSubmitting}
          onPress={onSubmit}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : isSubmitting ? 0.7 : 1 })}
          className={`mt-[18px] items-center rounded-[18px] bg-tint py-4`}>
          <Text className="text-base font-black text-on-tint">
            {isSubmitting ? (isEditing ? 'Guardando...' : 'Publicando...') : submitLabel}
          </Text>
        </Pressable>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderRadius: 16,
    marginTop: 14,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
