import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { crews, meetups, meetupRsvps, profiles } from '@apprunners/db'

import { createTRPCRouter, protectedProcedure, publicProcedure } from './init.js'

function parsePaceToSeconds(pace: string) {
  const match = pace.match(/(\d+):(\d+)/)

  if (!match) {
    return null
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function scoreCrewForProfile(
  profile: { city: string; pace: string },
  crew: { city: string; pace: string; vibe: string },
) {
  let score = 0
  const reasons: string[] = []

  if (crew.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 3
    reasons.push('same city')
  }

  const profilePace = parsePaceToSeconds(profile.pace)
  const crewPace = parsePaceToSeconds(crew.pace)

  if (profilePace !== null && crewPace !== null) {
    const difference = Math.abs(profilePace - crewPace)

    if (difference <= 20) {
      score += 3
      reasons.push('very close pace')
    } else if (difference <= 45) {
      score += 2
      reasons.push('compatible pace')
    } else if (difference <= 75) {
      score += 1
      reasons.push('stretch pace')
    }
  }

  if (crew.vibe.includes('social')) {
    score += 1
  }

  return {
    score,
    reason: reasons[0] ?? 'explore',
  }
}

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.execute('select 1')

    return {
      status: 'ok',
      database: 'reachable',
    }
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
    recommended: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      })

      const crewRows = await ctx.db
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

      if (!profile) {
        return crewRows.map((crew) => ({
          ...crew,
          recommendationReason: 'complete your profile',
          recommendationScore: 0,
        }))
      }

      return crewRows
        .map((crew) => {
          const recommendation = scoreCrewForProfile(profile, crew)

          return {
            ...crew,
            recommendationReason: recommendation.reason,
            recommendationScore: recommendation.score,
          }
        })
        .sort((left, right) => right.recommendationScore - left.recommendationScore)
    }),
  }),
  meetups: createTRPCRouter({
    upcoming: publicProcedure.query(async ({ ctx }) => {
      const upcomingMeetups = await ctx.db
        .select({
          crewName: crews.name,
          crewId: crews.id,
          distanceKm: meetups.distanceKm,
          id: meetups.id,
          location: meetups.location,
          startsAt: meetups.startsAt,
          title: meetups.title,
        })
        .from(meetups)
        .innerJoin(crews, eq(meetups.crewId, crews.id))
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

      return upcomingMeetups.map((meetup) => {
        const meetupRsvpRows = rsvpRows.filter((rsvp) => rsvp.meetupId === meetup.id)

        return {
          ...meetup,
          rsvpCount: meetupRsvpRows.length,
          viewerIsGoing: ctx.user
            ? meetupRsvpRows.some((rsvp) => rsvp.userId === ctx.user?.id)
            : false,
        }
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
        const [createdMeetup] = await ctx.db
          .insert(meetups)
          .values({
            crewId: input.crewId,
            createdByUserId: ctx.user.id,
            distanceKm: input.distanceKm,
            location: input.location,
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
          city: z.string().min(2),
          pace: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.query.profiles.findFirst({
          where: eq(profiles.userId, ctx.user.id),
        })

        if (existing) {
          const [updated] = await ctx.db
            .update(profiles)
            .set({
              availability: input.availability,
              bio: input.bio,
              city: input.city,
              pace: input.pace,
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
            city: input.city,
            pace: input.pace,
            userId: ctx.user.id,
          })
          .returning()

        return created
      }),
  }),
})

export type AppRouter = typeof appRouter
