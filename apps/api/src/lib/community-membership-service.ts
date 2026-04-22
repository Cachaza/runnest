import { randomUUID } from 'node:crypto'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

import { communities, db, member, organization } from '@apprunners/db'

type Database = typeof db

type CommunityMetadata = {
  kind: 'crew_local' | 'creator_community' | 'club' | 'training_group'
  mode: 'collaborative' | 'managed'
  visibility: 'public' | 'private'
}

type CommunityRole = 'owner' | 'admin' | 'moderator' | 'host' | 'member'

type CreateCommunityRecordInput = {
  city: string
  cityLat: number | null
  cityLng: number | null
  cityProvince: string | null
  citySlug: string | null
  description: string
  kind: CommunityMetadata['kind']
  mode: CommunityMetadata['mode']
  name: string
  ownerUserId: string
  pace: string | null
  slug: string
  vibe: string | null
  visibility: CommunityMetadata['visibility']
}

function isDatabaseError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error
}

function mapCommunityMembershipError(input: {
  error: unknown
  fallbackMessage: string
  conflictMessage?: string
  notFoundMessage?: string
}) {
  const { conflictMessage, error, fallbackMessage, notFoundMessage } = input

  if (error instanceof TRPCError) {
    return error
  }

  if (isDatabaseError(error) && error.code === '23505') {
    return new TRPCError({
      code: 'CONFLICT',
      message: conflictMessage ?? fallbackMessage,
    })
  }

  if (isDatabaseError(error) && error.code === '23503') {
    return new TRPCError({
      code: 'NOT_FOUND',
      message: notFoundMessage ?? fallbackMessage,
    })
  }

  return new TRPCError({
    code: 'BAD_REQUEST',
    message: fallbackMessage,
  })
}

async function getMemberRecord(db: Database, organizationId: string, userId: string) {
  const [membership] = await db
    .select({
      id: member.id,
      role: member.role,
    })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1)

  return membership ?? null
}

export async function createCommunityMembershipRecord(db: Database, input: CreateCommunityRecordInput) {
  try {
    return await db.transaction(async (tx) => {
      const [existingCommunity] = await tx
        .select({ id: communities.organizationId })
        .from(communities)
        .where(eq(communities.slug, input.slug))
        .limit(1)

      if (existingCommunity) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Ese slug ya está en uso.' })
      }

      const [existingOrganization] = await tx
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, input.slug))
        .limit(1)

      if (existingOrganization) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Ese slug ya está en uso.' })
      }

      const organizationId = randomUUID()
      const now = new Date()
      const metadata = JSON.stringify({
        kind: input.kind,
        mode: input.mode,
        visibility: input.visibility,
      } satisfies CommunityMetadata)

      await tx.insert(organization).values({
        createdAt: now,
        id: organizationId,
        metadata,
        name: input.name,
        slug: input.slug,
        updatedAt: now,
      })

      await tx.insert(member).values({
        createdAt: now,
        id: randomUUID(),
        organizationId,
        role: 'owner',
        userId: input.ownerUserId,
      })

      await tx.insert(communities).values({
        city: input.city,
        cityLat: input.cityLat,
        cityLng: input.cityLng,
        cityProvince: input.cityProvince,
        citySlug: input.citySlug,
        createdAt: now,
        description: input.description,
        kind: input.kind,
        mode: input.mode,
        name: input.name,
        organizationId,
        pace: input.pace,
        slug: input.slug,
        updatedAt: now,
        vibe: input.vibe,
        visibility: input.visibility,
      })

      return {
        id: organizationId,
        slug: input.slug,
      }
    })
  } catch (error) {
    throw mapCommunityMembershipError({
      conflictMessage: 'Ese slug ya está en uso.',
      error,
      fallbackMessage: 'No se pudo crear la comunidad.',
      notFoundMessage: 'No se pudo encontrar el usuario propietario para crear la comunidad.',
    })
  }
}

export async function addMemberToCommunity(input: {
  db: Database
  organizationId: string
  role: CommunityRole
  userId: string
}) {
  const existingMembership = await getMemberRecord(input.db, input.organizationId, input.userId)

  if (existingMembership) {
    return {
      created: false,
      id: existingMembership.id,
      role: existingMembership.role,
    }
  }

  try {
    const [createdMembership] = await input.db
      .insert(member)
      .values({
        createdAt: new Date(),
        id: randomUUID(),
        organizationId: input.organizationId,
        role: input.role,
        userId: input.userId,
      })
      .returning({
        id: member.id,
        role: member.role,
      })

    return {
      created: true,
      id: createdMembership.id,
      role: createdMembership.role,
    }
  } catch (error) {
    const mappedError = mapCommunityMembershipError({
      conflictMessage: 'Ese usuario ya forma parte de la comunidad.',
      error,
      fallbackMessage: 'No se pudo actualizar la membresía de la comunidad.',
      notFoundMessage: 'No existe esa comunidad o ese usuario.',
    })

    if (mappedError.code === 'CONFLICT') {
      const membership = await getMemberRecord(input.db, input.organizationId, input.userId)

      if (membership) {
        return {
          created: false,
          id: membership.id,
          role: membership.role,
        }
      }
    }

    throw mappedError
  }
}

export async function updateCommunityMemberRole(input: {
  db: Database
  memberId: string
  organizationId: string
  role: CommunityRole
}) {
  try {
    const [updatedMembership] = await input.db
      .update(member)
      .set({
        role: input.role,
      })
      .where(and(eq(member.id, input.memberId), eq(member.organizationId, input.organizationId)))
      .returning({
        id: member.id,
      })

    if (!updatedMembership) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontró ese miembro en la comunidad.',
      })
    }

    return updatedMembership
  } catch (error) {
    throw mapCommunityMembershipError({
      error,
      fallbackMessage: 'No se pudo actualizar el rol.',
      notFoundMessage: 'No se encontró ese miembro en la comunidad.',
    })
  }
}

export async function removeMemberFromCommunity(input: {
  db: Database
  memberId: string
  organizationId: string
}) {
  try {
    const [deletedMembership] = await input.db
      .delete(member)
      .where(and(eq(member.id, input.memberId), eq(member.organizationId, input.organizationId)))
      .returning({
        id: member.id,
      })

    if (!deletedMembership) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontró ese miembro en la comunidad.',
      })
    }

    return deletedMembership
  } catch (error) {
    throw mapCommunityMembershipError({
      error,
      fallbackMessage: 'No se pudo expulsar al miembro.',
      notFoundMessage: 'No se encontró ese miembro en la comunidad.',
    })
  }
}

export async function leaveCommunityMembership(input: {
  db: Database
  organizationId: string
  userId: string
}) {
  try {
    const [deletedMembership] = await input.db
      .delete(member)
      .where(and(eq(member.organizationId, input.organizationId), eq(member.userId, input.userId)))
      .returning({
        id: member.id,
      })

    return deletedMembership ?? null
  } catch (error) {
    throw mapCommunityMembershipError({
      error,
      fallbackMessage: 'No se pudo salir de la comunidad.',
      notFoundMessage: 'No se encontró esa membresía.',
    })
  }
}
