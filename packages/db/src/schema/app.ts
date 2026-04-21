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

export type AvailabilityDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type AvailabilityPeriod = 'morning' | 'midday' | 'afternoon' | 'evening'
export type AvailabilitySlot = {
  day: AvailabilityDay
  period: AvailabilityPeriod
}

export const profiles = pgTable(
  'profiles',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    userId: text('user_id').notNull(),
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

export const crews = pgTable(
  'crews',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    citySlug: text('city_slug'),
    cityProvince: text('city_province'),
    cityLat: doublePrecision('city_lat'),
    cityLng: doublePrecision('city_lng'),
    pace: text('pace').notNull(),
    vibe: text('vibe').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cityIndex: index('crews_city_idx').on(table.city),
    citySlugIndex: index('crews_city_slug_idx').on(table.citySlug),
    nameIndex: uniqueIndex('crews_name_idx').on(table.name),
  }),
)

export const meetups = pgTable(
  'meetups',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    crewId: integer('crew_id').references(() => crews.id, { onDelete: 'cascade' }).notNull(),
    createdByUserId: text('created_by_user_id'),
    title: text('title').notNull(),
    location: text('location').notNull(),
    locationLat: doublePrecision('location_lat'),
    locationLng: doublePrecision('location_lng'),
    distanceKm: integer('distance_km').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    crewStartsAtIndex: index('meetups_crew_id_starts_at_idx').on(table.crewId, table.startsAt),
  }),
)

export const meetupRsvps = pgTable(
  'meetup_rsvps',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    meetupId: integer('meetup_id').references(() => meetups.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    meetupUserIndex: uniqueIndex('meetup_rsvps_meetup_user_idx').on(table.meetupId, table.userId),
  }),
)
