# Community Vision

## Summary

AppRunners should stop thinking of `crew` as the final product concept and treat it as a transitional label.
The durable product entity is a `community`.

That community needs to support two distinct operating modes inside the same app:

- `collaborative`: horizontal groups like friends, neighborhood runners, or the town running group
- `managed`: creator, coach, club, or influencer-led communities with staff, moderation, and monetization

The app should keep public run discovery simple for a new user while still supporting private spaces, staff roles, and paid access later.

## Product Principles

### 1. One base entity, different modes

We should avoid splitting the model too early into separate products like `crew`, `community`, `creator server`, and `club`.
Instead, we model one base entity with different configuration:

- `type`: `crew`, `creator`, `club`, `training_group`
- `mode`: `collaborative`, `managed`
- `visibility`: `public`, `private`

This keeps discovery, membership, events, and moderation inside one system while allowing different behavior patterns.

### 2. Collaborative communities are for horizontal coordination

This covers:

- group of friends
- people from the same town
- neighborhood runners
- open local groups

Desired behavior:

- members can propose or organize runs more freely
- coordination can be more horizontal
- chat and planning matter
- public or private visibility should both be possible

Initial rule of thumb:

- in `collaborative` communities, normal active members can organize runs

### 3. Managed communities are for creator or staff-led spaces

This covers:

- influencers
- coaches
- clubs
- paid communities
- communities with moderators and staff

Desired behavior:

- not everybody can do everything
- owners and staff publish official runs
- moderators can help manage the space
- the product can evolve toward channels, premium access, and monetization

Initial rule of thumb:

- in `managed` communities, only staff roles can organize runs

### 4. Roles are not the same as paid access

We need to separate:

- `role`: owner, admin, moderator, host, member
- `membership status`: invited, active, left, blocked
- `access tier`: free, subscriber, coach_client, vip

Paying should not turn someone into an admin.
A paid fan is still a `member`, but with a different access entitlement.

### 5. Discovery should be run-first

Someone who just installed the app should quickly see:

- public runs nearby
- public communities that are relevant
- the host or community behind those runs

Discovery should not require joining a community first.
Public runs are the top-of-funnel surface.

## Data Model Direction

### Base community

Core fields:

- `id`
- `name`
- `slug`
- `description`
- `city`
- `ownerUserId`
- `type`
- `mode`
- `visibility`

### Membership

Core fields:

- `communityId`
- `userId`
- `role`
- `status`
- `joinedAt`

### Runs

Core fields:

- `communityId`
- `createdByUserId`
- `title`
- `startsAt`
- `visibility`
- `accessTier`

## Initial Permission Matrix

### Collaborative communities

- `owner`: full control
- `admin`: management control
- `host`: can organize runs
- `member`: can organize runs

### Managed communities

- `owner`: full control
- `admin`: management control
- `moderator`: moderation only
- `host`: can organize runs
- `member`: cannot organize official runs

## Implementation Strategy

### Phase 1

- keep existing app navigation stable
- extend current `crews` model with community metadata
- add real membership records with roles and status
- stop allowing any authenticated user to create a run in any existing crew
- restrict discovery to public communities and public runs
- use a dedicated query for communities the viewer can organize in

### Phase 2

- add join/leave/invite flows
- add proposal flows for collaborative communities
- add private community visibility rules across detail screens and feeds
- add channels or lightweight chat primitives

### Phase 3

- add access tiers for monetization
- add managed creator community tooling
- add premium runs, premium channels, and coaching products
- support revenue share and payouts

## Current Transition Decision

For now we can still use the word `crew` in parts of the UI as a transitional label, but the underlying model should move toward `community`.
The important part is to stop encoding global-public-static-crew assumptions into the data model and permissions layer.
