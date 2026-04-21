import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'

export const communityStatements = {
  ...defaultStatements,
  community_block: ['create', 'delete'],
  run: ['create', 'update', 'delete', 'publish'],
} as const

export const communityAc = createAccessControl(communityStatements)

export const communityRoles = {
  admin: communityAc.newRole({
    ac: ['read'],
    community_block: ['create', 'delete'],
    invitation: ['create', 'cancel'],
    member: ['create', 'update', 'delete'],
    organization: ['update'],
    run: ['create', 'update', 'delete', 'publish'],
    team: [],
  }),
  host: communityAc.newRole({
    ac: ['read'],
    community_block: [],
    invitation: [],
    member: [],
    organization: [],
    run: ['create', 'update', 'delete', 'publish'],
    team: [],
  }),
  member: communityAc.newRole({
    ac: ['read'],
    community_block: [],
    invitation: [],
    member: [],
    organization: [],
    run: [],
    team: [],
  }),
  moderator: communityAc.newRole({
    ac: ['read'],
    community_block: ['create', 'delete'],
    invitation: [],
    member: ['update'],
    organization: [],
    run: [],
    team: [],
  }),
  owner: communityAc.newRole({
    ac: ['create', 'read', 'update', 'delete'],
    community_block: ['create', 'delete'],
    invitation: ['create', 'cancel'],
    member: ['create', 'update', 'delete'],
    organization: ['update', 'delete'],
    run: ['create', 'update', 'delete', 'publish'],
    team: [],
  }),
}
