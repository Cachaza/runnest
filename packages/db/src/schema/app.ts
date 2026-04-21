import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const profiles = pgTable(
  'profiles',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    userId: text('user_id').notNull(),
    city: text('city').notNull(),
    pace: text('pace').notNull(),
    bio: text('bio'),
    availability: text('availability'),
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
    pace: text('pace').notNull(),
    vibe: text('vibe').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cityIndex: index('crews_city_idx').on(table.city),
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
