import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'

export const communityStatements = {
  ...defaultStatements,
  community_block: ['create', 'delete'],
  run: ['create', 'update', 'delete', 'publish'],
} as const

export const communityAc = createAccessControl(communityStatements)

export const ownerRole = communityAc.newRole({
  ac: ['create', 'read', 'update', 'delete'],
  community_block: ['create', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  run: ['create', 'update', 'delete', 'publish'],
  team: [],
})

export const adminRole = communityAc.newRole({
  ac: ['read'],
  community_block: ['create', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update'],
  run: ['create', 'update', 'delete', 'publish'],
  team: [],
})

export const moderatorRole = communityAc.newRole({
  ac: ['read'],
  community_block: ['create', 'delete'],
  invitation: [],
  member: ['update'],
  organization: [],
  run: [],
  team: [],
})

export const hostRole = communityAc.newRole({
  ac: ['read'],
  community_block: [],
  invitation: [],
  member: [],
  organization: [],
  run: ['create', 'update', 'delete', 'publish'],
  team: [],
})

export const memberRole = communityAc.newRole({
  ac: ['read'],
  community_block: [],
  invitation: [],
  member: [],
  organization: [],
  run: [],
  team: [],
})

export const communityRoles = {
  admin: adminRole,
  host: hostRole,
  member: memberRole,
  moderator: moderatorRole,
  owner: ownerRole,
}

export const COMMUNITY_ROLE_ORDER = ['owner', 'admin', 'moderator', 'host', 'member'] as const

export type CommunityRoleName = (typeof COMMUNITY_ROLE_ORDER)[number]
