import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'

import {
  communities,
  communityAccessLinkClaims,
  communityAccessLinks,
  communityBlocks,
  communityJoinRequests,
  db,
  member,
  organization,
  pool,
  user,
  communityUserInvites,
} from '@apprunners/db'
import { seed } from '@apprunners/db/seed'
import { findMunicipalityBySlug } from '@apprunners/geo'

import type { TRPCContext } from './context.js'
import { appRouter } from './router.js'

async function createCallerForUser(userId: string) {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })

  if (!currentUser) {
    throw new Error(`Missing seeded user ${userId}`)
  }

  return appRouter.createCaller({
    db,
    headers: new Headers(),
    session: {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: `session-${userId}`,
      token: `token-${userId}`,
      updatedAt: new Date(),
      userId,
    },
    user: currentUser,
  } as TRPCContext)
}

async function getMembership(communityId: string, userId: string) {
  const [membership] = await db
    .select({
      id: member.id,
      role: member.role,
    })
    .from(member)
    .where(and(eq(member.organizationId, communityId), eq(member.userId, userId)))
    .limit(1)

  return membership ?? null
}

describe('community membership integration', () => {
  beforeEach(async () => {
    await seed()
  })

  afterAll(async () => {
    await pool.end()
  })

  it('creates a community with organization and owner membership in one flow', async () => {
    const madrid = findMunicipalityBySlug('madrid')

    if (!madrid) {
      throw new Error('Missing municipality madrid in geo package')
    }

    const caller = await createCallerForUser('user-marta-retiro')
    const createdCommunity = await caller.communities.create({
      citySelection: {
        latitude: madrid.lat,
        longitude: madrid.lng,
        municipality: madrid.name,
        province: madrid.province,
        slug: madrid.slug,
      },
      description: 'Grupo para bloques de calidad y tiradas largas por Vallecas.',
      kind: 'training_group',
      mode: 'managed',
      name: 'Vallecas Tempo Lab',
      pace: '4:55/km',
      slug: 'vallecas-tempo-lab',
      vibe: 'tempo, race, focused',
      visibility: 'public',
    })

    const [createdOrganization] = await db
      .select({
        id: organization.id,
        slug: organization.slug,
      })
      .from(organization)
      .where(eq(organization.id, createdCommunity.id))
      .limit(1)

    const [createdCommunityRow] = await db
      .select({
        name: communities.name,
        organizationId: communities.organizationId,
        slug: communities.slug,
      })
      .from(communities)
      .where(eq(communities.organizationId, createdCommunity.id))
      .limit(1)

    const ownerMembership = await getMembership(createdCommunity.id, 'user-marta-retiro')

    expect(createdOrganization).toMatchObject({
      id: createdCommunity.id,
      slug: 'vallecas-tempo-lab',
    })
    expect(createdCommunityRow).toMatchObject({
      name: 'Vallecas Tempo Lab',
      organizationId: createdCommunity.id,
      slug: 'vallecas-tempo-lab',
    })
    expect(ownerMembership).toMatchObject({
      role: 'owner',
    })
  })

  it('joins a public community directly', async () => {
    const caller = await createCallerForUser('user-ruben-malvarrosa')

    await caller.communities.joinPublic({
      communityId: 'org-retiro-social',
    })

    await expect(getMembership('org-retiro-social', 'user-ruben-malvarrosa')).resolves.toMatchObject({
      role: 'member',
    })
  })

  it('creates a pending join request for a private community', async () => {
    const caller = await createCallerForUser('user-candela-turia')
    const result = await caller.communities.requestJoin({
      communityId: 'org-bilbao-athletics',
    })

    const [request] = await db
      .select({
        id: communityJoinRequests.id,
        status: communityJoinRequests.status,
        userId: communityJoinRequests.userId,
      })
      .from(communityJoinRequests)
      .where(eq(communityJoinRequests.id, result.requestId))
      .limit(1)

    expect(request).toMatchObject({
      id: result.requestId,
      status: 'pending',
      userId: 'user-candela-turia',
    })
    await expect(getMembership('org-bilbao-athletics', 'user-candela-turia')).resolves.toBeNull()
  })

  it('approves a private join request and creates membership', async () => {
    const applicantCaller = await createCallerForUser('user-candela-turia')
    const reviewerCaller = await createCallerForUser('user-jone-bilbao')
    const joinRequest = await applicantCaller.communities.requestJoin({
      communityId: 'org-bilbao-athletics',
    })

    await reviewerCaller.communities.reviewJoinRequest({
      action: 'approve',
      requestId: joinRequest.requestId,
    })

    const [request] = await db
      .select({
        status: communityJoinRequests.status,
      })
      .from(communityJoinRequests)
      .where(eq(communityJoinRequests.id, joinRequest.requestId))
      .limit(1)

    expect(request?.status).toBe('approved')
    await expect(getMembership('org-bilbao-athletics', 'user-candela-turia')).resolves.toMatchObject({
      role: 'member',
    })
  })

  it('rejects a private join request without creating membership', async () => {
    const applicantCaller = await createCallerForUser('user-marta-retiro')
    const reviewerCaller = await createCallerForUser('user-jone-bilbao')
    const joinRequest = await applicantCaller.communities.requestJoin({
      communityId: 'org-bilbao-athletics',
    })

    await reviewerCaller.communities.reviewJoinRequest({
      action: 'reject',
      requestId: joinRequest.requestId,
    })

    const [request] = await db
      .select({
        status: communityJoinRequests.status,
      })
      .from(communityJoinRequests)
      .where(eq(communityJoinRequests.id, joinRequest.requestId))
      .limit(1)

    expect(request?.status).toBe('rejected')
    await expect(getMembership('org-bilbao-athletics', 'user-marta-retiro')).resolves.toBeNull()
  })

  it('redeems an approval-based access link and approves the resulting claim', async () => {
    const claimantCaller = await createCallerForUser('user-candela-turia')
    const reviewerCaller = await createCallerForUser('user-marina-creator')
    const redeemResult = await claimantCaller.communities.redeemAccessLink({
      code: 'MARINA-CIRCLE',
    })

    expect(redeemResult.status).toBe('pending')

    const [claim] = await db
      .select({
        id: communityAccessLinkClaims.id,
        status: communityAccessLinkClaims.status,
      })
      .from(communityAccessLinkClaims)
      .where(
        and(
          eq(communityAccessLinkClaims.communityId, 'org-marina-circle'),
          eq(communityAccessLinkClaims.userId, 'user-candela-turia'),
        ),
      )
      .orderBy(communityAccessLinkClaims.requestedAt)
      .limit(1)

    expect(claim?.status).toBe('pending')

    await reviewerCaller.communities.approveAccessClaim({
      claimId: claim!.id,
    })

    const [approvedClaim] = await db
      .select({
        status: communityAccessLinkClaims.status,
      })
      .from(communityAccessLinkClaims)
      .where(eq(communityAccessLinkClaims.id, claim!.id))
      .limit(1)

    const [accessLink] = await db
      .select({
        usesCount: communityAccessLinks.usesCount,
      })
      .from(communityAccessLinks)
      .where(eq(communityAccessLinks.code, 'MARINA-CIRCLE'))
      .limit(1)

    expect(approvedClaim?.status).toBe('approved')
    expect(accessLink?.usesCount).toBe(1)
    await expect(getMembership('org-marina-circle', 'user-candela-turia')).resolves.toMatchObject({
      role: 'member',
    })
  })

  it('updates a member role through the membership service flow', async () => {
    const caller = await createCallerForUser('user-jone-bilbao')

    await caller.communities.updateMemberRole({
      communityId: 'org-bilbao-athletics',
      role: 'moderator',
      userId: 'user-diego-canal',
    })

    await expect(getMembership('org-bilbao-athletics', 'user-diego-canal')).resolves.toMatchObject({
      role: 'moderator',
    })
  })

  it('removes a member from the community', async () => {
    const caller = await createCallerForUser('user-marta-retiro')

    await caller.communities.removeMember({
      communityId: 'org-retiro-social',
      userId: 'user-pablo-chamberi',
    })

    await expect(getMembership('org-retiro-social', 'user-pablo-chamberi')).resolves.toBeNull()
  })

  it('blocks a user and removes their membership', async () => {
    const caller = await createCallerForUser('user-marina-creator')

    await caller.communities.blockUser({
      communityId: 'org-marina-circle',
      reason: 'Incumplimiento reiterado de normas de convivencia.',
      userId: 'user-pablo-chamberi',
    })

    const [block] = await db
      .select({
        id: communityBlocks.id,
      })
      .from(communityBlocks)
      .where(
        and(
          eq(communityBlocks.communityId, 'org-marina-circle'),
          eq(communityBlocks.userId, 'user-pablo-chamberi'),
        ),
      )
      .limit(1)

    expect(block).toBeTruthy()
    await expect(getMembership('org-marina-circle', 'user-pablo-chamberi')).resolves.toBeNull()
  })

  it('cancels pending invites when a user is blocked', async () => {
    const caller = await createCallerForUser('user-jone-bilbao')

    await caller.communities.blockUser({
      communityId: 'org-bilbao-athletics',
      reason: 'Cuenta vetada antes de aceptar la invitación.',
      userId: 'user-nil-barceloneta',
    })

    const [invite] = await db
      .select({
        status: communityUserInvites.status,
      })
      .from(communityUserInvites)
      .where(eq(communityUserInvites.id, 'user-invite-bilbao-nil'))
      .limit(1)

    expect(invite?.status).toBe('cancelled')
  })
})
