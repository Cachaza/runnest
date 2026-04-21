import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { crews, meetups, meetupRsvps, profiles } from '@apprunners/db'
import { searchMunicipalities } from '@apprunners/geo'

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

function scoreGoalMatch(goals: string | null | undefined, crewText: string) {
  const normalizedGoals = listFromCommaValue(goals).map(normalizeText)
  let score = 0

  for (const goal of normalizedGoals) {
    if (goal.includes('gente') || goal.includes('social')) {
      score += crewText.includes('social') || crewText.includes('coffee') ? 2 : 0
    } else if (goal.includes('10k')) {
      score += crewText.includes('10k') || crewText.includes('tempo') || crewText.includes('race') ? 2 : 0
    } else if (goal.includes('constante')) {
      score += crewText.includes('steady') || crewText.includes('consistent') || crewText.includes('easy') ? 2 : 0
    } else if (goal.includes('ritmo')) {
      score += crewText.includes('tempo') || crewText.includes('pace') || crewText.includes('structured') ? 2 : 0
    } else if (goal.includes('carrera')) {
      score += crewText.includes('race') || crewText.includes('marathon') || crewText.includes('half') ? 2 : 0
    }
  }

  return Math.min(score, 4)
}

function scoreLevelMatch(level: string | null | undefined, crewText: string) {
  const normalized = normalizeText(level)

  if (!normalized) {
    return 0
  }

  if (normalized.includes('principiante')) {
    return crewText.includes('easy') || crewText.includes('low-pressure') ? 2 : 0
  }

  if (normalized.includes('intermedio')) {
    return crewText.includes('steady') || crewText.includes('social') ? 1.5 : 0
  }

  if (normalized.includes('avanzado')) {
    return crewText.includes('tempo') || crewText.includes('structured') ? 2 : 0
  }

  if (normalized.includes('competitivo')) {
    return crewText.includes('race') || crewText.includes('pace') || crewText.includes('marathon') ? 2 : 0
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
  crew: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
) {
  if (profile.citySlug && crew.citySlug && profile.citySlug === crew.citySlug) {
    return {
      score: 4,
      reason: 'misma ciudad',
    }
  }

  if (
    profile.cityLat !== null &&
    profile.cityLng !== null &&
    crew.cityLat !== null &&
    crew.cityLng !== null
  ) {
    const distanceKm = haversineDistanceKm(
      profile.cityLat,
      profile.cityLng,
      crew.cityLat,
      crew.cityLng,
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

  if (normalizeText(crew.city) === normalizeText(profile.city)) {
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

function crewLocationTier(
  profile: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
  crew: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
  },
) {
  if (profile.citySlug && crew.citySlug && profile.citySlug === crew.citySlug) {
    return 'same_city' as const
  }

  if (normalizeText(crew.city) === normalizeText(profile.city)) {
    return 'same_city' as const
  }

  if (
    profile.cityLat !== null &&
    profile.cityLng !== null &&
    crew.cityLat !== null &&
    crew.cityLng !== null
  ) {
    const distanceKm = haversineDistanceKm(
      profile.cityLat,
      profile.cityLng,
      crew.cityLat,
      crew.cityLng,
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

function scoreCrewForProfile(
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
  crew: {
    city: string
    cityLat: number | null
    cityLng: number | null
    citySlug: string | null
    description: string
    meetupDistances: number[]
    meetupDates: Date[]
    name: string
    pace: string
    vibe: string
  },
) {
  let score = 0
  const reasons: string[] = []
  const crewText = normalizeText(`${crew.name} ${crew.city} ${crew.vibe} ${crew.description}`)
  const locationScore = scoreLocationMatch(profile, crew)

  if (locationScore.score > 0 && locationScore.reason) {
    score += locationScore.score
    reasons.push(locationScore.reason)
  }

  if (profile.area && crewText.includes(normalizeText(profile.area))) {
    score += 2
    reasons.push('zona cercana')
  }

  const profilePace = parsePaceToSeconds(profile.pace)
  const crewPace = parsePaceToSeconds(crew.pace)

  if (profilePace !== null && crewPace !== null) {
    const difference = Math.abs(profilePace - crewPace)

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

  if (targetDistance !== null && crew.meetupDistances.length > 0) {
    const closestDistance = Math.min(...crew.meetupDistances.map((distance) => Math.abs(distance - targetDistance)))

    if (closestDistance <= 2) {
      score += 2
      reasons.push('distancia ideal')
    } else if (closestDistance <= 5) {
      score += 1
      reasons.push('distancia cercana')
    }
  }

  const goalScore = scoreGoalMatch(profile.goals, crewText)

  if (goalScore > 0) {
    score += goalScore
    reasons.push('metas compatibles')
  }

  const levelScore = scoreLevelMatch(profile.level, crewText)

  if (levelScore > 0) {
    score += levelScore
    reasons.push('nivel compatible')
  }

  if (profile.availabilitySlots.length > 0 && availabilitySlotsOverlap(profile.availabilitySlots, crew.meetupDates)) {
    score += 1.5
    reasons.push('horarios compatibles')
  }

  if (crew.vibe.includes('social') && !reasons.includes('metas compatibles')) {
    score += 1
  }

  return {
    score,
    reason: reasons.slice(0, 2).join(' + ') || 'explora',
  }
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/)

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
  crews: createTRPCRouter({
    list: publicProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: crews.id,
          name: crews.name,
          city: crews.city,
          pace: crews.pace,
          vibe: crews.vibe,
          description: crews.description,
        })
        .from(crews)
        .orderBy(desc(crews.createdAt))
    }),
    byId: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const [crew] = await ctx.db
          .select({
            id: crews.id,
            name: crews.name,
            city: crews.city,
            pace: crews.pace,
            vibe: crews.vibe,
            description: crews.description,
          })
          .from(crews)
          .where(eq(crews.id, input.id))
          .limit(1)

        if (!crew) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa crew.' })
        }

        const upcomingMeetups = await ctx.db
          .select({
            crewName: crews.name,
            createdByUserId: meetups.createdByUserId,
            distanceKm: meetups.distanceKm,
            id: meetups.id,
            location: meetups.location,
            startsAt: meetups.startsAt,
            title: meetups.title,
          })
          .from(meetups)
          .innerJoin(crews, eq(meetups.crewId, crews.id))
          .where(and(eq(meetups.crewId, input.id), gte(meetups.startsAt, new Date())))
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

        const activeUserIds = [
          ...new Set([
            ...upcomingMeetups.map((meetup) => meetup.createdByUserId).filter(isPresent),
            ...rsvpRows.map((rsvp) => rsvp.userId),
          ]),
        ]

        const activeRunners =
          activeUserIds.length > 0
            ? await ctx.db
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
                  userId: profiles.userId,
                })
                .from(profiles)
                .where(inArray(profiles.userId, activeUserIds))
            : []

        return {
          crew,
          upcomingMeetups: upcomingMeetups.map((meetup) => {
            const meetupRsvpRows = rsvpRows.filter((rsvp) => rsvp.meetupId === meetup.id)

            return {
              ...meetup,
              rsvpCount: meetupRsvpRows.length,
              viewerIsGoing: ctx.user
                ? meetupRsvpRows.some((rsvp) => rsvp.userId === ctx.user?.id)
                : false,
            }
          }),
          activeRunners: activeRunners
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
    recommended: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      })

      const crewRows = await ctx.db
        .select({
          id: crews.id,
          name: crews.name,
          city: crews.city,
          citySlug: crews.citySlug,
          cityProvince: crews.cityProvince,
          cityLat: crews.cityLat,
          cityLng: crews.cityLng,
          pace: crews.pace,
          vibe: crews.vibe,
          description: crews.description,
        })
        .from(crews)
        .orderBy(desc(crews.createdAt))

      const crewMeetups = await ctx.db
        .select({
          crewId: meetups.crewId,
          distanceKm: meetups.distanceKm,
          startsAt: meetups.startsAt,
        })
        .from(meetups)
        .where(gte(meetups.startsAt, new Date()))

      if (!profile) {
        return crewRows.map(({ cityLat: _cityLat, cityLng: _cityLng, cityProvince: _cityProvince, citySlug: _citySlug, ...crew }) => ({
          ...crew,
          recommendationReason: 'complete your profile',
          recommendationScore: 0,
        }))
      }

      const scoredCrews = crewRows
        .map((crew) => {
          const meetupRowsForCrew = crewMeetups.filter((meetup) => meetup.crewId === crew.id)
          const recommendation = scoreCrewForProfile(
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
              city: crew.city,
              cityLat: crew.cityLat,
              cityLng: crew.cityLng,
              citySlug: crew.citySlug,
              description: crew.description,
              meetupDates: meetupRowsForCrew.map((meetup) => meetup.startsAt),
              meetupDistances: meetupRowsForCrew.map((meetup) => meetup.distanceKm),
              name: crew.name,
              pace: crew.pace,
              vibe: crew.vibe,
            },
          )
          const locationTier = crewLocationTier(
            {
              city: profile.city,
              cityLat: profile.cityLat,
              cityLng: profile.cityLng,
              citySlug: profile.citySlug,
            },
            {
              city: crew.city,
              cityLat: crew.cityLat,
              cityLng: crew.cityLng,
              citySlug: crew.citySlug,
            },
          )

          return {
            id: crew.id,
            name: crew.name,
            city: crew.city,
            pace: crew.pace,
            vibe: crew.vibe,
            description: crew.description,
            locationTier,
            recommendationReason: recommendation.reason,
            recommendationScore: recommendation.score,
          }
        })
      const hasSameCityCrews = scoredCrews.some((crew) => crew.locationTier === 'same_city')
      const hasNearbyCrews = scoredCrews.some((crew) => crew.locationTier === 'nearby')
      const locationTierPriority = hasSameCityCrews
        ? { same_city: 0, nearby: 1, other: 2 }
        : hasNearbyCrews
          ? { nearby: 0, same_city: 0, other: 1 }
          : { same_city: 0, nearby: 0, other: 0 }

      return scoredCrews
        .sort((left, right) => {
          const tierDifference =
            locationTierPriority[left.locationTier] - locationTierPriority[right.locationTier]

          if (tierDifference !== 0) {
            return tierDifference
          }

          return right.recommendationScore - left.recommendationScore
        })
        .map(({ locationTier: _locationTier, ...crew }) => crew)
    }),
  }),
  meetups: createTRPCRouter({
    upcoming: publicProcedure.query(async ({ ctx }) => {
      const viewerProfile = ctx.user
        ? await ctx.db.query.profiles.findFirst({
            where: eq(profiles.userId, ctx.user.id),
          })
        : null

      const upcomingMeetups = await ctx.db
        .select({
          crewName: crews.name,
          crewId: crews.id,
          crewCityLat: crews.cityLat,
          crewCityLng: crews.cityLng,
          distanceKm: meetups.distanceKm,
          id: meetups.id,
          location: meetups.location,
          locationLat: meetups.locationLat,
          locationLng: meetups.locationLng,
          startsAt: meetups.startsAt,
          title: meetups.title,
        })
        .from(meetups)
        .innerJoin(crews, eq(meetups.crewId, crews.id))
        .where(gte(meetups.startsAt, new Date()))
        .orderBy(asc(meetups.startsAt))

      const meetupIds = upcomingMeetups.map((meetup) => meetup.id)

      if (meetupIds.length === 0) {
        return []
      }

      const rsvpRows = await ctx.db
        .select({
          meetupId: meetupRsvps.meetupId,
          userId: meetupRsvps.userId,
        })
        .from(meetupRsvps)
        .where(inArray(meetupRsvps.meetupId, meetupIds))

      return upcomingMeetups
        .map((meetup) => {
          const meetupRsvpRows = rsvpRows.filter((rsvp) => rsvp.meetupId === meetup.id)
          const meetupLatitude = meetup.locationLat ?? meetup.crewCityLat
          const meetupLongitude = meetup.locationLng ?? meetup.crewCityLng
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
            crewId: meetup.crewId,
            crewName: meetup.crewName,
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
          crewId: z.number().int().positive(),
          distanceKm: z.number().int().positive(),
          location: z.string().min(2),
          startsAt: z.string().datetime(),
          title: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [crew] = await ctx.db
          .select({
            city: crews.city,
            cityLat: crews.cityLat,
            cityLng: crews.cityLng,
            cityProvince: crews.cityProvince,
            id: crews.id,
          })
          .from(crews)
          .where(eq(crews.id, input.crewId))
          .limit(1)

        if (!crew) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa crew.' })
        }

        const geocodedLocation = await geocodeMeetupLocation({
          city: crew.city,
          location: input.location,
          province: crew.cityProvince,
        })

        const [createdMeetup] = await ctx.db
          .insert(meetups)
          .values({
            crewId: input.crewId,
            createdByUserId: ctx.user.id,
            distanceKm: input.distanceKm,
            location: input.location,
            locationLat: geocodedLocation?.latitude ?? crew.cityLat ?? null,
            locationLng: geocodedLocation?.longitude ?? crew.cityLng ?? null,
            startsAt: new Date(input.startsAt),
            title: input.title,
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
        const [existing] = await ctx.db
          .select()
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
              bio: input.bio,
              city: cityName,
              cityLat: input.citySelection?.latitude ?? existing.cityLat,
              cityLng: input.citySelection?.longitude ?? existing.cityLng,
              cityProvince: input.citySelection?.province ?? existing.cityProvince,
              citySlug: input.citySelection?.slug ?? existing.citySlug,
              pace: input.pace,
              username: input.username ?? existing.username,
              level: input.level,
              distance: input.distance,
              goals: input.goals,
              area: input.area,
              availabilitySlots: input.availabilitySlots ?? [],
              updatedAt: new Date(),
            })
            .where(eq(profiles.userId, ctx.user.id))
            .returning()

          return updated
        }

        const [created] = await ctx.db
          .insert(profiles)
          .values({
            availability: input.availability,
            bio: input.bio,
            city: input.citySelection?.municipality ?? input.city,
            cityLat: input.citySelection?.latitude,
            cityLng: input.citySelection?.longitude,
            cityProvince: input.citySelection?.province,
            citySlug: input.citySelection?.slug,
            pace: input.pace,
            username: input.username,
            level: input.level,
            distance: input.distance,
            goals: input.goals,
            area: input.area,
            availabilitySlots: input.availabilitySlots ?? [],
            userId: ctx.user.id,
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

        const upcomingMeetups = await ctx.db
          .select({
            crewName: crews.name,
            createdByUserId: meetups.createdByUserId,
            distanceKm: meetups.distanceKm,
            id: meetups.id,
            location: meetups.location,
            startsAt: meetups.startsAt,
            title: meetups.title,
          })
          .from(meetups)
          .innerJoin(crews, eq(meetups.crewId, crews.id))
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
          .filter(
            (meetup) =>
              meetup.createdByUserId === profile.userId ||
              rsvpRows.some((rsvp) => rsvp.meetupId === meetup.id && rsvp.userId === profile.userId),
          )
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
