# Mobile Membership And Invites

## Summary

AppRunners should keep Better Auth `organization` as the source of truth for:

- members
- roles
- permissions
- classic organization invitations as infrastructure

But the product UX for membership and access should be mobile-first and app-native.

The main invitation flow should not be email-first.

## Status

- [x] Org-backed communities with Better Auth `organization`
- [x] API wrapper/service for org-backed membership writes
- [x] Transactional create flow between `organization` and `communities`
- [x] In-app invites by `username`
- [x] Accept/reject invite inside the mobile app
- [x] Member role management in community detail
- [x] Block/unblock at product layer
- [x] Reusable `community_access_links`
- [x] Approval-required access links for managed/private setups
- [x] Access-link claim review and source attribution
- [x] Private `request to join`
- [x] Search-by-known-name/slug for private communities
- [x] Integration tests for core membership and permission flows
- [x] Unified membership invalidation/refresh on mobile after membership changes
- [x] Protected re-entry for `community-access` deep links after auth/onboarding
- [ ] Invite deep links and direct community deep links still pending implementation

## Product Decision

### Primary flows

1. Public communities

- discovery is public
- the user taps `Unirme`
- membership is created in-app immediately

2. Private communities

- the user gets invited inside the app
- or the user uses an app-native invite/access link later
- or the user searches a known name/slug and sends a join request

3. Managed creator communities

- staff invite existing users by `username`
- creators can later distribute reusable invite/access links

### Secondary flow

- email invitation remains a fallback for people who are not yet inside the app

## Why

Email-first invitation flows are too heavy for a mobile product.

For an app-centered network:

- existing users should be invited by `username`
- acceptance and rejection should happen inside the app
- membership state should be visible inside the app
- reusable links should eventually support creator and influencer distribution

## Product Layers

### Infrastructure layer

Better Auth `organization` remains the final authority for membership and role assignment.

### Product layer

The app adds its own product-native membership primitives:

- `community_user_invites`
- `community_access_links`
- `community_join_requests`

When an invite is accepted, the app performs the final membership write into the org-backed member system.

In API, those org-backed writes now go through a dedicated `community-membership service` so router procedures do not call Better Auth membership APIs directly and error mapping stays consistent.

## Phase Order

### Phase 1

- in-app invites by `username`
- accept/reject inside the app
- member role management
- block/unblock users
- public join for public communities

### Phase 2

- reusable invite/access links
- per-link attribution and analytics
- approval-required links for private or managed communities
- private join requests
- explicit search for known private communities

### Phase 3

- entitlements and paid access
- invite/access links that route through commercial access rules

## Design Rules

### Roles and access stay separate

- `role` controls operational capability
- `tier` or entitlement controls commercial access

These should not be merged.

### Email invites are not the default UX

They are a fallback, not the main interaction model.

### Mobile surfaces must be first-class

The user should be able to:

- see incoming invites in-app
- accept or reject them in-app
- manage members in-app
- invite known users by username in-app

### Private communities are not public discovery inventory

- they do not appear in general public lists
- they do not appear in recommendation feeds
- they can be reached by direct access link
- they can be found only through deliberate search by known name, slug or city hint
- if a user finds one this way, they can request access without exposing all private spaces to everyone

## Current Implementation Direction

- public communities remain run-first discovery
- private communities are invite/link/request based
- Better Auth org membership remains the final source of truth
- product access UX remains app-native and mobile-first
- create community is persisted transactionally across auth-backed org rows and app community rows
- membership writes are centralized in a service layer instead of being scattered across router procedures
- mobile invalidates membership-related queries from one shared helper to avoid stale tabs/detail state

Reusable invite links and private join requests are already in the product layer. The active hardening slice is now largely closed at API and state-sync level; the remaining open item is executing the guided manual QA pass and deciding when to ship future invite/community deep links.

## Preset Policy By Community Type

- `crew_local`
- default `mode`: `collaborative`
- default `visibility`: `public`
- default access-link behavior: auto-join allowed
- rationale: open local growth and lightweight coordination

- `creator_community`
- default `mode`: `managed`
- default `visibility`: `public`
- default access-link behavior: approval recommended but not forced
- rationale: creators need flexible top-of-funnel growth with optional staff review

- `club`
- default `mode`: `managed`
- default `visibility`: `private`
- default access-link behavior: approval required
- rationale: access is intentionally controlled and should not open accidentally

- `training_group`
- default `mode`: `managed`
- default `visibility`: `public`
- default access-link behavior: approval recommended
- rationale: structured groups usually need staff control even when discoverable

The form presets in mobile and the access-link defaults in API should stay aligned with this table unless we make an explicit product decision and update both.

## Deep Link Policy

- Current supported protected deep link: `community-access`
- Behavior: if the user is not ready yet, the app stores the target route, completes sign-in/onboarding, and only then re-enters the protected route
- Policy for future invite/community links: reuse the same protected-route gate instead of letting each screen resolve auth state ad hoc
- Candidate future routes under this policy:
- invite redemption routes
- direct community detail links that should only open after auth/onboarding

Until those routes exist, `community-access` is the only route whitelisted in the protected deep-link parser.

The forward plan for public/shareable `https` links, Universal Links, and invite/community URLs lives in [https-linking-plan.md](./https-linking-plan.md).

## QA Scope

The canonical manual QA path for this slice is:

- sign-in
- onboarding
- app re-entry through `community-access`
- public join
- private request join
- in-app invite accept/reject
- access-link redeem and approve
- role update
- member removal
- block user

Use [mobile-membership-hardening-checklist.md](./mobile-membership-hardening-checklist.md) as the execution checklist so docs and code stay in sync.

## Post-Hardening Backlog

After the current hardening slice is closed, the next product work should prioritize:

- `https` shareable links for access, invite, and community entry flows
- stronger behavior differences between `collaborative` and `managed` communities in run creation and organization
- notification surfaces and status badges for invites, approvals, rejections, removals, and blocks so the experience is less pull-based
