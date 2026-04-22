import { randomUUID } from 'node:crypto'

import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, gte, ilike, inArray, or } from 'drizzle-orm'
import { z } from 'zod'

import {
  communityAccessLinkClaims,
  communityAccessLinks,
  communities,
  communityBlocks,
  communityJoinRequests,
  communityUserInvites,
  meetups,
  meetupRsvps,
  member,
  profiles,
  user,
} from '@apprunners/db'
import { searchMunicipalities } from '@apprunners/geo'

import { COMMUNITY_ROLE_ORDER, type CommunityRoleName } from '../lib/community-auth.js'
import {
  addMemberToCommunity,
  createCommunityMembershipRecord,
  leaveCommunityMembership,
  removeMemberFromCommunity,
  updateCommunityMemberRole,
} from '../lib/community-membership-service.js'
import { geocodeWithCartociudad } from '../lib/geocoding/cartociudad.js'
import { geocodeWithNominatim } from '../lib/geocoding/nominatim.js'
import { createTRPCRouter, protectedProcedure, publicProcedure } from './init.js'

function parsePaceToSeconds(pace: string) {
  const match = pace.match(/(\d+):(\d+)/)

  if (!match) {
    return null
  }

  return Number(match[1]) * 60 + Number(match[2])
}

const availabilitySlotSchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  period: z.enum(['morning', 'midday', 'afternoon', 'evening']),
})

type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>

const communityKindSchema = z.enum(['crew_local', 'creator_community', 'club', 'training_group'])
const communityModeSchema = z.enum(['collaborative', 'managed'])
const communityVisibilitySchema = z.enum(['public', 'private'])
const meetupVisibilitySchema = z.enum(['public', 'members'])
const communityRoleSchema = z.enum(['owner', 'admin', 'moderator', 'host', 'member'])

function listFromCommaValue(value: string | null | undefined) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isPresent<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

function targetDistanceFromPreference(distance: string | null | undefined) {
  const normalized = normalizeText(distance)

  if (normalized.includes('maraton') && !normalized.includes('media')) {
    return 42
  }

  if (normalized.includes('media')) {
    return 21
  }

  const match = normalized.match(/(\d+)/)

  return match ? Number(match[1]) : null
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function haversineDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(toLatitude - fromLatitude)
  const longitudeDelta = toRadians(toLongitude - fromLongitude)
  const fromLatitudeRadians = toRadians(fromLatitude)
  const toLatitudeRadians = toRadians(toLatitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine))
}

function roundedDistanceKm(distanceKm: number) {
  return Math.round(distanceKm * 10) / 10
}

function availabilitySlotFromDate(date: Date): AvailabilitySlot {
  const days: AvailabilitySlot['day'][] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const hour = date.getHours()
  const period =
    hour < 11 ? 'morning' : hour < 15 ? 'midday' : hour < 20 ? 'afternoon' : 'evening'

  return {
    day: days[date.getDay()],
    period,
  }
}

function availabilitySlotsOverlap(profileSlots: AvailabilitySlot[], meetupDates: Date[]) {
  const profileSlotKeys = new Set(profileSlots.map((slot) => `${slot.day}:${slot.period}`))

  return meetupDates.some((date) => {
    const slot = availabilitySlotFromDate(date)

    return profileSlotKeys.has(`${slot.day}:${slot.period}`)
  })
}

function parseRoleList(role: string | null | undefined) {
  return role
    ? role
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function getPrimaryRole(role: string | null | undefined) {
  const roleSet = new Set(parseRoleList(role))

  for (const currentRole of COMMUNITY_ROLE_ORDER) {
    if (roleSet.has(currentRole)) {
      return currentRole
    }
  }

  return null
}

function hasAnyRole(
  role: string | null | undefined,
  allowedRoles: readonly CommunityRoleName[],
) {
  const roleSet = new Set(parseRoleList(role))

  return allowedRoles.some((allowedRole) => roleSet.has(allowedRole))
}

function canOrganizeCommunityMeetup(
  mode: z.infer<typeof communityModeSchema>,
  role: string | null | undefined,
) {
  if (!role) {
    return false
  }

  if (mode === 'collaborative') {
    return parseRoleList(role).length > 0
  }

  return hasAnyRole(role, ['owner', 'admin', 'host'])
}

function canViewerSeeMeetup(
  viewerIsMember: boolean,
  communityVisibility: z.infer<typeof communityVisibilitySchema>,
  meetupVisibility: z.infer<typeof meetupVisibilitySchema>,
) {
  if (viewerIsMember) {
    return true
  }

  return communityVisibility === 'public' && meetupVisibility === 'public'
}

function assignableRolesForActor(actorRole: CommunityRoleName | null) {
  switch (actorRole) {
    case 'owner':
      return ['admin', 'moderator', 'host', 'member'] as const
    case 'admin':
      return ['moderator', 'host', 'member'] as const
    default:
      return [] as const
  }
}

function canInviteMembers(actorRole: CommunityRoleName | null) {
  return assignableRolesForActor(actorRole).length > 0
}

function canManageRole(actorRole: CommunityRoleName | null) {
  return assignableRolesForActor(actorRole).length > 0
}

function canManageTargetMember(
  actorRole: CommunityRoleName | null,
  targetRole: CommunityRoleName | null,
  isSelf: boolean,
) {
  if (isSelf) {
    return false
  }

  if (actorRole === 'owner') {
    return targetRole !== 'owner'
  }

  if (actorRole === 'admin') {
    return targetRole === 'moderator' || targetRole === 'host' || targetRole === 'member'
  }

  return false
}

function canAssignRoleToTarget(
  actorRole: CommunityRoleName | null,
  targetRole: CommunityRoleName | null,
  nextRole: CommunityRoleName,
  isSelf: boolean,
) {
  const assignableRoles = assignableRolesForActor(actorRole)

  return (
    canManageTargetMember(actorRole, targetRole, isSelf) &&
    assignableRoles.some((role) => role === nextRole)
  )
}

function canBlockUsers(actorRole: CommunityRoleName | null) {
  return actorRole === 'owner' || actorRole === 'admin' || actorRole === 'moderator'
}

function canManageAccessLinks(actorRole: CommunityRoleName | null) {
  return actorRole === 'owner' || actorRole === 'admin'
}

function canReviewJoinRequests(actorRole: CommunityRoleName | null) {
  return actorRole === 'owner' || actorRole === 'admin'
}

function accessLinkPresetForCommunity(
  kind: z.infer<typeof communityKindSchema>,
  visibility: z.infer<typeof communityVisibilitySchema>,
) {
  if (kind === 'club' && visibility === 'private') {
    return {
      defaultRequiresApproval: true,
      forceRequiresApproval: true,
      riskLabel: 'Club privado: approval obligatorio para no abrir el acceso.',
    }
  }

  if (kind === 'creator_community') {
    return {
      defaultRequiresApproval: true,
      forceRequiresApproval: false,
      riskLabel: 'Creator community: approval recomendado para controlar la entrada.',
    }
  }

  if (kind === 'crew_local' && visibility === 'public') {
    return {
      defaultRequiresApproval: false,
      forceRequiresApproval: false,
      riskLabel: 'Crew local pública: auto-join encaja bien si quieres crecer rápido.',
    }
  }

  return {
    defaultRequiresApproval: visibility === 'private',
    forceRequiresApproval: false,
    riskLabel:
      visibility === 'private'
        ? 'Comunidad privada: approval recomendado para revisar quién entra.'
        : 'Link abierto: compártelo solo si quieres acceso directo y reutilizable.',
  }
}

function normalizeAccessLinkCode(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function generateAccessLinkCode(communityName: string) {
  const normalizedCommunity = normalizeAccessLinkCode(communityName).slice(0, 20) || 'COMMUNITY'
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()

  return `${normalizedCommunity}-${suffix}`
}

function canBlockTargetMember(
  actorRole: CommunityRoleName | null,
  targetRole: CommunityRoleName | null,
  isSelf: boolean,
) {
  if (isSelf) {
    return false
  }

  if (actorRole === 'owner') {
    return targetRole !== 'owner'
  }

  if (actorRole === 'admin') {
    return targetRole === 'moderator' || targetRole === 'host' || targetRole === 'member' || !targetRole
  }

  if (actorRole === 'moderator') {
    return targetRole === 'member' || !targetRole
  }

  return false
}

function scoreGoalMatch(goals: string | null | undefined, communityText: string) {
  const normalizedGoals = listFromCommaValue(goals).map(normalizeText)
  let score = 0

  for (const goal of normalizedGoals) {
    if (goal.includes('gente') || goal.includes('social')) {
      score += communityText.includes('social') || communityText.includes('coffee') ? 2 : 0
    } else if (goal.includes('10k')) {
      score +=
        communityText.includes('10k') ||
        communityText.includes('tempo') ||
        communityText.includes('race')
          ? 2
          : 0
    } else if (goal.includes('constante')) {
      score +=
        communityText.includes('steady') ||
        communityText.includes('consistent') ||
        communityText.includes('easy')
          ? 2
          : 0
    } else if (goal.includes('ritmo')) {
      score +=
        communityText.includes('tempo') ||
        communityText.includes('pace') ||
        communityText.includes('structured')
          ? 2
          : 0
    } else if (goal.includes('carrera')) {
      score +=
        communityText.includes('race') ||
        communityText.includes('marathon') ||
        communityText.includes('half')
          ? 2
          : 0
    }
  }

  return Math.min(score, 4)
}

function scoreLevelMatch(level: string | null | undefined, communityText: string) {
  const normalized = normalizeText(level)

  if (!normalized) {
    return 0
  }

  if (normalized.includes('principiante')) {
    return communityText.includes('easy') || communityText.includes('low-pressure') ? 2 : 0
  }

  if (normalized.includes('intermedio')) {
    return communityText.includes('steady') || communityText.includes('social') ? 1.5 : 0
  }

  if (normalized.includes('avanzado')) {
    return communityText.includes('tempo') || communityText.includes('structured') ? 2 : 0
  }

  if (normalized.includes('competitivo')) {
    return communityText.includes('race') || communityText.includes('pace') || communityText.includes('marathon')
      ? 2
      : 0
  }

  return 0
}

function scoreLocationMatch(
  profile: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
  community: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
) {
  if (profile.citySlug && community.citySlug && profile.citySlug === community.citySlug) {
    return {
      score: 4,
      reason: 'misma ciudad',
    }
  }

  if (
    profile.cityLat !== null &&
    profile.cityLng !== null &&
    community.cityLat !== null &&
    community.cityLng !== null
  ) {
    const distanceKm = haversineDistanceKm(
      profile.cityLat,
      profile.cityLng,
      community.cityLat,
      community.cityLng,
    )

    if (distanceKm <= 15) {
      return {
        score: 3,
        reason: 'muy cerca',
      }
    }

    if (distanceKm <= 40) {
      return {
        score: 2,
        reason: 'cerca de ti',
      }
    }

    if (distanceKm <= 80) {
      return {
        score: 1,
        reason: 'zona accesible',
      }
    }
  }

  if (normalizeText(community.city) === normalizeText(profile.city)) {
    return {
      score: 3,
      reason: 'misma ciudad',
    }
  }

  return {
    score: 0,
    reason: null,
  }
}

function communityLocationTier(
  profile: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
  community: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
) {
  if (profile.citySlug && community.citySlug && profile.citySlug === community.citySlug) {
    return 'same_city' as const
  }

  if (normalizeText(community.city) === normalizeText(profile.city)) {
    return 'same_city' as const
  }

  if (
    profile.cityLat !== null &&
    profile.cityLng !== null &&
    community.cityLat !== null &&
    community.cityLng !== null
  ) {
    const distanceKm = haversineDistanceKm(
      profile.cityLat,
      profile.cityLng,
      community.cityLat,
      community.cityLng,
    )

    if (distanceKm <= 80) {
      return 'nearby' as const
    }
  }

  return 'other' as const
}

async function geocodeMeetupLocation(input: {
  city: string
  location: string
  province: string | null
}) {
  const geocodeInput = {
    address: input.location,
    city: input.city,
    province: input.province,
  }

  const cartociudadResult = await geocodeWithCartociudad(geocodeInput)

  if (cartociudadResult.ok) {
    return {
      latitude: Number(cartociudadResult.latitude),
      longitude: Number(cartociudadResult.longitude),
    }
  }

  const nominatimResult = await geocodeWithNominatim(geocodeInput)

  if (nominatimResult.ok) {
    return {
      latitude: Number(nominatimResult.latitude),
      longitude: Number(nominatimResult.longitude),
    }
  }

  return null
}

function scoreCommunityForProfile(
  profile: {
    area: string | null
    availabilitySlots: AvailabilitySlot[]
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
    distance: string | null
    goals: string | null
    level: string | null
    pace: string
  },
  community: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
    description: string
    meetupDistances: number[]
    meetupDates: Date[]
    name: string
    pace: string | null
    vibe: string | null
  },
) {
  let score = 0
  const reasons: string[] = []
  const communityText = normalizeText(
    `${community.name} ${community.city} ${community.vibe ?? ''} ${community.description}`,
  )
  const locationScore = scoreLocationMatch(profile, community)

  if (locationScore.score > 0 && locationScore.reason) {
    score += locationScore.score
    reasons.push(locationScore.reason)
  }

  if (profile.area && communityText.includes(normalizeText(profile.area))) {
    score += 2
    reasons.push('zona cercana')
  }

  const profilePace = parsePaceToSeconds(profile.pace)
  const communityPace = parsePaceToSeconds(community.pace ?? '')

  if (profilePace !== null && communityPace !== null) {
    const difference = Math.abs(profilePace - communityPace)

    if (difference <= 20) {
      score += 3
      reasons.push('ritmo muy similar')
    } else if (difference <= 45) {
      score += 2
      reasons.push('ritmo compatible')
    } else if (difference <= 75) {
      score += 1
      reasons.push('ritmo retador')
    }
  }

  const targetDistance = targetDistanceFromPreference(profile.distance)

  if (targetDistance !== null && community.meetupDistances.length > 0) {
    const closestDistance = Math.min(
      ...community.meetupDistances.map((distance) => Math.abs(distance - targetDistance)),
    )

    if (closestDistance <= 2) {
      score += 2
      reasons.push('distancia ideal')
    } else if (closestDistance <= 5) {
      score += 1
      reasons.push('distancia cercana')
    }
  }

  const goalScore = scoreGoalMatch(profile.goals, communityText)

  if (goalScore > 0) {
    score += goalScore
    reasons.push('metas compatibles')
  }

  const levelScore = scoreLevelMatch(profile.level, communityText)

  if (levelScore > 0) {
    score += levelScore
    reasons.push('nivel compatible')
  }

  if (
    profile.availabilitySlots.length > 0 &&
    availabilitySlotsOverlap(profile.availabilitySlots, community.meetupDates)
  ) {
    score += 1.5
    reasons.push('horarios compatibles')
  }

  if ((community.vibe ?? '').includes('social') && !reasons.includes('metas compatibles')) {
    score += 1
  }

  return {
    score,
    reason: reasons.slice(0, 2).join(' + ') || 'explora',
  }
}

async function getMembershipForUser(
  ctx: {
    db: typeof import('@apprunners/db').db
  },
  communityId: string,
  userId: string,
) {
  const [membership] = await ctx.db
    .select({
      id: member.id,
      role: member.role,
      userId: member.userId,
    })
    .from(member)
    .where(and(eq(member.organizationId, communityId), eq(member.userId, userId)))
    .limit(1)

  return membership ?? null
}

async function isUserBlockedInCommunity(
  ctx: {
    db: typeof import('@apprunners/db').db
  },
  communityId: string,
  userId: string,
) {
  const [blocked] = await ctx.db
    .select({
      id: communityBlocks.id,
    })
    .from(communityBlocks)
    .where(and(eq(communityBlocks.communityId, communityId), eq(communityBlocks.userId, userId)))
    .limit(1)

  return Boolean(blocked)
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/)

const communitySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/)

const profileSettingsSchema = z.object({
  notificationMeetups: z.boolean(),
  notificationReminders: z.boolean(),
  publicProfile: z.boolean(),
  showArea: z.boolean(),
  showCity: z.boolean(),
})

const municipalitySelectionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  municipality: z.string().min(2),
  province: z.string().min(2),
  slug: z.string().min(2),
})

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.execute('select 1')

    return {
      status: 'ok',
      database: 'reachable',
    }
  }),
  geo: createTRPCRouter({
    searchMunicipalities: publicProcedure
      .input(
        z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(12).optional(),
        }),
      )
      .query(({ input }) => {
        return searchMunicipalities(input.query, input.limit)
      }),
  }),
  communities: createTRPCRouter({
    listPublic: publicProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: communities.organizationId,
          slug: communities.slug,
          name: communities.name,
          description: communities.description,
          kind: communities.kind,
          mode: communities.mode,
          visibility: communities.visibility,
          city: communities.city,
          pace: communities.pace,
          vibe: communities.vibe,
        })
        .from(communities)
        .where(eq(communities.visibility, 'public'))
        .orderBy(desc(communities.createdAt))
    }),
    recommended: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      })

      const communityRows = await ctx.db
        .select({
          id: communities.organizationId,
          slug: communities.slug,
          name: communities.name,
          description: communities.description,
          kind: communities.kind,
          mode: communities.mode,
          visibility: communities.visibility,
          city: communities.city,
          citySlug: communities.citySlug,
          cityProvince: communities.cityProvince,
          cityLat: communities.cityLat,
          cityLng: communities.cityLng,
          pace: communities.pace,
          vibe: communities.vibe,
        })
        .from(communities)
        .where(eq(communities.visibility, 'public'))
        .orderBy(desc(communities.createdAt))

      const communityMeetups = await ctx.db
        .select({
          communityId: meetups.communityId,
          distanceKm: meetups.distanceKm,
          startsAt: meetups.startsAt,
        })
        .from(meetups)
        .where(gte(meetups.startsAt, new Date()))

      if (!profile) {
        return communityRows.map((community) => ({
          ...community,
          recommendationReason: 'completa tu perfil',
          recommendationScore: 0,
        }))
      }

      const scoredCommunities = communityRows.map((community) => {
        const meetupRowsForCommunity = communityMeetups.filter(
          (meetup) => meetup.communityId === community.id,
        )
        const recommendation = scoreCommunityForProfile(
          {
            area: profile.area,
            availabilitySlots: profile.availabilitySlots ?? [],
            city: profile.city,
            cityLat: profile.cityLat,
            cityLng: profile.cityLng,
            citySlug: profile.citySlug,
            distance: profile.distance,
            goals: profile.goals,
            level: profile.level,
            pace: profile.pace,
          },
          {
            city: community.city,
            cityLat: community.cityLat,
            cityLng: community.cityLng,
            citySlug: community.citySlug,
            description: community.description,
            meetupDates: meetupRowsForCommunity.map((meetup) => meetup.startsAt),
            meetupDistances: meetupRowsForCommunity.map((meetup) => meetup.distanceKm),
            name: community.name,
            pace: community.pace,
            vibe: community.vibe,
          },
        )

        const locationTier = communityLocationTier(
          {
            city: profile.city,
            cityLat: profile.cityLat,
            cityLng: profile.cityLng,
            citySlug: profile.citySlug,
          },
          {
            city: community.city,
            cityLat: community.cityLat,
            cityLng: community.cityLng,
            citySlug: community.citySlug,
          },
        )

        return {
          ...community,
          locationTier,
          recommendationReason: recommendation.reason,
          recommendationScore: recommendation.score,
        }
      })

      const hasSameCityCommunities = scoredCommunities.some(
        (community) => community.locationTier === 'same_city',
      )
      const hasNearbyCommunities = scoredCommunities.some(
        (community) => community.locationTier === 'nearby',
      )
      const locationTierPriority = hasSameCityCommunities
        ? { same_city: 0, nearby: 1, other: 2 }
        : hasNearbyCommunities
          ? { nearby: 0, same_city: 0, other: 1 }
          : { same_city: 0, nearby: 0, other: 0 }

      return scoredCommunities
        .sort((left, right) => {
          const tierDifference =
            locationTierPriority[left.locationTier] - locationTierPriority[right.locationTier]

          if (tierDifference !== 0) {
            return tierDifference
          }

          return right.recommendationScore - left.recommendationScore
        })
        .map(({ locationTier: _locationTier, ...community }) => community)
    }),
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().trim().min(2).max(80),
        }),
      )
      .query(async ({ ctx, input }) => {
        const searchPattern = `%${input.query.trim()}%`
        const matchingCommunities = await ctx.db
          .select({
            id: communities.organizationId,
            slug: communities.slug,
            name: communities.name,
            description: communities.description,
            kind: communities.kind,
            mode: communities.mode,
            visibility: communities.visibility,
            city: communities.city,
            pace: communities.pace,
            vibe: communities.vibe,
          })
          .from(communities)
          .where(
            or(
              ilike(communities.name, searchPattern),
              ilike(communities.slug, searchPattern),
              ilike(communities.city, searchPattern),
            ),
          )
          .orderBy(desc(communities.createdAt))
          .limit(12)

        if (matchingCommunities.length === 0) {
          return []
        }

        const communityIds = matchingCommunities.map((community) => community.id)
        const [blockedRows, membershipRows, joinRequestRows] = await Promise.all([
          ctx.db
            .select({
              communityId: communityBlocks.communityId,
            })
            .from(communityBlocks)
            .where(
              and(
                eq(communityBlocks.userId, ctx.user.id),
                inArray(communityBlocks.communityId, communityIds),
              ),
            ),
          ctx.db
            .select({
              communityId: member.organizationId,
              role: member.role,
            })
            .from(member)
            .where(and(eq(member.userId, ctx.user.id), inArray(member.organizationId, communityIds))),
          ctx.db
            .select({
              communityId: communityJoinRequests.communityId,
              id: communityJoinRequests.id,
              requestedAt: communityJoinRequests.requestedAt,
              reviewedAt: communityJoinRequests.reviewedAt,
              status: communityJoinRequests.status,
            })
            .from(communityJoinRequests)
            .where(
              and(
                eq(communityJoinRequests.userId, ctx.user.id),
                inArray(communityJoinRequests.communityId, communityIds),
              ),
            ),
        ])

        const blockedCommunityIds = new Set(blockedRows.map((row) => row.communityId))
        const membershipByCommunityId = new Map(
          membershipRows.map((row) => [row.communityId, row.role] as const),
        )
        const joinRequestByCommunityId = new Map(
          joinRequestRows.map((row) => [row.communityId, row] as const),
        )

        return matchingCommunities
          .filter((community) => !(community.visibility === 'private' && blockedCommunityIds.has(community.id)))
          .map((community) => {
            const viewerMembershipRole = membershipByCommunityId.get(community.id) ?? null
            const joinRequest = joinRequestByCommunityId.get(community.id) ?? null
            const isBlocked = blockedCommunityIds.has(community.id)
            const isMember = Boolean(viewerMembershipRole)

            return {
              ...community,
              canJoinDirectly: community.visibility === 'public' && !isMember && !isBlocked,
              canOpen: community.visibility === 'public' || isMember,
              canRequestJoin:
                community.visibility === 'private' &&
                !isMember &&
                !isBlocked &&
                joinRequest?.status !== 'pending',
              isBlocked,
              isMember,
              joinRequestId: joinRequest?.id ?? null,
              joinRequestRequestedAt: joinRequest?.requestedAt ?? null,
              joinRequestReviewedAt: joinRequest?.reviewedAt ?? null,
              joinRequestStatus: joinRequest?.status ?? null,
              viewerMembershipRole,
            }
          })
      }),
    byId: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        const [community] = await ctx.db
          .select({
            id: communities.organizationId,
            slug: communities.slug,
            name: communities.name,
            description: communities.description,
            kind: communities.kind,
            mode: communities.mode,
            visibility: communities.visibility,
            city: communities.city,
            pace: communities.pace,
            vibe: communities.vibe,
          })
          .from(communities)
          .where(eq(communities.organizationId, input.id))
          .limit(1)

        if (!community) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        const viewerMembership = ctx.user
          ? await getMembershipForUser(ctx, input.id, ctx.user.id)
          : null
        const viewerPrimaryRole = getPrimaryRole(viewerMembership?.role)
        const viewerCanCreateRuns = canOrganizeCommunityMeetup(
          community.mode,
          viewerMembership?.role ?? null,
        )
        const viewerCanInviteMembers = canInviteMembers(viewerPrimaryRole)
        const viewerCanManageRoles = canManageRole(viewerPrimaryRole)
        const viewerCanBlockUsers = canBlockUsers(viewerPrimaryRole)
        const viewerCanReviewJoinRequests = canReviewJoinRequests(viewerPrimaryRole)

        if (community.visibility === 'private' && !viewerMembership) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        const upcomingMeetups = await ctx.db
          .select({
            id: meetups.id,
            communityId: communities.organizationId,
            communityKind: communities.kind,
            communityName: communities.name,
            distanceKm: meetups.distanceKm,
            location: meetups.location,
            startsAt: meetups.startsAt,
            title: meetups.title,
            visibility: meetups.visibility,
          })
          .from(meetups)
          .innerJoin(communities, eq(meetups.communityId, communities.organizationId))
          .where(and(eq(meetups.communityId, input.id), gte(meetups.startsAt, new Date())))
          .orderBy(asc(meetups.startsAt))

        const visibleMeetups = upcomingMeetups.filter((meetup) =>
          canViewerSeeMeetup(Boolean(viewerMembership), community.visibility, meetup.visibility),
        )
        const meetupIds = visibleMeetups.map((meetup) => meetup.id)
        const rsvpRows =
          meetupIds.length > 0
            ? await ctx.db
                .select({
                  meetupId: meetupRsvps.meetupId,
                  userId: meetupRsvps.userId,
                })
                .from(meetupRsvps)
                .where(inArray(meetupRsvps.meetupId, meetupIds))
            : []

        const activeMembers = await ctx.db
          .select({
            area: profiles.area,
            city: profiles.city,
            goals: profiles.goals,
            id: profiles.id,
            level: profiles.level,
            pace: profiles.pace,
            publicProfile: profiles.publicProfile,
            showArea: profiles.showArea,
            showCity: profiles.showCity,
            username: profiles.username,
          })
          .from(member)
          .innerJoin(profiles, eq(member.userId, profiles.userId))
          .where(eq(member.organizationId, input.id))

        const members =
          viewerMembership || viewerCanInviteMembers || viewerCanManageRoles || viewerCanBlockUsers
            ? await ctx.db
                .select({
                  id: member.id,
                  joinedAt: member.createdAt,
                  name: user.name,
                  role: member.role,
                  userId: member.userId,
                  username: profiles.username,
                })
                .from(member)
                .innerJoin(user, eq(member.userId, user.id))
                .innerJoin(profiles, eq(member.userId, profiles.userId))
                .where(eq(member.organizationId, input.id))
                .orderBy(asc(member.createdAt))
            : []

        const pendingInvites = viewerCanInviteMembers
          ? await ctx.db
              .select({
                createdAt: communityUserInvites.createdAt,
                expiresAt: communityUserInvites.expiresAt,
                id: communityUserInvites.id,
                invitedByName: user.name,
                invitedByUserId: communityUserInvites.invitedByUserId,
                invitedUsername: profiles.username,
                invitedUserId: communityUserInvites.invitedUserId,
                role: communityUserInvites.role,
                status: communityUserInvites.status,
              })
              .from(communityUserInvites)
              .innerJoin(profiles, eq(communityUserInvites.invitedUserId, profiles.userId))
              .innerJoin(user, eq(communityUserInvites.invitedByUserId, user.id))
              .where(
                and(
                  eq(communityUserInvites.communityId, input.id),
                  eq(communityUserInvites.status, 'pending'),
                ),
              )
              .orderBy(desc(communityUserInvites.createdAt))
          : []
        const pendingJoinRequests = viewerCanReviewJoinRequests
          ? await ctx.db
              .select({
                id: communityJoinRequests.id,
                requestedAt: communityJoinRequests.requestedAt,
                userId: communityJoinRequests.userId,
                userName: user.name,
                username: profiles.username,
              })
              .from(communityJoinRequests)
              .innerJoin(user, eq(communityJoinRequests.userId, user.id))
              .innerJoin(profiles, eq(communityJoinRequests.userId, profiles.userId))
              .where(
                and(
                  eq(communityJoinRequests.communityId, input.id),
                  eq(communityJoinRequests.status, 'pending'),
                ),
              )
              .orderBy(desc(communityJoinRequests.requestedAt))
          : []

        const accessLinks = viewerCanInviteMembers
          ? await ctx.db
              .select({
                code: communityAccessLinks.code,
                createdAt: communityAccessLinks.createdAt,
                defaultRole: communityAccessLinks.defaultRole,
                expiresAt: communityAccessLinks.expiresAt,
                id: communityAccessLinks.id,
                isActive: communityAccessLinks.isActive,
                maxUses: communityAccessLinks.maxUses,
                requiresApproval: communityAccessLinks.requiresApproval,
                sourceLabel: communityAccessLinks.sourceLabel,
                usesCount: communityAccessLinks.usesCount,
              })
              .from(communityAccessLinks)
              .where(eq(communityAccessLinks.communityId, input.id))
              .orderBy(desc(communityAccessLinks.createdAt))
          : []
        const accessLinkIds = accessLinks.map((accessLink) => accessLink.id)
        const accessLinkClaims =
          viewerCanInviteMembers && accessLinkIds.length > 0
            ? await ctx.db
                .select({
                  accessLinkId: communityAccessLinkClaims.accessLinkId,
                  status: communityAccessLinkClaims.status,
                })
                .from(communityAccessLinkClaims)
                .where(inArray(communityAccessLinkClaims.accessLinkId, accessLinkIds))
            : []

        const pendingAccessClaims = viewerCanInviteMembers
          ? await ctx.db
              .select({
                accessLinkCode: communityAccessLinks.code,
                accessLinkId: communityAccessLinkClaims.accessLinkId,
                id: communityAccessLinkClaims.id,
                requestedAt: communityAccessLinkClaims.requestedAt,
                sourceLabel: communityAccessLinks.sourceLabel,
                userId: communityAccessLinkClaims.userId,
                username: profiles.username,
                userName: user.name,
              })
              .from(communityAccessLinkClaims)
              .innerJoin(
                communityAccessLinks,
                eq(communityAccessLinkClaims.accessLinkId, communityAccessLinks.id),
              )
              .innerJoin(user, eq(communityAccessLinkClaims.userId, user.id))
              .innerJoin(profiles, eq(communityAccessLinkClaims.userId, profiles.userId))
              .where(
                and(
                  eq(communityAccessLinkClaims.communityId, input.id),
                  eq(communityAccessLinkClaims.status, 'pending'),
                ),
              )
              .orderBy(desc(communityAccessLinkClaims.requestedAt))
          : []
        const recentAccessClaims = viewerCanInviteMembers
          ? await ctx.db
              .select({
                accessLinkCode: communityAccessLinks.code,
                id: communityAccessLinkClaims.id,
                requestedAt: communityAccessLinkClaims.requestedAt,
                reviewedAt: communityAccessLinkClaims.reviewedAt,
                sourceLabel: communityAccessLinks.sourceLabel,
                status: communityAccessLinkClaims.status,
                userId: communityAccessLinkClaims.userId,
                username: profiles.username,
                userName: user.name,
              })
              .from(communityAccessLinkClaims)
              .innerJoin(
                communityAccessLinks,
                eq(communityAccessLinkClaims.accessLinkId, communityAccessLinks.id),
              )
              .innerJoin(user, eq(communityAccessLinkClaims.userId, user.id))
              .innerJoin(profiles, eq(communityAccessLinkClaims.userId, profiles.userId))
              .where(eq(communityAccessLinkClaims.communityId, input.id))
              .orderBy(desc(communityAccessLinkClaims.requestedAt))
              .limit(20)
          : []

        const blockedUsers = viewerCanBlockUsers
          ? await ctx.db
              .select({
                blockedAt: communityBlocks.createdAt,
                blockedByUserId: communityBlocks.blockedByUserId,
                id: communityBlocks.id,
                name: user.name,
                reason: communityBlocks.reason,
                userId: communityBlocks.userId,
                username: profiles.username,
              })
              .from(communityBlocks)
              .innerJoin(user, eq(communityBlocks.userId, user.id))
              .innerJoin(profiles, eq(communityBlocks.userId, profiles.userId))
              .where(eq(communityBlocks.communityId, input.id))
              .orderBy(desc(communityBlocks.createdAt))
          : []

        return {
          community: {
            ...community,
            viewerCanBlockUsers,
            viewerCanCreateRuns,
            viewerCanInviteMembers,
            viewerCanManageRoles,
            viewerCanReviewJoinRequests,
            viewerMembershipRole: viewerMembership?.role ?? null,
          },
          blockedUsers: blockedUsers.map((blockedUser) => ({
            ...blockedUser,
            canUnblock: viewerCanBlockUsers,
          })),
          accessLinks: accessLinks.map((accessLink) => ({
            ...accessLink,
            approvedClaims: accessLinkClaims.filter(
              (claim) =>
                claim.accessLinkId === accessLink.id && claim.status === 'approved',
            ).length,
            canRevoke: viewerCanInviteMembers && accessLink.isActive,
            pendingClaims: accessLinkClaims.filter(
              (claim) =>
                claim.accessLinkId === accessLink.id && claim.status === 'pending',
            ).length,
            rejectedClaims: accessLinkClaims.filter(
              (claim) =>
                claim.accessLinkId === accessLink.id && claim.status === 'rejected',
            ).length,
          })),
          accessLinkSources: accessLinks
            .reduce<
              Array<{
                sourceLabel: string
                totalLinks: number
                totalUses: number
                pendingClaims: number
                approvedClaims: number
              }>
            >((accumulator, accessLink) => {
              const sourceLabel = accessLink.sourceLabel ?? 'unlabeled'
              const existingSource = accumulator.find((item) => item.sourceLabel === sourceLabel)
              const pendingClaims = accessLinkClaims.filter(
                (claim) =>
                  claim.accessLinkId === accessLink.id && claim.status === 'pending',
              ).length
              const approvedClaims = accessLinkClaims.filter(
                (claim) =>
                  claim.accessLinkId === accessLink.id && claim.status === 'approved',
              ).length

              if (existingSource) {
                existingSource.totalLinks += 1
                existingSource.totalUses += accessLink.usesCount
                existingSource.pendingClaims += pendingClaims
                existingSource.approvedClaims += approvedClaims
              } else {
                accumulator.push({
                  approvedClaims,
                  pendingClaims,
                  sourceLabel,
                  totalLinks: 1,
                  totalUses: accessLink.usesCount,
                })
              }

              return accumulator
            }, [])
            .sort((left, right) => right.totalUses - left.totalUses),
          members: members.map((communityMember) => {
            const targetPrimaryRole = getPrimaryRole(communityMember.role)
            const isViewer = communityMember.userId === ctx.user?.id

            return {
              ...communityMember,
              availableRoleTargets: assignableRolesForActor(viewerPrimaryRole).filter((role) =>
                canAssignRoleToTarget(viewerPrimaryRole, targetPrimaryRole, role, isViewer),
              ),
              canBlock: canBlockTargetMember(viewerPrimaryRole, targetPrimaryRole, isViewer),
              canRemove: canManageTargetMember(viewerPrimaryRole, targetPrimaryRole, isViewer),
              isViewer,
              primaryRole: targetPrimaryRole,
            }
          }),
          pendingInvites: pendingInvites
            .filter((invite) => invite.expiresAt > new Date())
            .map((invite) => ({
              ...invite,
              canCancel: viewerCanInviteMembers,
            })),
          pendingJoinRequests: pendingJoinRequests.map((request) => ({
            ...request,
            canReview: viewerCanReviewJoinRequests,
          })),
          pendingAccessClaims: pendingAccessClaims.map((claim) => ({
            ...claim,
            canReview: viewerCanInviteMembers,
          })),
          recentAccessClaims,
          upcomingMeetups: visibleMeetups.map((meetup) => {
            const meetupRsvpRows = rsvpRows.filter((rsvp) => rsvp.meetupId === meetup.id)

            return {
              ...meetup,
              rsvpCount: meetupRsvpRows.length,
              viewerIsGoing: ctx.user
                ? meetupRsvpRows.some((rsvp) => rsvp.userId === ctx.user?.id)
                : false,
            }
          }),
          activeRunners: activeMembers
            .filter((profile) => profile.publicProfile && profile.username)
            .map((profile) => ({
              id: profile.id,
              username: profile.username,
              city: profile.showCity ? profile.city : null,
              area: profile.showArea ? profile.area : null,
              pace: profile.pace,
              level: profile.level,
              goals: profile.goals,
            })),
        }
      }),
    myMemberships: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          id: communities.organizationId,
          slug: communities.slug,
          name: communities.name,
          description: communities.description,
          kind: communities.kind,
          mode: communities.mode,
          visibility: communities.visibility,
          city: communities.city,
          pace: communities.pace,
          vibe: communities.vibe,
          role: member.role,
        })
        .from(member)
        .innerJoin(communities, eq(member.organizationId, communities.organizationId))
        .where(eq(member.userId, ctx.user.id))
        .orderBy(desc(communities.createdAt))

      return rows.map((row) => ({
        ...row,
        canCreateRuns: canOrganizeCommunityMeetup(row.mode, row.role),
        primaryRole: getPrimaryRole(row.role),
      }))
    }),
    hostable: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          id: communities.organizationId,
          slug: communities.slug,
          name: communities.name,
          description: communities.description,
          kind: communities.kind,
          mode: communities.mode,
          visibility: communities.visibility,
          city: communities.city,
          pace: communities.pace,
          vibe: communities.vibe,
          role: member.role,
        })
        .from(member)
        .innerJoin(communities, eq(member.organizationId, communities.organizationId))
        .where(eq(member.userId, ctx.user.id))
        .orderBy(desc(communities.createdAt))

      const blockedRows = await ctx.db
        .select({
          communityId: communityBlocks.communityId,
        })
        .from(communityBlocks)
        .where(eq(communityBlocks.userId, ctx.user.id))

      const blockedCommunityIds = new Set(blockedRows.map((row) => row.communityId))

      return rows
        .filter((row) => !blockedCommunityIds.has(row.id))
        .filter((row) => canOrganizeCommunityMeetup(row.mode, row.role))
        .map((row) => ({
          ...row,
          primaryRole: getPrimaryRole(row.role),
        }))
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(80),
          slug: communitySlugSchema,
          description: z.string().min(8).max(500),
          kind: communityKindSchema,
          mode: communityModeSchema,
          visibility: communityVisibilitySchema,
          citySelection: municipalitySelectionSchema,
          pace: z.string().max(32).optional(),
          vibe: z.string().max(80).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return createCommunityMembershipRecord(ctx.db, {
          city: input.citySelection.municipality,
          cityLat: input.citySelection.latitude,
          cityLng: input.citySelection.longitude,
          cityProvince: input.citySelection.province,
          citySlug: input.citySelection.slug,
          description: input.description,
          kind: input.kind,
          mode: input.mode,
          name: input.name,
          ownerUserId: ctx.user.id,
          pace: input.pace ?? null,
          slug: input.slug,
          vibe: input.vibe ?? null,
          visibility: input.visibility,
        })
      }),
    requestJoin: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const community = await ctx.db.query.communities.findFirst({
          where: eq(communities.organizationId, input.communityId),
        })

        if (!community) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        if (community.visibility !== 'private') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Las comunidades públicas se unen directamente.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, input.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes solicitar acceso a esta comunidad.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)

        if (existingMembership) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ya formas parte de esta comunidad.',
          })
        }

        const [existingJoinRequest] = await ctx.db
          .select({
            id: communityJoinRequests.id,
            status: communityJoinRequests.status,
          })
          .from(communityJoinRequests)
          .where(
            and(
              eq(communityJoinRequests.communityId, input.communityId),
              eq(communityJoinRequests.userId, ctx.user.id),
            ),
          )
          .limit(1)

        if (existingJoinRequest?.status === 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ya tienes una solicitud pendiente en esta comunidad.',
          })
        }

        if (existingJoinRequest) {
          await ctx.db
            .update(communityJoinRequests)
            .set({
              requestedAt: new Date(),
              reviewedAt: null,
              reviewedByUserId: null,
              status: 'pending',
            })
            .where(eq(communityJoinRequests.id, existingJoinRequest.id))

          return {
            ok: true,
            requestId: existingJoinRequest.id,
          }
        }

        const requestId = randomUUID()

        await ctx.db.insert(communityJoinRequests).values({
          communityId: input.communityId,
          id: requestId,
          requestedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
          status: 'pending',
          userId: ctx.user.id,
        })

        return {
          ok: true,
          requestId,
        }
      }),
    cancelJoinRequest: protectedProcedure
      .input(
        z.object({
          requestId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [joinRequest] = await ctx.db
          .select({
            id: communityJoinRequests.id,
            status: communityJoinRequests.status,
            userId: communityJoinRequests.userId,
          })
          .from(communityJoinRequests)
          .where(eq(communityJoinRequests.id, input.requestId))
          .limit(1)

        if (!joinRequest || joinRequest.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa solicitud.' })
        }

        if (joinRequest.status !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Solo puedes cancelar solicitudes pendientes.',
          })
        }

        await ctx.db
          .update(communityJoinRequests)
          .set({
            reviewedAt: new Date(),
            reviewedByUserId: null,
            status: 'cancelled',
          })
          .where(eq(communityJoinRequests.id, input.requestId))

        return { ok: true }
      }),
    joinPublic: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const community = await ctx.db.query.communities.findFirst({
          where: eq(communities.organizationId, input.communityId),
        })

        if (!community) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        if (community.visibility !== 'public') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Esta comunidad requiere invitación o acceso directo.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, input.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes unirte a esta comunidad.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)

        if (!existingMembership) {
          await addMemberToCommunity({
            db: ctx.db,
            organizationId: input.communityId,
            role: 'member',
            userId: ctx.user.id,
          })
        }

        return { ok: true }
      }),
    reviewJoinRequest: protectedProcedure
      .input(
        z.object({
          action: z.enum(['approve', 'reject']),
          requestId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [joinRequest] = await ctx.db
          .select({
            communityId: communityJoinRequests.communityId,
            id: communityJoinRequests.id,
            status: communityJoinRequests.status,
            userId: communityJoinRequests.userId,
          })
          .from(communityJoinRequests)
          .where(eq(communityJoinRequests.id, input.requestId))
          .limit(1)

        if (!joinRequest) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa solicitud.' })
        }

        const actorMembership = await getMembershipForUser(ctx, joinRequest.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canReviewJoinRequests(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes revisar solicitudes en esta comunidad.',
          })
        }

        if (joinRequest.status !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Esta solicitud ya fue revisada.',
          })
        }

        if (input.action === 'approve') {
          if (await isUserBlockedInCommunity(ctx, joinRequest.communityId, joinRequest.userId)) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Ese usuario está bloqueado y no puede entrar.',
            })
          }

          const existingMembership = await getMembershipForUser(
            ctx,
            joinRequest.communityId,
            joinRequest.userId,
          )

          if (!existingMembership) {
            await addMemberToCommunity({
              db: ctx.db,
              organizationId: joinRequest.communityId,
              role: 'member',
              userId: joinRequest.userId,
            })
          }

          await ctx.db
            .update(communityJoinRequests)
            .set({
              reviewedAt: new Date(),
              reviewedByUserId: ctx.user.id,
              status: 'approved',
            })
            .where(eq(communityJoinRequests.id, joinRequest.id))

          return { ok: true }
        }

        await ctx.db
          .update(communityJoinRequests)
          .set({
            reviewedAt: new Date(),
            reviewedByUserId: ctx.user.id,
            status: 'rejected',
          })
          .where(eq(communityJoinRequests.id, joinRequest.id))

        return { ok: true }
      }),
    leave: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existingMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)

        if (!existingMembership) {
          return { ok: true }
        }

        if (hasAnyRole(existingMembership.role, ['owner'])) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'El owner no puede salir de la comunidad sin transferirla primero.',
          })
        }

        await leaveCommunityMembership({
          db: ctx.db,
          organizationId: input.communityId,
          userId: ctx.user.id,
        })

        return { ok: true }
      }),
    myInvites: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          communityId: communities.organizationId,
          communityKind: communities.kind,
          communityName: communities.name,
          communityVisibility: communities.visibility,
          createdAt: communityUserInvites.createdAt,
          expiresAt: communityUserInvites.expiresAt,
          id: communityUserInvites.id,
          invitedByName: user.name,
          role: communityUserInvites.role,
        })
        .from(communityUserInvites)
        .innerJoin(communities, eq(communityUserInvites.communityId, communities.organizationId))
        .innerJoin(user, eq(communityUserInvites.invitedByUserId, user.id))
        .where(
          and(
            eq(communityUserInvites.invitedUserId, ctx.user.id),
            eq(communityUserInvites.status, 'pending'),
          ),
        )
        .orderBy(desc(communityUserInvites.createdAt))

      const now = new Date()

      return rows.filter((invite) => invite.expiresAt > now)
    }),
    myJoinRequests: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select({
          communityId: communities.organizationId,
          communityKind: communities.kind,
          communityName: communities.name,
          id: communityJoinRequests.id,
          requestedAt: communityJoinRequests.requestedAt,
          reviewedAt: communityJoinRequests.reviewedAt,
          status: communityJoinRequests.status,
        })
        .from(communityJoinRequests)
        .innerJoin(communities, eq(communityJoinRequests.communityId, communities.organizationId))
        .where(eq(communityJoinRequests.userId, ctx.user.id))
        .orderBy(desc(communityJoinRequests.requestedAt))
        .limit(20)
    }),
    myAccessLinkClaims: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select({
          accessLinkCode: communityAccessLinks.code,
          communityId: communities.organizationId,
          communityKind: communities.kind,
          communityName: communities.name,
          id: communityAccessLinkClaims.id,
          requestedAt: communityAccessLinkClaims.requestedAt,
          reviewedAt: communityAccessLinkClaims.reviewedAt,
          sourceLabel: communityAccessLinks.sourceLabel,
          status: communityAccessLinkClaims.status,
        })
        .from(communityAccessLinkClaims)
        .innerJoin(
          communityAccessLinks,
          eq(communityAccessLinkClaims.accessLinkId, communityAccessLinks.id),
        )
        .innerJoin(communities, eq(communityAccessLinkClaims.communityId, communities.organizationId))
        .where(eq(communityAccessLinkClaims.userId, ctx.user.id))
        .orderBy(desc(communityAccessLinkClaims.requestedAt))
        .limit(20)
    }),
    createAccessLink: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          defaultRole: communityRoleSchema.exclude(['owner']),
          expiresInDays: z.number().int().min(1).max(365).default(14),
          maxUses: z.number().int().positive().max(100000).nullable().optional(),
          requiresApproval: z.boolean().default(false),
          sourceLabel: z.string().max(80).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canManageAccessLinks(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes crear access links en esta comunidad.',
          })
        }

        if (!assignableRolesForActor(actorPrimaryRole).some((role) => role === input.defaultRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes crear un link con ese rol por defecto.',
          })
        }

        const [community] = await ctx.db
          .select({
            kind: communities.kind,
            name: communities.name,
            visibility: communities.visibility,
          })
          .from(communities)
          .where(eq(communities.organizationId, input.communityId))
          .limit(1)

        if (!community) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        const accessLinkPreset = accessLinkPresetForCommunity(community.kind, community.visibility)

        let code = generateAccessLinkCode(community.name)

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const [existingCode] = await ctx.db
            .select({ id: communityAccessLinks.id })
            .from(communityAccessLinks)
            .where(eq(communityAccessLinks.code, code))
            .limit(1)

          if (!existingCode) {
            break
          }

          code = generateAccessLinkCode(community.name)
        }

        const [createdLink] = await ctx.db
          .insert(communityAccessLinks)
          .values({
            code,
            communityId: input.communityId,
            createdByUserId: ctx.user.id,
            defaultRole: input.defaultRole,
            expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000),
            id: randomUUID(),
            isActive: true,
            maxUses: input.maxUses ?? null,
            requiresApproval: accessLinkPreset.forceRequiresApproval ? true : input.requiresApproval,
            sourceLabel: input.sourceLabel?.trim() || null,
            updatedAt: new Date(),
            usesCount: 0,
          })
          .returning({
            code: communityAccessLinks.code,
            id: communityAccessLinks.id,
          })

        return createdLink
      }),
    revokeAccessLink: protectedProcedure
      .input(
        z.object({
          accessLinkId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [accessLink] = await ctx.db
          .select({
            communityId: communityAccessLinks.communityId,
            id: communityAccessLinks.id,
          })
          .from(communityAccessLinks)
          .where(eq(communityAccessLinks.id, input.accessLinkId))
          .limit(1)

        if (!accessLink) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese access link.' })
        }

        const actorMembership = await getMembershipForUser(ctx, accessLink.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canManageAccessLinks(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes revocar access links en esta comunidad.',
          })
        }

        await ctx.db
          .update(communityAccessLinks)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(communityAccessLinks.id, input.accessLinkId))

        return { ok: true }
      }),
    redeemAccessLink: protectedProcedure
      .input(
        z.object({
          code: z.string().min(3).max(80),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const normalizedCode = normalizeAccessLinkCode(input.code)
        const [accessLink] = await ctx.db
          .select({
            code: communityAccessLinks.code,
            communityId: communityAccessLinks.communityId,
            communityName: communities.name,
            createdByUserId: communityAccessLinks.createdByUserId,
            defaultRole: communityAccessLinks.defaultRole,
            expiresAt: communityAccessLinks.expiresAt,
            id: communityAccessLinks.id,
            isActive: communityAccessLinks.isActive,
            maxUses: communityAccessLinks.maxUses,
            requiresApproval: communityAccessLinks.requiresApproval,
            usesCount: communityAccessLinks.usesCount,
          })
          .from(communityAccessLinks)
          .innerJoin(communities, eq(communityAccessLinks.communityId, communities.organizationId))
          .where(eq(communityAccessLinks.code, normalizedCode))
          .limit(1)

        if (!accessLink || !accessLink.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Ese código no está disponible.' })
        }

        if (accessLink.expiresAt <= new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ese código ha caducado.' })
        }

        if (
          accessLink.maxUses !== null &&
          accessLink.maxUses !== undefined &&
          accessLink.usesCount >= accessLink.maxUses
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ese código ya alcanzó su límite de usos.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, accessLink.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes acceder a esta comunidad.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, accessLink.communityId, ctx.user.id)

        if (existingMembership) {
          return {
            communityId: accessLink.communityId,
            communityName: accessLink.communityName,
            status: 'already_member' as const,
          }
        }

        const [existingPendingClaim] = await ctx.db
          .select({
            id: communityAccessLinkClaims.id,
          })
          .from(communityAccessLinkClaims)
          .where(
            and(
              eq(communityAccessLinkClaims.accessLinkId, accessLink.id),
              eq(communityAccessLinkClaims.userId, ctx.user.id),
              eq(communityAccessLinkClaims.status, 'pending'),
            ),
          )
          .limit(1)

        if (existingPendingClaim) {
          return {
            communityId: accessLink.communityId,
            communityName: accessLink.communityName,
            status: 'pending' as const,
          }
        }

        if (accessLink.requiresApproval) {
          await ctx.db.insert(communityAccessLinkClaims).values({
            accessLinkId: accessLink.id,
            communityId: accessLink.communityId,
            id: randomUUID(),
            requestedAt: new Date(),
            status: 'pending',
            userId: ctx.user.id,
          })

          return {
            communityId: accessLink.communityId,
            communityName: accessLink.communityName,
            status: 'pending' as const,
          }
        }

        await addMemberToCommunity({
          db: ctx.db,
          organizationId: accessLink.communityId,
          role: accessLink.defaultRole,
          userId: ctx.user.id,
        })

        await ctx.db.transaction(async (tx) => {
          await tx.insert(communityAccessLinkClaims).values({
            accessLinkId: accessLink.id,
            communityId: accessLink.communityId,
            id: randomUUID(),
            requestedAt: new Date(),
            reviewedAt: new Date(),
            reviewedByUserId: accessLink.createdByUserId,
            status: 'approved',
            userId: ctx.user.id,
          })

          await tx
            .update(communityAccessLinks)
            .set({
              updatedAt: new Date(),
              usesCount: accessLink.usesCount + 1,
            })
            .where(eq(communityAccessLinks.id, accessLink.id))
        })

        return {
          communityId: accessLink.communityId,
          communityName: accessLink.communityName,
          status: 'joined' as const,
        }
      }),
    approveAccessClaim: protectedProcedure
      .input(
        z.object({
          claimId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [claim] = await ctx.db
          .select({
            accessLinkId: communityAccessLinkClaims.accessLinkId,
            communityId: communityAccessLinkClaims.communityId,
            id: communityAccessLinkClaims.id,
            status: communityAccessLinkClaims.status,
            userId: communityAccessLinkClaims.userId,
          })
          .from(communityAccessLinkClaims)
          .where(eq(communityAccessLinkClaims.id, input.claimId))
          .limit(1)

        if (!claim || claim.status !== 'pending') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa solicitud.' })
        }

        const actorMembership = await getMembershipForUser(ctx, claim.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canManageAccessLinks(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes revisar solicitudes de access links aquí.',
          })
        }

        const [accessLink] = await ctx.db
          .select({
            defaultRole: communityAccessLinks.defaultRole,
            expiresAt: communityAccessLinks.expiresAt,
            id: communityAccessLinks.id,
            isActive: communityAccessLinks.isActive,
            maxUses: communityAccessLinks.maxUses,
            usesCount: communityAccessLinks.usesCount,
          })
          .from(communityAccessLinks)
          .where(eq(communityAccessLinks.id, claim.accessLinkId))
          .limit(1)

        if (!accessLink || !accessLink.isActive || accessLink.expiresAt <= new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El access link ya no está activo.',
          })
        }

        if (
          accessLink.maxUses !== null &&
          accessLink.maxUses !== undefined &&
          accessLink.usesCount >= accessLink.maxUses
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El access link ya alcanzó su límite.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, claim.communityId, claim.userId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Ese usuario está bloqueado en esta comunidad.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, claim.communityId, claim.userId)

        if (!existingMembership) {
          await addMemberToCommunity({
            db: ctx.db,
            organizationId: claim.communityId,
            role: accessLink.defaultRole,
            userId: claim.userId,
          })
        }

        await ctx.db.transaction(async (tx) => {
          await tx
            .update(communityAccessLinkClaims)
            .set({
              reviewedAt: new Date(),
              reviewedByUserId: ctx.user.id,
              status: 'approved',
            })
            .where(eq(communityAccessLinkClaims.id, input.claimId))

          await tx
            .update(communityAccessLinks)
            .set({
              updatedAt: new Date(),
              usesCount: accessLink.usesCount + 1,
            })
            .where(eq(communityAccessLinks.id, accessLink.id))
        })

        return { ok: true }
      }),
    rejectAccessClaim: protectedProcedure
      .input(
        z.object({
          claimId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [claim] = await ctx.db
          .select({
            communityId: communityAccessLinkClaims.communityId,
            id: communityAccessLinkClaims.id,
            status: communityAccessLinkClaims.status,
          })
          .from(communityAccessLinkClaims)
          .where(eq(communityAccessLinkClaims.id, input.claimId))
          .limit(1)

        if (!claim || claim.status !== 'pending') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa solicitud.' })
        }

        const actorMembership = await getMembershipForUser(ctx, claim.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canManageAccessLinks(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes revisar solicitudes de access links aquí.',
          })
        }

        await ctx.db
          .update(communityAccessLinkClaims)
          .set({
            reviewedAt: new Date(),
            reviewedByUserId: ctx.user.id,
            status: 'rejected',
          })
          .where(eq(communityAccessLinkClaims.id, input.claimId))

        return { ok: true }
      }),
    inviteByUsername: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          role: z.enum(['admin', 'moderator', 'host', 'member']),
          username: usernameSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canInviteMembers(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes invitar miembros en esta comunidad.',
          })
        }

        if (!assignableRolesForActor(actorPrimaryRole).some((role) => role === input.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes invitar con ese rol.',
          })
        }

        const [inviteeProfile] = await ctx.db
          .select({
            userId: profiles.userId,
            username: profiles.username,
          })
          .from(profiles)
          .where(eq(profiles.username, input.username))
          .limit(1)

        if (!inviteeProfile?.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese username.' })
        }

        if (inviteeProfile.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No puedes invitarte a ti mismo.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, input.communityId, inviteeProfile.userId)

        if (existingMembership) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Ese usuario ya pertenece a la comunidad.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, input.communityId, inviteeProfile.userId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Ese usuario está bloqueado en esta comunidad.',
          })
        }

        const [existingInvite] = await ctx.db
          .select({
            id: communityUserInvites.id,
            expiresAt: communityUserInvites.expiresAt,
          })
          .from(communityUserInvites)
          .where(
            and(
              eq(communityUserInvites.communityId, input.communityId),
              eq(communityUserInvites.invitedUserId, inviteeProfile.userId),
              eq(communityUserInvites.status, 'pending'),
            ),
          )
          .orderBy(desc(communityUserInvites.createdAt))
          .limit(1)

        if (existingInvite && existingInvite.expiresAt > new Date()) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Ese usuario ya tiene una invitación pendiente.',
          })
        }

        await ctx.db.insert(communityUserInvites).values({
          communityId: input.communityId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          id: randomUUID(),
          invitedByUserId: ctx.user.id,
          invitedUserId: inviteeProfile.userId,
          role: input.role,
          status: 'pending',
          updatedAt: new Date(),
        })

        return { ok: true }
      }),
    acceptInvite: protectedProcedure
      .input(
        z.object({
          inviteId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [invite] = await ctx.db
          .select({
            communityId: communityUserInvites.communityId,
            expiresAt: communityUserInvites.expiresAt,
            id: communityUserInvites.id,
            role: communityUserInvites.role,
            status: communityUserInvites.status,
          })
          .from(communityUserInvites)
          .where(
            and(
              eq(communityUserInvites.id, input.inviteId),
              eq(communityUserInvites.invitedUserId, ctx.user.id),
            ),
          )
          .limit(1)

        if (!invite || invite.status !== 'pending') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa invitación.' })
        }

        if (invite.expiresAt <= new Date()) {
          await ctx.db
            .update(communityUserInvites)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(eq(communityUserInvites.id, input.inviteId))

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Esta invitación ha caducado.',
          })
        }

        if (await isUserBlockedInCommunity(ctx, invite.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes unirte a esta comunidad.',
          })
        }

        const existingMembership = await getMembershipForUser(ctx, invite.communityId, ctx.user.id)

        if (!existingMembership) {
          await addMemberToCommunity({
            db: ctx.db,
            organizationId: invite.communityId,
            role: invite.role,
            userId: ctx.user.id,
          })
        }

        await ctx.db
          .update(communityUserInvites)
          .set({
            status: 'accepted',
            updatedAt: new Date(),
          })
          .where(eq(communityUserInvites.id, input.inviteId))

        return { ok: true }
      }),
    rejectInvite: protectedProcedure
      .input(
        z.object({
          inviteId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [invite] = await ctx.db
          .select({
            id: communityUserInvites.id,
            status: communityUserInvites.status,
          })
          .from(communityUserInvites)
          .where(
            and(
              eq(communityUserInvites.id, input.inviteId),
              eq(communityUserInvites.invitedUserId, ctx.user.id),
            ),
          )
          .limit(1)

        if (!invite || invite.status !== 'pending') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa invitación.' })
        }

        await ctx.db
          .update(communityUserInvites)
          .set({
            status: 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(communityUserInvites.id, input.inviteId))

        return { ok: true }
      }),
    cancelInvite: protectedProcedure
      .input(
        z.object({
          inviteId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [invite] = await ctx.db
          .select({
            communityId: communityUserInvites.communityId,
            id: communityUserInvites.id,
            status: communityUserInvites.status,
          })
          .from(communityUserInvites)
          .where(eq(communityUserInvites.id, input.inviteId))
          .limit(1)

        if (!invite || invite.status !== 'pending') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa invitación.' })
        }

        const actorMembership = await getMembershipForUser(ctx, invite.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canInviteMembers(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes cancelar invitaciones en esta comunidad.',
          })
        }

        await ctx.db
          .update(communityUserInvites)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(communityUserInvites.id, input.inviteId))

        return { ok: true }
      }),
    updateMemberRole: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          role: z.enum(['admin', 'moderator', 'host', 'member']),
          userId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const targetMembership = await getMembershipForUser(ctx, input.communityId, input.userId)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)
        const targetPrimaryRole = getPrimaryRole(targetMembership?.role)

        if (!actorMembership || !targetMembership) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No se encontró ese miembro en la comunidad.',
          })
        }

        if (
          !canAssignRoleToTarget(
            actorPrimaryRole,
            targetPrimaryRole,
            input.role,
            input.userId === ctx.user.id,
          )
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes asignar ese rol.',
          })
        }

        await updateCommunityMemberRole({
          db: ctx.db,
          memberId: targetMembership.id,
          organizationId: input.communityId,
          role: input.role,
        })

        return { ok: true }
      }),
    removeMember: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          userId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const targetMembership = await getMembershipForUser(ctx, input.communityId, input.userId)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)
        const targetPrimaryRole = getPrimaryRole(targetMembership?.role)

        if (!actorMembership || !targetMembership) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No se encontró ese miembro en la comunidad.',
          })
        }

        if (
          !canManageTargetMember(actorPrimaryRole, targetPrimaryRole, input.userId === ctx.user.id)
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes expulsar a ese miembro.',
          })
        }

        await removeMemberFromCommunity({
          db: ctx.db,
          memberId: targetMembership.id,
          organizationId: input.communityId,
        })

        return { ok: true }
      }),
    blockUser: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          reason: z.string().max(280).optional(),
          userId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const targetMembership = await getMembershipForUser(ctx, input.communityId, input.userId)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)
        const targetPrimaryRole = getPrimaryRole(targetMembership?.role)

        if (!actorMembership || !canBlockUsers(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes bloquear usuarios en esta comunidad.',
          })
        }

        if (
          !canBlockTargetMember(actorPrimaryRole, targetPrimaryRole, input.userId === ctx.user.id)
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes bloquear a ese usuario.',
          })
        }

        const [existingBlock] = await ctx.db
          .select({ id: communityBlocks.id })
          .from(communityBlocks)
          .where(
            and(
              eq(communityBlocks.communityId, input.communityId),
              eq(communityBlocks.userId, input.userId),
            ),
          )
          .limit(1)

        if (!existingBlock) {
          await ctx.db.insert(communityBlocks).values({
            blockedByUserId: ctx.user.id,
            communityId: input.communityId,
            reason: input.reason?.trim() || null,
            userId: input.userId,
          })
        }

        if (targetMembership) {
          await removeMemberFromCommunity({
            db: ctx.db,
            memberId: targetMembership.id,
            organizationId: input.communityId,
          })
        }

        await ctx.db
          .update(communityUserInvites)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(communityUserInvites.communityId, input.communityId),
              eq(communityUserInvites.invitedUserId, input.userId),
              eq(communityUserInvites.status, 'pending'),
            ),
          )

        return { ok: true }
      }),
    unblockUser: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          userId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const actorMembership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)
        const actorPrimaryRole = getPrimaryRole(actorMembership?.role)

        if (!actorMembership || !canBlockUsers(actorPrimaryRole)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes desbloquear usuarios en esta comunidad.',
          })
        }

        await ctx.db
          .delete(communityBlocks)
          .where(
            and(
              eq(communityBlocks.communityId, input.communityId),
              eq(communityBlocks.userId, input.userId),
            ),
          )

        return { ok: true }
      }),
  }),
  meetups: createTRPCRouter({
    upcomingPublic: publicProcedure.query(async ({ ctx }) => {
      const viewerProfile = ctx.user
        ? await ctx.db.query.profiles.findFirst({
            where: eq(profiles.userId, ctx.user.id),
          })
        : null

      const upcomingMeetups = await ctx.db
        .select({
          id: meetups.id,
          communityId: communities.organizationId,
          communityKind: communities.kind,
          communityName: communities.name,
          communityCityLat: communities.cityLat,
          communityCityLng: communities.cityLng,
          distanceKm: meetups.distanceKm,
          location: meetups.location,
          locationLat: meetups.locationLat,
          locationLng: meetups.locationLng,
          startsAt: meetups.startsAt,
          title: meetups.title,
          visibility: meetups.visibility,
        })
        .from(meetups)
        .innerJoin(communities, eq(meetups.communityId, communities.organizationId))
        .where(and(eq(communities.visibility, 'public'), eq(meetups.visibility, 'public'), gte(meetups.startsAt, new Date())))
        .orderBy(asc(meetups.startsAt))

      if (upcomingMeetups.length === 0) {
        return []
      }

      const rsvpRows = await ctx.db
        .select({
          meetupId: meetupRsvps.meetupId,
          userId: meetupRsvps.userId,
        })
        .from(meetupRsvps)
        .where(inArray(meetupRsvps.meetupId, upcomingMeetups.map((meetup) => meetup.id)))

      return upcomingMeetups
        .map((meetup) => {
          const meetupRsvpRows = rsvpRows.filter((rsvp) => rsvp.meetupId === meetup.id)
          const meetupLatitude = meetup.locationLat ?? meetup.communityCityLat
          const meetupLongitude = meetup.locationLng ?? meetup.communityCityLng
          const distanceFromViewerKm =
            viewerProfile?.cityLat !== null &&
            viewerProfile?.cityLat !== undefined &&
            viewerProfile?.cityLng !== null &&
            viewerProfile?.cityLng !== undefined &&
            meetupLatitude !== null &&
            meetupLongitude !== null
              ? roundedDistanceKm(
                  haversineDistanceKm(
                    viewerProfile.cityLat,
                    viewerProfile.cityLng,
                    meetupLatitude,
                    meetupLongitude,
                  ),
                )
              : null

          return {
            communityId: meetup.communityId,
            communityKind: meetup.communityKind,
            communityName: meetup.communityName,
            distanceFromViewerKm,
            distanceKm: meetup.distanceKm,
            id: meetup.id,
            location: meetup.location,
            rsvpCount: meetupRsvpRows.length,
            startsAt: meetup.startsAt,
            title: meetup.title,
            viewerIsGoing: ctx.user
              ? meetupRsvpRows.some((rsvp) => rsvp.userId === ctx.user?.id)
              : false,
          }
        })
        .sort((left, right) => {
          if (left.distanceFromViewerKm !== null && right.distanceFromViewerKm !== null) {
            const distanceDifference = left.distanceFromViewerKm - right.distanceFromViewerKm

            if (Math.abs(distanceDifference) > 0.1) {
              return distanceDifference
            }
          } else if (left.distanceFromViewerKm !== null) {
            return -1
          } else if (right.distanceFromViewerKm !== null) {
            return 1
          }

          return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
        })
    }),
    create: protectedProcedure
      .input(
        z.object({
          communityId: z.string().min(1),
          distanceKm: z.number().int().positive(),
          location: z.string().min(2),
          startsAt: z.string().datetime(),
          title: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const community = await ctx.db.query.communities.findFirst({
          where: eq(communities.organizationId, input.communityId),
        })

        if (!community) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa comunidad.' })
        }

        if (await isUserBlockedInCommunity(ctx, input.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes organizar quedadas en esta comunidad.',
          })
        }

        const membership = await getMembershipForUser(ctx, input.communityId, ctx.user.id)

        if (!membership || !canOrganizeCommunityMeetup(community.mode, membership.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes organizar quedadas en esta comunidad.',
          })
        }

        const geocodedLocation = await geocodeMeetupLocation({
          city: community.city,
          location: input.location,
          province: community.cityProvince,
        })

        const [createdMeetup] = await ctx.db
          .insert(meetups)
          .values({
            communityId: input.communityId,
            createdByUserId: ctx.user.id,
            distanceKm: input.distanceKm,
            location: input.location,
            locationLat: geocodedLocation?.latitude ?? community.cityLat ?? null,
            locationLng: geocodedLocation?.longitude ?? community.cityLng ?? null,
            startsAt: new Date(input.startsAt),
            title: input.title,
            visibility: community.visibility === 'private' ? 'members' : 'public',
          })
          .returning()

        return createdMeetup
      }),
    rsvp: protectedProcedure
      .input(
        z.object({
          meetupId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [meetup] = await ctx.db
          .select({
            communityId: communities.organizationId,
            communityVisibility: communities.visibility,
            meetupId: meetups.id,
            meetupVisibility: meetups.visibility,
          })
          .from(meetups)
          .innerJoin(communities, eq(meetups.communityId, communities.organizationId))
          .where(eq(meetups.id, input.meetupId))
          .limit(1)

        if (!meetup) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa quedada.' })
        }

        if (await isUserBlockedInCommunity(ctx, meetup.communityId, ctx.user.id)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'No puedes apuntarte a esta quedada.',
          })
        }

        const membership = await getMembershipForUser(ctx, meetup.communityId, ctx.user.id)
        const canSeeMeetup = canViewerSeeMeetup(
          Boolean(membership),
          meetup.communityVisibility,
          meetup.meetupVisibility,
        )

        if (!canSeeMeetup) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Necesitas formar parte de la comunidad para apuntarte.',
          })
        }

        const [existing] = await ctx.db
          .select({ id: meetupRsvps.id })
          .from(meetupRsvps)
          .where(and(eq(meetupRsvps.meetupId, input.meetupId), eq(meetupRsvps.userId, ctx.user.id)))
          .limit(1)

        if (!existing) {
          await ctx.db.insert(meetupRsvps).values({
            meetupId: input.meetupId,
            userId: ctx.user.id,
          })
        }

        return { ok: true }
      }),
    unrsvp: protectedProcedure
      .input(
        z.object({
          meetupId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .delete(meetupRsvps)
          .where(and(eq(meetupRsvps.meetupId, input.meetupId), eq(meetupRsvps.userId, ctx.user.id)))

        return { ok: true }
      }),
  }),
  profile: createTRPCRouter({
    me: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      })

      return {
        user: ctx.user,
        profile,
      }
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          bio: z.string().max(280).optional(),
          availability: z.string().max(120).optional(),
          availabilitySlots: z.array(availabilitySlotSchema).max(28).optional(),
          city: z.string().min(2),
          citySelection: municipalitySelectionSchema.optional(),
          pace: z.string().min(2),
          username: usernameSchema.optional(),
          level: z.string().optional(),
          distance: z.string().optional(),
          goals: z.string().optional(),
          area: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.query.profiles.findFirst({
          where: eq(profiles.userId, ctx.user.id),
        })

        if (input.username) {
          const profileWithUsername = await ctx.db.query.profiles.findFirst({
            where: eq(profiles.username, input.username),
          })

          if (profileWithUsername && profileWithUsername.userId !== ctx.user.id) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Ese username ya está en uso.',
            })
          }
        }

        if (existing) {
          const cityName = input.citySelection?.municipality ?? input.city
          const [updated] = await ctx.db
            .update(profiles)
            .set({
              availability: input.availability,
              availabilitySlots: input.availabilitySlots ?? [],
              area: input.area,
              bio: input.bio,
              city: cityName,
              cityLat: input.citySelection?.latitude ?? existing.cityLat,
              cityLng: input.citySelection?.longitude ?? existing.cityLng,
              cityProvince: input.citySelection?.province ?? existing.cityProvince,
              citySlug: input.citySelection?.slug ?? existing.citySlug,
              distance: input.distance,
              goals: input.goals,
              level: input.level,
              pace: input.pace,
              updatedAt: new Date(),
              username: input.username ?? existing.username,
            })
            .where(eq(profiles.userId, ctx.user.id))
            .returning()

          return updated
        }

        const [created] = await ctx.db
          .insert(profiles)
          .values({
            availability: input.availability,
            availabilitySlots: input.availabilitySlots ?? [],
            area: input.area,
            bio: input.bio,
            city: input.citySelection?.municipality ?? input.city,
            cityLat: input.citySelection?.latitude,
            cityLng: input.citySelection?.longitude,
            cityProvince: input.citySelection?.province,
            citySlug: input.citySelection?.slug,
            distance: input.distance,
            goals: input.goals,
            level: input.level,
            pace: input.pace,
            userId: ctx.user.id,
            username: input.username,
          })
          .returning()

        return created
      }),
    updateSettings: protectedProcedure
      .input(profileSettingsSchema)
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.query.profiles.findFirst({
          where: eq(profiles.userId, ctx.user.id),
        })

        if (!existing) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Completa tu perfil runner antes de cambiar ajustes.',
          })
        }

        const [updated] = await ctx.db
          .update(profiles)
          .set({
            notificationMeetups: input.notificationMeetups,
            notificationReminders: input.notificationReminders,
            publicProfile: input.publicProfile,
            showArea: input.showArea,
            showCity: input.showCity,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, ctx.user.id))
          .returning()

        return updated
      }),
    publicRunners: protectedProcedure.query(async ({ ctx }) => {
      const profileRows = await ctx.db
        .select({
          area: profiles.area,
          city: profiles.city,
          goals: profiles.goals,
          id: profiles.id,
          level: profiles.level,
          pace: profiles.pace,
          publicProfile: profiles.publicProfile,
          showArea: profiles.showArea,
          showCity: profiles.showCity,
          username: profiles.username,
        })
        .from(profiles)
        .orderBy(desc(profiles.updatedAt))

      return profileRows
        .filter((profile) => profile.publicProfile && profile.username)
        .slice(0, 8)
        .map((profile) => ({
          id: profile.id,
          username: profile.username,
          city: profile.showCity ? profile.city : null,
          area: profile.showArea ? profile.area : null,
          pace: profile.pace,
          level: profile.level,
          goals: profile.goals,
        }))
    }),
    publicByUsername: protectedProcedure
      .input(
        z.object({
          username: usernameSchema,
        }),
      )
      .query(async ({ ctx, input }) => {
        const profile = await ctx.db.query.profiles.findFirst({
          where: eq(profiles.username, input.username),
        })

        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese perfil.' })
        }

        const isSelf = profile.userId === ctx.user.id

        if (!profile.publicProfile && !isSelf) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Este perfil no es público.' })
        }

        const viewerMembershipRows =
          ctx.user && !isSelf
            ? await ctx.db
                .select({
                  communityId: member.organizationId,
                })
                .from(member)
                .where(eq(member.userId, ctx.user.id))
            : []
        const viewerCommunityIds = new Set(
          viewerMembershipRows.map((membership) => membership.communityId),
        )

        const upcomingMeetups = await ctx.db
          .select({
            communityId: communities.organizationId,
            communityKind: communities.kind,
            communityName: communities.name,
            communityVisibility: communities.visibility,
            createdByUserId: meetups.createdByUserId,
            distanceKm: meetups.distanceKm,
            id: meetups.id,
            location: meetups.location,
            startsAt: meetups.startsAt,
            title: meetups.title,
            visibility: meetups.visibility,
          })
          .from(meetups)
          .innerJoin(communities, eq(meetups.communityId, communities.organizationId))
          .where(gte(meetups.startsAt, new Date()))
          .orderBy(asc(meetups.startsAt))

        const meetupIds = upcomingMeetups.map((meetup) => meetup.id)
        const rsvpRows =
          meetupIds.length > 0
            ? await ctx.db
                .select({
                  meetupId: meetupRsvps.meetupId,
                  userId: meetupRsvps.userId,
                })
                .from(meetupRsvps)
                .where(inArray(meetupRsvps.meetupId, meetupIds))
            : []

        const profileMeetups = upcomingMeetups
          .filter((meetup) => {
            const profileIsInMeetup =
              meetup.createdByUserId === profile.userId ||
              rsvpRows.some((rsvp) => rsvp.meetupId === meetup.id && rsvp.userId === profile.userId)

            if (!profileIsInMeetup) {
              return false
            }

            if (isSelf) {
              return true
            }

            return canViewerSeeMeetup(
              viewerCommunityIds.has(meetup.communityId),
              meetup.communityVisibility,
              meetup.visibility,
            )
          })
          .slice(0, 6)

        return {
          profile: {
            username: profile.username,
            city: profile.showCity || isSelf ? profile.city : null,
            area: profile.showArea || isSelf ? profile.area : null,
            pace: profile.pace,
            level: profile.level,
            distance: profile.distance,
            goals: profile.goals,
            availability: profile.availability,
            availabilitySlots: profile.availabilitySlots,
            isSelf,
          },
          upcomingMeetups: profileMeetups,
        }
      }),
  }),
})

export type AppRouter = typeof appRouter
