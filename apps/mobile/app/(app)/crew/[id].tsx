import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import { AppButton, AppCard, Chip, EmptyState, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { labelForCommunityKind, labelForMode, labelForVisibility, lowerLabelForCommunityKind } from '@/lib/community-labels';
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

function formatShortDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function inviteRoleOptionsForViewer(role?: string | null) {
  if (role === 'owner') {
    return ['admin', 'moderator', 'host', 'member'] as const;
  }

  if (role === 'admin') {
    return ['moderator', 'host', 'member'] as const;
  }

  return [] as const;
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

function accessClaimStatusLabel(status: 'pending' | 'approved' | 'rejected' | 'cancelled') {
  switch (status) {
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled':
      return 'Cancelado';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

export default function CrewDetailScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const communityId = rawId ?? null;
  const utils = trpc.useUtils();
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'moderator' | 'host' | 'member'>('member');
  const [accessLinkRole, setAccessLinkRole] = useState<'admin' | 'moderator' | 'host' | 'member'>('member');
  const [accessLinkSourceLabel, setAccessLinkSourceLabel] = useState('');
  const [accessLinkExpiresDays, setAccessLinkExpiresDays] = useState('14');
  const [accessLinkMaxUses, setAccessLinkMaxUses] = useState('');
  const [accessLinkRequiresApproval, setAccessLinkRequiresApproval] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const communityQuery = trpc.communities.byId.useQuery(
    { id: communityId ?? '' },
    {
      enabled: Boolean(communityId),
      retry: false,
    },
  );
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const joinMutation = trpc.communities.joinPublic.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await Promise.all([
        utils.communities.byId.invalidate({ id: communityId }),
        utils.communities.myMemberships.invalidate(),
        utils.communities.hostable.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo unir', error.message);
    },
  });
  const leaveMutation = trpc.communities.leave.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await Promise.all([
        utils.communities.byId.invalidate({ id: communityId }),
        utils.communities.myMemberships.invalidate(),
        utils.communities.hostable.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo salir', error.message);
    },
  });
  const inviteMutation = trpc.communities.inviteByUsername.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setInviteUsername('');
      setInviteRole('member');
      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo enviar la invitación', error.message);
    },
  });
  const cancelInviteMutation = trpc.communities.cancelInvite.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo cancelar la invitación', error.message);
    },
  });
  const updateRoleMutation = trpc.communities.updateMemberRole.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar el rol', error.message);
    },
  });
  const removeMemberMutation = trpc.communities.removeMember.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo expulsar al miembro', error.message);
    },
  });
  const blockUserMutation = trpc.communities.blockUser.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setBlockReason('');
      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo bloquear al usuario', error.message);
    },
  });
  const unblockUserMutation = trpc.communities.unblockUser.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo desbloquear al usuario', error.message);
    },
  });
  const createAccessLinkMutation = trpc.communities.createAccessLink.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setAccessLinkRole('member');
      setAccessLinkSourceLabel('');
      setAccessLinkExpiresDays('14');
      setAccessLinkMaxUses('');
      setAccessLinkRequiresApproval(false);
      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo crear el access link', error.message);
    },
  });
  const revokeAccessLinkMutation = trpc.communities.revokeAccessLink.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo revocar el access link', error.message);
    },
  });
  const approveAccessClaimMutation = trpc.communities.approveAccessClaim.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo aprobar la solicitud', error.message);
    },
  });
  const rejectAccessClaimMutation = trpc.communities.rejectAccessClaim.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo rechazar la solicitud', error.message);
    },
  });
  const community = communityQuery.data?.community;
  const entityLabel = labelForCommunityKind(community?.kind);
  const entityLabelLower = lowerLabelForCommunityKind(community?.kind);
  const inviteRoleOptions = useMemo(
    () => inviteRoleOptionsForViewer(community?.viewerMembershipRole),
    [community?.viewerMembershipRole],
  );
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const isMutatingMembership = joinMutation.isPending || leaveMutation.isPending;
  const isMutatingStaff =
    inviteMutation.isPending ||
    cancelInviteMutation.isPending ||
    createAccessLinkMutation.isPending ||
    revokeAccessLinkMutation.isPending ||
    approveAccessClaimMutation.isPending ||
    rejectAccessClaimMutation.isPending ||
    updateRoleMutation.isPending ||
    removeMemberMutation.isPending ||
    blockUserMutation.isPending ||
    unblockUserMutation.isPending;
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    if (!communityId) {
      return;
    }

    await communityQuery.refetch();
  });

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  async function handleMembershipAction() {
    if (!community || !communityId) {
      return;
    }

    if (community.viewerMembershipRole) {
      await leaveMutation.mutateAsync({ communityId });
      return;
    }

    await joinMutation.mutateAsync({ communityId });
  }

  async function handleInvite() {
    if (!communityId || !inviteUsername.trim()) {
      Alert.alert('Falta username', 'Escribe el username exacto de la persona que quieres invitar.');
      return;
    }

    await inviteMutation.mutateAsync({
      communityId,
      role: inviteRole,
      username: inviteUsername.trim().replace(/^@+/, '').toLowerCase(),
    });
  }

  async function handleCreateAccessLink() {
    if (!communityId) {
      return;
    }

    const expiresInDays = Number.parseInt(accessLinkExpiresDays, 10);
    const maxUses = accessLinkMaxUses.trim() ? Number.parseInt(accessLinkMaxUses, 10) : null;

    if (Number.isNaN(expiresInDays) || expiresInDays <= 0) {
      Alert.alert('Expiración inválida', 'Usa un número de días válido para la expiración.');
      return;
    }

    if (maxUses !== null && (Number.isNaN(maxUses) || maxUses <= 0)) {
      Alert.alert('Límite inválido', 'Si defines un límite de usos, debe ser un número positivo.');
      return;
    }

    await createAccessLinkMutation.mutateAsync({
      communityId,
      defaultRole: accessLinkRole,
      expiresInDays,
      maxUses,
      requiresApproval: accessLinkRequiresApproval,
      sourceLabel: accessLinkSourceLabel.trim() || undefined,
    });
  }

  async function handleShareAccessCode(code: string) {
    if (!community?.name) {
      return;
    }

    const accessUrl = Linking.createURL('/community-access', {
      queryParams: { code },
    });

    await Share.share({
      message: `Únete a ${community.name} en AppRunners con el código ${code}. También puedes abrirlo directo aquí: ${accessUrl}`,
    });
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'moderator' | 'host' | 'member') {
    if (!communityId) {
      return;
    }

    await updateRoleMutation.mutateAsync({
      communityId,
      role,
      userId,
    });
  }

  async function handleRemoveMember(userId: string) {
    if (!communityId) {
      return;
    }

    await removeMemberMutation.mutateAsync({
      communityId,
      userId,
    });
  }

  async function handleBlockUser(userId: string) {
    if (!communityId) {
      return;
    }

    await blockUserMutation.mutateAsync({
      communityId,
      reason: blockReason.trim() || undefined,
      userId,
    });
  }

  async function handleUnblockUser(userId: string) {
    if (!communityId) {
      return;
    }

    await unblockUserMutation.mutateAsync({
      communityId,
      userId,
    });
  }

  if (communityQuery.error) {
    return (
      <ScreenScroll onRefresh={communityId ? onRefresh : undefined} refreshing={refreshing}>
        <AppCard>
          <Text className="text-[25px] font-black text-text">Comunidad no disponible</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{communityQuery.error.message}</Text>
        </AppCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll onRefresh={communityId ? onRefresh : undefined} refreshing={refreshing}>
      <HeroPanel
        body={community?.description ?? 'Cargando detalle de la comunidad...'}
        kicker={community ? `${entityLabel} · ${community.city}` : 'Community'}
        title={community?.name ?? 'Cargando...'}>
        {community ? (
          <View className="mt-5 gap-3">
            <View className="flex-row flex-wrap gap-2.5">
              {community.pace ? <Chip tone="cool">{community.pace}</Chip> : null}
              {community.vibe ? <Chip tone="neutral">{community.vibe}</Chip> : null}
              <Chip tone="warm">{labelForMode(community.mode)}</Chip>
              <Chip tone="neutral">{labelForVisibility(community.visibility)}</Chip>
              {community.viewerMembershipRole ? <Chip tone="warm">{roleLabel(community.viewerMembershipRole)}</Chip> : null}
            </View>

            {community.viewerCanCreateRuns ? (
              <AppButton
                disabled={isMutatingStaff}
                onPress={() => router.push({ pathname: '/modal', params: { communityId } } as any)}>
                Crear quedada en esta comunidad
              </AppButton>
            ) : null}

            {community.visibility === 'public' ? (
              <AppButton
                disabled={isMutatingMembership || community.viewerMembershipRole === 'owner'}
                onPress={handleMembershipAction}>
                {community.viewerMembershipRole
                  ? isMutatingMembership
                    ? 'Saliendo...'
                    : community.viewerMembershipRole === 'owner'
                      ? 'Owner'
                      : 'Salir de la comunidad'
                  : isMutatingMembership
                    ? 'Uniéndote...'
                    : 'Unirme a esta comunidad'}
              </AppButton>
            ) : !community.viewerMembershipRole ? (
              <Text className="text-sm font-bold leading-5 text-hero-text-muted">
                Esta comunidad es privada y entra por invitación.
              </Text>
            ) : null}
          </View>
        ) : null}
      </HeroPanel>

      {community?.viewerCanInviteMembers ? (
        <>
          <SectionHeader loading={communityQuery.isPending} title="Invitar por username" />
          <AppCard>
            <Text className="text-[15px] leading-[23px] text-muted-text">
              Invita a gente que ya está dentro de la app. El acceso se acepta o rechaza in-app.
            </Text>

            <TextInput
              autoCapitalize="none"
              onChangeText={setInviteUsername}
              placeholder="@username"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={inviteUsername}
            />

            <View className="flex-row flex-wrap gap-2.5">
              {inviteRoleOptions.map((role) => (
                <Chip key={role} selected={inviteRole === role} onPress={() => setInviteRole(role)}>
                  {roleLabel(role)}
                </Chip>
              ))}
            </View>

            <AppButton disabled={isMutatingStaff} onPress={handleInvite}>
              {inviteMutation.isPending ? 'Invitando...' : 'Enviar invitación'}
            </AppButton>
          </AppCard>

          <SectionHeader loading={communityQuery.isPending} title="Invitaciones pendientes" />

          {!communityQuery.isPending && communityQuery.data?.pendingInvites.length === 0 ? (
            <EmptyState
              title="Sin invitaciones pendientes."
              body="Las invitaciones por username activas aparecerán aquí hasta que se acepten, rechacen o cancelen."
            />
          ) : null}

          {communityQuery.data?.pendingInvites.map((invite) => (
            <AppCard key={invite.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">@{invite.invitedUsername}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    Invitó {invite.invitedByName} · expira {formatShortDate(invite.expiresAt)}
                  </Text>
                </View>
                <Chip tone="warm">{roleLabel(invite.role)}</Chip>
              </View>
              {invite.canCancel ? (
                <Pressable
                  disabled={isMutatingStaff}
                  onPress={() => cancelInviteMutation.mutateAsync({ inviteId: invite.id })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                  className="mt-2 self-start rounded-[18px] bg-chip px-4 py-3">
                  <Text className="text-sm font-black text-text">Cancelar invitación</Text>
                </Pressable>
              ) : null}
            </AppCard>
          ))}

          <SectionHeader loading={communityQuery.isPending} title="Access links" />

          <AppCard>
            <Text className="text-[15px] leading-[23px] text-muted-text">
              Crea códigos reutilizables para compartir en bio, stories o mensajes directos. Puedes exigir aprobación
              antes de aceptar a la gente.
            </Text>
            <Text className="text-sm font-bold leading-5 text-muted-text">
              {community.kind === 'creator_community'
                ? 'Creator community: approval recomendado por defecto para no abrir acceso masivo sin filtro.'
                : community.kind === 'club' && community.visibility === 'private'
                  ? 'Club privado: los access links se fuerzan con approval para proteger la entrada.'
                  : community.kind === 'crew_local' && community.visibility === 'public'
                    ? 'Crew local pública: un link abierto puede funcionar bien, pero compártelo solo si quieres auto-join.'
                    : 'Si compartes un link abierto, cualquiera con el código podrá intentar entrar.'}
            </Text>

            <TextInput
              onChangeText={setAccessLinkSourceLabel}
              placeholder="instagram-bio"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={accessLinkSourceLabel}
            />

            <View className="flex-row flex-wrap gap-2.5">
              {inviteRoleOptions.map((role) => (
                <Chip
                  key={`access-link-${role}`}
                  selected={accessLinkRole === role}
                  onPress={() => setAccessLinkRole(role)}>
                  {roleLabel(role)}
                </Chip>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TextInput
                keyboardType="number-pad"
                onChangeText={setAccessLinkExpiresDays}
                placeholder="14"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.halfInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={accessLinkExpiresDays}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={setAccessLinkMaxUses}
                placeholder="100 usos"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.halfInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={accessLinkMaxUses}
              />
            </View>

            <View className="flex-row flex-wrap gap-2.5">
              <Chip
                selected={!accessLinkRequiresApproval}
                onPress={() => setAccessLinkRequiresApproval(false)}>
                Acceso directo
              </Chip>
              <Chip
                selected={accessLinkRequiresApproval}
                onPress={() => setAccessLinkRequiresApproval(true)}>
                Con aprobación
              </Chip>
            </View>

            <AppButton disabled={isMutatingStaff} onPress={handleCreateAccessLink}>
              {createAccessLinkMutation.isPending ? 'Creando link...' : 'Crear access link'}
            </AppButton>
          </AppCard>

          {!communityQuery.isPending && communityQuery.data?.accessLinks.length === 0 ? (
            <EmptyState
              title="Sin access links activos."
              body="Crea uno para compartir acceso reutilizable fuera o dentro de la app."
            />
          ) : null}

          {communityQuery.data?.accessLinks.map((accessLink) => (
            <AppCard key={accessLink.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{accessLink.code}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    {accessLink.sourceLabel || 'sin etiqueta'} · expira {formatShortDate(accessLink.expiresAt)}
                  </Text>
                </View>
                <Chip tone="warm">{roleLabel(accessLink.defaultRole)}</Chip>
              </View>
              <View className="mt-2 flex-row flex-wrap gap-2.5">
                <Chip tone="cool">{accessLink.requiresApproval ? 'Con aprobación' : 'Auto join'}</Chip>
                <Chip tone="neutral">
                  {accessLink.maxUses ? `${accessLink.usesCount}/${accessLink.maxUses}` : `${accessLink.usesCount} usos`}
                </Chip>
                <Chip tone="warm">{accessLink.approvedClaims} approved</Chip>
                {accessLink.pendingClaims > 0 ? (
                  <Chip tone="warm">{accessLink.pendingClaims} pending</Chip>
                ) : null}
                <Chip tone={accessLink.isActive ? 'warm' : 'neutral'}>
                  {accessLink.isActive ? 'Active' : 'Revoked'}
                </Chip>
              </View>
              <View className="mt-3 flex-row gap-2.5">
                <Pressable
                  disabled={isMutatingStaff}
                  onPress={() => handleShareAccessCode(accessLink.code)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                  className="flex-1 items-center rounded-[18px] bg-chip py-[15px]">
                  <Text className="text-[15px] font-black text-text">Compartir</Text>
                </Pressable>
                {accessLink.canRevoke ? (
                  <Pressable
                    disabled={isMutatingStaff}
                    onPress={() => revokeAccessLinkMutation.mutateAsync({ accessLinkId: accessLink.id })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                    className="flex-1 items-center rounded-[18px] bg-chip py-[15px]">
                    <Text className="text-[15px] font-black text-text">Revocar</Text>
                  </Pressable>
                ) : null}
              </View>
            </AppCard>
          ))}

          <SectionHeader loading={communityQuery.isPending} title="Atribución por origen" />

          {!communityQuery.isPending && communityQuery.data?.accessLinkSources.length === 0 ? (
            <EmptyState
              title="Sin datos de atribución todavía."
              body="Cuando uses links con sourceLabel, aquí verás qué canal trae más uso y más aprobaciones."
            />
          ) : null}

          {communityQuery.data?.accessLinkSources.map((source) => (
            <AppCard key={source.sourceLabel}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{source.sourceLabel}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    {source.totalLinks} links · {source.totalUses} usos
                  </Text>
                </View>
                <Chip tone="warm">{source.approvedClaims} approved</Chip>
              </View>
              <View className="mt-2 flex-row flex-wrap gap-2.5">
                {source.pendingClaims > 0 ? <Chip tone="cool">{source.pendingClaims} pending</Chip> : null}
                <Chip tone="neutral">{source.totalUses} uses</Chip>
              </View>
            </AppCard>
          ))}

          <SectionHeader loading={communityQuery.isPending} title="Solicitudes de access link" />

          {!communityQuery.isPending && communityQuery.data?.pendingAccessClaims.length === 0 ? (
            <EmptyState
              title="Sin solicitudes pendientes."
              body="Las solicitudes que entren por links con aprobación aparecerán aquí."
            />
          ) : null}

          {communityQuery.data?.pendingAccessClaims.map((claim) => (
            <AppCard key={claim.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{claim.userName}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    @{claim.username} · {claim.sourceLabel || claim.accessLinkCode}
                  </Text>
                </View>
                <Chip tone="warm">{formatShortDate(claim.requestedAt)}</Chip>
              </View>
              <View className="mt-3 flex-row gap-2.5">
                <Pressable
                  disabled={isMutatingStaff}
                  onPress={() => approveAccessClaimMutation.mutateAsync({ claimId: claim.id })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                  className="flex-1 items-center rounded-[18px] bg-tint py-[15px]">
                  <Text className="text-[15px] font-black text-on-tint">Aprobar</Text>
                </Pressable>
                <Pressable
                  disabled={isMutatingStaff}
                  onPress={() => rejectAccessClaimMutation.mutateAsync({ claimId: claim.id })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                  className="flex-1 items-center rounded-[18px] bg-chip py-[15px]">
                  <Text className="text-[15px] font-black text-text">Rechazar</Text>
                </Pressable>
              </View>
            </AppCard>
          ))}

          <SectionHeader loading={communityQuery.isPending} title="Historial reciente de claims" />

          {!communityQuery.isPending && communityQuery.data?.recentAccessClaims.length === 0 ? (
            <EmptyState
              title="Sin historial todavía."
              body="Cuando alguien use un access link, aquí verás el estado final o pendiente de su solicitud."
            />
          ) : null}

          {communityQuery.data?.recentAccessClaims.map((claim) => (
            <AppCard key={claim.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{claim.userName}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    @{claim.username} · {claim.sourceLabel || claim.accessLinkCode}
                  </Text>
                </View>
                <Chip tone={claim.status === 'approved' ? 'warm' : claim.status === 'pending' ? 'cool' : 'neutral'}>
                  {accessClaimStatusLabel(claim.status)}
                </Chip>
              </View>
              <Text className="mt-2 text-[15px] leading-[23px] text-muted-text">
                Solicitud {formatShortDate(claim.requestedAt)}
                {claim.reviewedAt ? ` · revisión ${formatShortDate(claim.reviewedAt)}` : ''}
              </Text>
            </AppCard>
          ))}
        </>
      ) : null}

      <SectionHeader loading={communityQuery.isPending} title="Próximas quedadas" />

      {!communityQuery.isPending && communityQuery.data?.upcomingMeetups.length === 0 ? (
        <EmptyState
          title="Sin quedadas futuras."
          body={`Cuando esta ${entityLabelLower} publique una salida o preparación de carrera, aparecerá aquí.`}
        />
      ) : null}

      {communityQuery.data?.upcomingMeetups.map((meetup) => (
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

      {community?.viewerMembershipRole ? (
        <>
          <SectionHeader loading={communityQuery.isPending} title="Miembros" />

          {!communityQuery.isPending && communityQuery.data?.members.length === 0 ? (
            <EmptyState
              title="Sin miembros visibles."
              body="Los miembros aparecerán aquí cuando formen parte activa de la comunidad."
            />
          ) : null}

          {communityQuery.data?.members.map((communityMember) => (
            <AppCard key={communityMember.userId}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{communityMember.name}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    @{communityMember.username} · dentro desde {formatShortDate(communityMember.joinedAt)}
                  </Text>
                </View>
                <Chip tone="warm">{roleLabel(communityMember.primaryRole)}</Chip>
              </View>

              {communityMember.availableRoleTargets.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2.5">
                  {communityMember.availableRoleTargets.map((role) => (
                    <Chip
                      key={`${communityMember.userId}-${role}`}
                      onPress={() => handleRoleChange(communityMember.userId, role)}>
                      {roleLabel(role)}
                    </Chip>
                  ))}
                </View>
              ) : null}

              {(communityMember.canRemove || communityMember.canBlock) && !communityMember.isViewer ? (
                <View className="mt-3 gap-3">
                  {communityMember.canRemove ? (
                    <Pressable
                      disabled={isMutatingStaff}
                      onPress={() => handleRemoveMember(communityMember.userId)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                      className="self-start rounded-[18px] bg-chip px-4 py-3">
                      <Text className="text-sm font-black text-text">Expulsar</Text>
                    </Pressable>
                  ) : null}
                  {communityMember.canBlock ? (
                    <View className="gap-2.5">
                      <TextInput
                        onChangeText={setBlockReason}
                        placeholder="Motivo opcional del bloqueo"
                        placeholderTextColor={colors.mutedText}
                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        value={blockReason}
                      />
                      <Pressable
                        disabled={isMutatingStaff}
                        onPress={() => handleBlockUser(communityMember.userId)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                        className="self-start rounded-[18px] bg-chip px-4 py-3">
                        <Text className="text-sm font-black text-danger">Bloquear</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </AppCard>
          ))}
        </>
      ) : (
        <>
          <SectionHeader loading={communityQuery.isPending} title={`Runners en esta ${entityLabelLower}`} />

          {!communityQuery.isPending && communityQuery.data?.activeRunners.length === 0 ? (
            <EmptyState
              title="Aún sin runners públicos."
              body="Los runners aparecerán cuando creen o confirmen quedadas de esta comunidad."
            />
          ) : null}

          {communityQuery.data?.activeRunners.map((runner) => (
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
        </>
      )}

      {community?.viewerCanBlockUsers ? (
        <>
          <SectionHeader loading={communityQuery.isPending} title="Bloqueos" />

          {!communityQuery.isPending && communityQuery.data?.blockedUsers.length === 0 ? (
            <EmptyState
              title="Sin usuarios bloqueados."
              body="Los bloqueos activos aparecerán aquí para que el staff pueda revisarlos."
            />
          ) : null}

          {communityQuery.data?.blockedUsers.map((blockedUser) => (
            <AppCard key={blockedUser.userId}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">{blockedUser.name}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    @{blockedUser.username} · bloqueado {formatShortDate(blockedUser.blockedAt)}
                  </Text>
                  {blockedUser.reason ? (
                    <Text className="mt-2 text-[15px] leading-[23px] text-muted-text">{blockedUser.reason}</Text>
                  ) : null}
                </View>
                {blockedUser.canUnblock ? (
                  <Pressable
                    disabled={isMutatingStaff}
                    onPress={() => handleUnblockUser(blockedUser.userId)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1 })}
                    className="rounded-[18px] bg-chip px-4 py-3">
                    <Text className="text-sm font-black text-text">Desbloquear</Text>
                  </Pressable>
                ) : null}
              </View>
            </AppCard>
          ))}
        </>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  halfInput: {
    flex: 1,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
