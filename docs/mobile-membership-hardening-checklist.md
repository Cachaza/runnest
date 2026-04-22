# Mobile Membership Hardening Checklist

Use this checklist before shipping new membership features on top of the current slice.

## Backend

- [x] Membership writes are centralized in `apps/api/src/lib/community-membership-service.ts`
- [x] `communities.create` persists `organization`, owner `member`, and `communities` in one DB transaction
- [x] Router procedures no longer scatter raw `auth.api.*` membership calls
- [x] Core membership flows have integration coverage in `apps/api/src/trpc/community-membership.integration.test.ts`

## Covered Integration Flows

- [x] Create community
- [x] Join public community
- [x] Request join on private community
- [x] Approve join request
- [x] Reject join request
- [x] Redeem approval-based access link and approve claim
- [x] Update member role
- [x] Remove member
- [x] Block user

## Mobile State Sync

- [x] Membership mutations invalidate shared membership queries from one helper
- [x] Community detail invalidates together with membership collections after role/member/block changes
- [x] Community create, public join, join request, invite accept, and access-link redeem refresh the same shared membership state

## Deep Links

- [x] `community-access` supports protected re-entry after sign-in/onboarding
- [x] Protected deep links are parsed through a centralized allowlist
- [ ] Invite deep links implemented with the same protected-route gate
- [ ] Direct protected community links implemented with the same protected-route gate

## Manual QA

- [ ] Sign in with an existing user and confirm redirect to `onboarding` when profile is missing
- [ ] Complete onboarding and confirm redirect into `(app)` only after profile exists
- [ ] Open a `community-access` deep link while signed out and confirm deferred re-entry after auth/onboarding
- [ ] Join a public community and verify refreshed state in tabs plus community detail
- [ ] Request access to a private community and verify request state in search plus "Solicitudes enviadas"
- [ ] Approve and reject private join requests from community detail
- [ ] Accept and reject in-app invites from the communities tab
- [ ] Redeem an approval-based access link and approve the claim from community detail
- [ ] Update a member role and verify detail state refreshes without stale role chips
- [ ] Remove a member and verify they disappear from detail plus lose community access
- [ ] Block a user and verify block record, membership removal, and pending invite cancellation when applicable

## Before New Features

- [ ] Re-run `pnpm --filter @apprunners/api test:integration`
- [ ] Re-run `pnpm --filter @apprunners/api build`
- [ ] Re-run `pnpm --filter @apprunners/mobile exec tsc --noEmit`
- [ ] Reconcile this checklist with `docs/mobile-membership-and-invites.md`
