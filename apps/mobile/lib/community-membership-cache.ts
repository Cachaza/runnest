import { trpc } from '@/lib/trpc'

type TrpcUtils = ReturnType<typeof trpc.useUtils>

type CommunityMembershipInvalidationOptions = {
  communityId?: string | null
}

export async function invalidateCommunityMembershipState(
  utils: TrpcUtils,
  options: CommunityMembershipInvalidationOptions = {},
) {
  const operations = [
    utils.communities.hostable.invalidate(),
    utils.communities.listPublic.invalidate(),
    utils.communities.myAccessLinkClaims.invalidate(),
    utils.communities.myInvites.invalidate(),
    utils.communities.myJoinRequests.invalidate(),
    utils.communities.myMemberships.invalidate(),
    utils.communities.recommended.invalidate(),
    utils.communities.search.invalidate(),
    utils.meetups.upcomingPublic.invalidate(),
  ]

  if (options.communityId) {
    operations.push(utils.communities.byId.invalidate({ id: options.communityId }))
  }

  await Promise.all(operations)
}
