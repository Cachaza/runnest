import {
  type AnyPgColumn,
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
export type CommunityUserInviteStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired'
export type CommunityJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type CommunityAccessLinkClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type PushDevicePlatform = 'ios' | 'android' | 'web' | 'unknown'
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed'

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

export const meetupMessages = pgTable(
  'meetup_messages',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    meetupId: integer('meetup_id')
      .references(() => meetups.id, { onDelete: 'cascade' })
      .notNull(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id')
      .references(() => user.id, { onDelete: 'set null' }),
    replyToMessageId: integer('reply_to_message_id').references(
      (): AnyPgColumn => meetupMessages.id,
      { onDelete: 'set null' },
    ),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    meetupCreatedAtIndex: index('meetup_messages_meetup_created_at_idx').on(
      table.meetupId,
      table.createdAt,
    ),
    communityCreatedAtIndex: index('meetup_messages_community_created_at_idx').on(
      table.communityId,
      table.createdAt,
    ),
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

export const communityUserInvites = pgTable(
  'community_user_invites',
  {
    id: text('id').primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    invitedUserId: text('invited_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    invitedByUserId: text('invited_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').$type<CommunityRole>().notNull(),
    status: text('status').$type<CommunityUserInviteStatus>().notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    communityInviteeIndex: index('community_user_invites_community_invited_user_idx').on(
      table.communityId,
      table.invitedUserId,
    ),
    invitedUserStatusIndex: index('community_user_invites_invited_user_status_idx').on(
      table.invitedUserId,
      table.status,
    ),
    statusIndex: index('community_user_invites_status_idx').on(table.status),
  }),
)

export const communityJoinRequests = pgTable(
  'community_join_requests',
  {
    id: text('id').primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').$type<CommunityJoinRequestStatus>().notNull().default('pending'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    communityStatusIndex: index('community_join_requests_community_status_idx').on(
      table.communityId,
      table.status,
    ),
    communityUserIndex: uniqueIndex('community_join_requests_community_user_idx').on(
      table.communityId,
      table.userId,
    ),
    userStatusIndex: index('community_join_requests_user_status_idx').on(table.userId, table.status),
  }),
)

export const communityAccessLinks = pgTable(
  'community_access_links',
  {
    id: text('id').primaryKey(),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    defaultRole: text('default_role').$type<CommunityRole>().notNull(),
    sourceLabel: text('source_label'),
    requiresApproval: boolean('requires_approval').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    maxUses: integer('max_uses'),
    usesCount: integer('uses_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIndex: uniqueIndex('community_access_links_code_idx').on(table.code),
    communityIndex: index('community_access_links_community_idx').on(table.communityId),
    activeIndex: index('community_access_links_active_idx').on(table.communityId, table.isActive),
  }),
)

export const communityAccessLinkClaims = pgTable(
  'community_access_link_claims',
  {
    id: text('id').primaryKey(),
    accessLinkId: text('access_link_id')
      .notNull()
      .references(() => communityAccessLinks.id, { onDelete: 'cascade' }),
    communityId: text('community_id')
      .notNull()
      .references(() => communities.organizationId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').$type<CommunityAccessLinkClaimStatus>().notNull(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => ({
    accessLinkUserIndex: uniqueIndex('community_access_link_claims_link_user_idx').on(
      table.accessLinkId,
      table.userId,
    ),
    communityStatusIndex: index('community_access_link_claims_community_status_idx').on(
      table.communityId,
      table.status,
    ),
    userStatusIndex: index('community_access_link_claims_user_status_idx').on(table.userId, table.status),
  }),
)

export const userPushDevices = pgTable(
  'user_push_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expoPushToken: text('expo_push_token').notNull(),
    platform: text('platform').$type<PushDevicePlatform>().notNull().default('unknown'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIndex: index('user_push_devices_user_idx').on(table.userId),
    activeIndex: index('user_push_devices_active_idx').on(table.userId, table.isActive),
    tokenIndex: uniqueIndex('user_push_devices_token_idx').on(table.expoPushToken),
  }),
)

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    pushDeviceId: text('push_device_id').references(() => userPushDevices.id, {
      onDelete: 'set null',
    }),
    notificationType: text('notification_type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data').$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
    status: text('status').$type<NotificationDeliveryStatus>().notNull().default('pending'),
    providerTicketId: text('provider_ticket_id'),
    providerResponse: text('provider_response'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIndex: index('notification_deliveries_user_idx').on(table.userId),
    statusIndex: index('notification_deliveries_status_idx').on(table.status, table.createdAt),
    typeIndex: index('notification_deliveries_type_idx').on(table.notificationType, table.createdAt),
  }),
)
