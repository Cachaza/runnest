import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { Chip } from '@/components/ui/AppUI';
import { labelForCommunityKind } from '@/lib/community-labels';
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
  const utils = trpc.useUtils();
  const [formError, setFormError] = useState<string | null>(null);
  const communitiesQuery = trpc.communities.hostable.useQuery();
  const createMeetup = trpc.meetups.create.useMutation({
    onSuccess: async () => {
      await utils.meetups.upcomingPublic.invalidate();
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

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    if (!values.communityId) {
      setFormError('Elige una comunidad antes de publicar la quedada.');
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

    await createMeetup.mutateAsync(parsed.data);
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="justify-center p-[18px]">
      <View className="rounded-[32px] border border-border bg-surface p-[22px]">
        <Text className="text-xs font-black uppercase tracking-[1.1px] text-tint">Host a run</Text>
        <Text className="mt-2.5 text-[32px] font-black leading-9 text-text">Monta la próxima quedada de tu comunidad.</Text>
        <Text className="mt-3 text-[15px] leading-[23px] text-muted-text">
          Elige una comunidad donde puedas organizar, define la ruta base y publica un plan fácil de entender.
        </Text>

        <Text className="mt-[18px] text-[13px] font-black uppercase tracking-[0.8px] text-muted-text">Comunidad</Text>
        <View className="mt-3 flex-row flex-wrap gap-2.5">
          {communitiesQuery.data?.map((community) => (
            <Chip
              key={community.id}
              selected={selectedCommunityId === community.id}
              onPress={() => {
                setValue('communityId', community.id);
                setFormError(null);
              }}>
              {community.name}
            </Chip>
          ))}
        </View>

        {communitiesQuery.error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{communitiesQuery.error.message}</Text>
        ) : null}

        {!communitiesQuery.isPending && !communitiesQuery.error && (communitiesQuery.data?.length ?? 0) === 0 ? (
          <Text className="mt-2.5 text-sm font-bold leading-5 text-muted-text">
            Aún no perteneces a ninguna comunidad donde puedas organizar quedadas.
          </Text>
        ) : null}

        {selectedCommunity ? (
          <Text className="mt-2.5 text-sm font-bold leading-5 text-muted-text">
            {labelForCommunityKind(selectedCommunity.kind)} · {selectedCommunity.city}
            {selectedCommunity.pace ? ` · ${selectedCommunity.pace}` : ''}
            {selectedCommunity.vibe ? ` · ${selectedCommunity.vibe}` : ''}
          </Text>
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
                  placeholder="Sunset social run"
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
          disabled={createMeetup.isPending}
          onPress={onSubmit}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : createMeetup.isPending ? 0.7 : 1 })}
          className={`mt-[18px] items-center rounded-[18px] bg-tint py-4`}>
          <Text className="text-base font-black text-[#FFF8EC]">
            {createMeetup.isPending ? 'Publicando...' : 'Publicar quedada'}
          </Text>
        </Pressable>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
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
