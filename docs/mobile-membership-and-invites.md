# Mobile Membership And Invites

## Summary

AppRunners should keep Better Auth `organization` as the source of truth for:

- members
- roles
- permissions
- classic organization invitations as infrastructure

But the product UX for membership and access should be mobile-first and app-native.

The main invitation flow should not be email-first.

## Product Decision

### Primary flows

1. Public communities

- discovery is public
- the user taps `Unirme`
- membership is created in-app immediately

2. Private communities

- the user gets invited inside the app
- or the user uses an app-native invite/access link later

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
- later `community_access_links`
- later membership requests if needed

When an invite is accepted, the app performs the final membership write into the org-backed member system.

## Phase Order

### Phase 1

- in-app invites by `username`
- accept/reject inside the app
- member role management
- block/unblock users

### Phase 2

- reusable invite/access links
- per-link attribution and analytics
- approval-required links for private or managed communities

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

## Current Implementation Direction

We are implementing now:

- org-backed membership
- staff management in community detail
- in-app invites by `username`

Reusable invite links are a planned next step, not the main focus of this implementation slice.

## Next Slice

The next implementation slice after username invites is:

- `community_access_links`
- staff-created reusable codes
- optional approval before join
- in-app code redemption
- per-link usage and request tracking
