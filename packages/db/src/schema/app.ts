import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { organization, user } from './auth.js'

export type AvailabilityDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type AvailabilityPeriod = 'morning' | 'midday' | 'afternoon' | 'evening'
export type AvailabilitySlot = {
  day: AvailabilityDay
  period: AvailabilityPeriod
}

export type CommunityKind = 'crew_local' | 'creator_community' | 'club' | 'training_group'
export type CommunityMode = 'collaborative' | 'managed'
export type CommunityVisibility = 'public' | 'private'
export type MeetupVisibility = 'public' | 'members'
export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'host' | 'member'

export const profiles = pgTable(
  'profiles',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    city: text('city').notNull(),
    pace: text('pace').notNull(),
    bio: text('bio'),
    availability: text('availability'),
    availabilitySlots: jsonb('availability_slots').$type<AvailabilitySlot[]>().default([]).notNull(),
    username: text('username').unique(),
    level: text('level'),
    distance: text('distance'),
    goals: text('goals'),
    area: text('area'),
    citySlug: text('city_slug'),
    cityProvince: text('city_province'),
    cityLat: doublePrecision('city_lat'),
    cityLng: doublePrecision('city_lng'),
    notificationMeetups: boolean('notification_meetups').default(true).notNull(),
    notificationReminders: boolean('notification_reminders').default(true).notNull(),
    publicProfile: boolean('public_profile').default(true).notNull(),
    showCity: boolean('show_city').default(true).notNull(),
    showArea: boolean('show_area').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIndex: uniqueIndex('profiles_user_id_idx').on(table.userId),
  }),
)

export const communities = pgTable(
  'communities',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    kind: text('kind').$type<CommunityKind>().notNull(),
    mode: text('mode').$type<CommunityMode>().notNull(),
    visibility: text('visibility').$type<CommunityVisibility>().notNull(),
    city: text('city').notNull(),
    citySlug: text('city_slug'),
    cityProvince: text('city_province'),
    cityLat: doublePrecision('city_lat'),
    cityLng: doublePrecision('city_lng'),
    pace: text('pace'),
    vibe: text('vibe'),
    coverImageUrl: text('cover_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cityIndex: index('communities_city_idx').on(table.city),
    citySlugIndex: index('communities_city_slug_idx').on(table.citySlug),
    kindIndex: index('communities_kind_idx').on(table.kind),
    visibilityIndex: index('communities_visibility_idx').on(table.visibility),
    slugIndex: uniqueIndex('communities_slug_idx').on(table.slug),
  }),
)

export const meetups = pgTable(
  'meetups',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    location: text('location').notNull(),
    locationLat: doublePrecision('location_lat'),
    locationLng: doublePrecision('location_lng'),
    distanceKm: integer('distance_km').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    visibility: text('visibility').$type<MeetupVisibility>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    communityStartsAtIndex: index('meetups_community_id_starts_at_idx').on(
      table.communityId,
      table.startsAt,
    ),
    visibilityIndex: index('meetups_visibility_idx').on(table.visibility),
  }),
)

export const meetupRsvps = pgTable(
  'meetup_rsvps',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    meetupId: integer('meetup_id')
      .references(() => meetups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    meetupUserIndex: uniqueIndex('meetup_rsvps_meetup_user_idx').on(table.meetupId, table.userId),
  }),
)

export const communityBlocks = pgTable(
  'community_blocks',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blockedByUserId: text('blocked_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    communityUserIndex: uniqueIndex('community_blocks_community_user_idx').on(
      table.communityId,
      table.userId,
    ),
    userIndex: index('community_blocks_user_idx').on(table.userId),
  }),
)
