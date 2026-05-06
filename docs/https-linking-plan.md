# HTTPS Linking Plan

## Why This Matters

Custom schemes like `apprunners://...` are useful inside the app and for technical testing, but they are not enough for product-facing sharing.

For the MVP, `https` links are part of the growth loop:

1. Admin creates a run in AppRunners.
2. Admin shares `https://app.apprunners.club/run/<id>` in WhatsApp.
3. Members with the app installed open the run directly.
4. Members without the app see a minimal fallback page with install/open CTA and a safe run preview.
5. After install/login, the user returns to the intended run and can RSVP.

The current app already has a native scheme in [apps/mobile/app.json](/home/david/Proyectos/apprunners/apps/mobile/app.json:7), but that should be the fallback/native transport, not the primary share format.

## Product Goal

The public/shareable format should be:

- `https://app.apprunners.club/run/<id>`
- `https://app.apprunners.club/access/<code>`
- `https://app.apprunners.club/community/<slug>`
- `https://app.apprunners.club/invite/<token>`

Those URLs should:

- open the app directly when Universal Links / App Links are configured
- fall back to a minimal web page when the app is not installed
- preserve enough context to complete auth/onboarding and then re-enter the correct app route
- avoid exposing private community metadata in public fallbacks

## Scope Priority

### Phase 1

- run share links over `https`: `/run/<id>`
- community access links over `https`: `/access/<code>`
- keep current `apprunners://community-access?...` support as internal/native fallback
- add native fallback support for run links if needed for internal testing
- support open-after-auth/onboarding re-entry through the centralized protected deep-link gate
- serve minimal fallback pages for `/run/<id>` and `/access/<code>`

### Phase 2

- direct community links over `https`: `/community/<slug>`
- invite redemption links over `https`: `/invite/<token>`
- unify all protected incoming routes behind one parser/allowlist if Phase 1 did not already finish this

### Phase 3

- richer growth/share pages
- analytics attribution for shared links
- deferred deep linking if install-to-open continuation becomes necessary

## URL Strategy

### Public canonical URLs

- `https://app.apprunners.club/run/<id>`
- `https://app.apprunners.club/access/<code>`
- `https://app.apprunners.club/community/<slug>`
- `https://app.apprunners.club/invite/<token>`

Use one canonical domain for app entry. Avoid sharing raw Expo URLs or raw custom schemes outside internal testing.

### Native route mapping

- `https://app.apprunners.club/run/<id>` -> future protected run detail route
- `https://app.apprunners.club/access/<code>` -> `/community-access?code=<code>`
- `https://app.apprunners.club/community/<slug>` -> future protected or public community route
- `https://app.apprunners.club/invite/<token>` -> future invite redemption route

Existing native-scheme routes should normalize into the same internal route objects as public `https` URLs.

### Fallback behavior

- If the app can open the link directly, open the matching route.
- If not, render a simple web page with a safe preview and CTA to open/install the app.
- For private runs or private communities, do not expose full community inventory or sensitive membership details.
- For access links, show enough context for the user to understand the invitation/access action without leaking private data.

## Technical Architecture

### Mobile

- Keep routing decisions centralized in `apps/mobile/app/_layout.tsx`.
- Keep modal/detail routes inside `(app)/_layout.tsx` and tabs inside `(app)/(tabs)/_layout.tsx`.
- Extend [protected-deep-links.ts](/home/david/Proyectos/apprunners/apps/mobile/lib/protected-deep-links.ts:1) so it can normalize both:
- native scheme URLs like `apprunners://community-access?code=...`
- future native run URLs like `apprunners://run/<id>` if needed
- public `https` URLs like `https://app.apprunners.club/run/<id>`
- public `https` URLs like `https://app.apprunners.club/access/<code>`
- Keep one centralized allowlist of supported incoming link types.
- Do not let individual screens parse raw incoming URLs independently.

### Native Platform Config

- Configure iOS Associated Domains for Universal Links.
- Configure Android App Links and Digital Asset Links.
- Keep `scheme: "apprunners"` for non-Universal-Link fallback and internal testing.
- Validate in development builds / production builds. Expo Go is not a reliable validation environment for Universal Links or App Links.

### Web/Domain Layer

Host a minimal HTTPS entry surface on the canonical domain.

Serve:

- `apple-app-site-association`
- `assetlinks.json`
- fallback landing page for `/run/*`
- fallback landing page for `/access/*`
- later fallback pages for `/community/*` and `/invite/*`

Fallback page requirements for `/run/<id>`:

- show the run title if public and allowed
- show date/time and broad meeting point if allowed
- show community name only if allowed
- show CTA to open/install AppRunners
- no member list for private contexts
- no private community discovery inventory

This web surface should stay minimal. A full web app or full landing product remains out of MVP scope.

### Backend/API

- Prefer opaque public identifiers when feasible.
- Do not expose raw internal DB ids unless the tradeoff is explicit.
- Access codes can stay user-facing when they are already meant to be shared.
- Resolve public URL payloads server-side when needed:
- run id/public id -> safe run preview metadata
- access code -> access flow metadata
- invite token -> invite metadata
- community slug -> public community metadata

## Proposed Implementation Order

### Step 1. Decide The Public Domain

- Choose the canonical app-entry domain, recommended: `app.apprunners.club`.
- Reserve subdomain strategy now so future landing site and app-entry URLs do not conflict.

### Step 2. Add Canonical URL Builders

- Add builder for run share URLs.
- Add or update builder for access URLs.
- Ensure shared UI emits `https://...`, not raw custom schemes.

### Step 3. Extend The Incoming-Link Parser

Support and normalize:

- `https://app.apprunners.club/run/<id>`
- `https://app.apprunners.club/access/<code>`
- `apprunners://community-access?code=...`
- native run fallback if added

The output should be one internal route object shape used by the protected-route gate.

### Step 4. Add Platform Association Config

- iOS Associated Domains
- Android App Links
- hosted `apple-app-site-association`
- hosted `assetlinks.json`

### Step 5. Add Fallback Pages

- `/run/<id>` minimal preview and CTA
- `/access/<code>` minimal access CTA

Do not build a full web product in this step.

### Step 6. Add Community And Invite HTTPS Links Later

- `/community/<slug>`
- `/invite/<token>`

Reuse the same parser, protected gate and fallback pattern.

## Route Policy

### Run Links

- Highest-priority MVP route.
- Primary WhatsApp growth loop.
- Should open run detail and allow RSVP after auth/onboarding and membership/access checks.
- Private run fallback must be intentionally limited.

### Access Links

- Still part of Phase 1.
- Already mapped to a dedicated app flow.
- Already supports protected re-entry behavior.

### Community Links

- Optional for v1.
- Public communities can open directly when implemented.
- Private communities must not leak private inventory through public fallback pages.

### Invite Links

- Optional for v1.
- Should become distinct from generic access links.
- Needs explicit token semantics and redemption state.

## UX Rules

- Shared links should be short and readable enough to survive messaging apps.
- The user should never need to manually copy a raw custom scheme.
- If the app is not installed, the fallback page should still explain what the link is for.
- If auth/onboarding is required, the user should land in the intended destination after completion.
- Private links must not expose more metadata than the product rules allow.

## Analytics

Add analytics only after the basic linking contract is stable.

Initial useful signals:

- run link opened
- app-open via universal link vs fallback web page
- RSVP completed after shared link
- access link redeemed
- install fallback viewed

Do not block the first version on analytics.

## Risks

- Universal Links and App Links are fragile and can consume 2-3 real weeks.
- Expo Go is not a reliable validation environment for this feature set.
- If public fallback pages leak private-community metadata, trust is damaged.
- If we do not choose one canonical domain early, we create migration debt in shared links.
- Trying to solve attribution and deferred install flows too early will slow the slice down.

## Definition Of Done For Phase 1

- Run links are shared as `https://...`, not raw scheme URLs.
- Access links are shared as `https://...`, not raw scheme URLs.
- The run link works when pasted into WhatsApp and appears as a normal clickable URL.
- On iOS with the app installed and associated correctly, the link opens the app.
- On Android with the app installed and associated correctly, the link opens the app.
- When opened signed out, the app completes sign-in/onboarding and re-enters the intended route.
- When opened without the app installed, the user sees a meaningful fallback page.
- Private contexts do not expose inappropriate metadata in fallback.
- Native-scheme fallback still works for internal testing.

## QA Checklist For HTTPS Links

- Share a run link via WhatsApp and verify the URL is clickable.
- Share an access link via WhatsApp and verify the URL is clickable.
- Open run and access links on iPhone with the app installed.
- Open run and access links on Android with the app installed.
- Open links signed out and confirm deferred re-entry after auth/onboarding.
- Open links on a device without the app installed and verify fallback page quality.
- Confirm private links do not expose too much metadata in fallback.
- Confirm copied/shared links do not include local dev hosts, Expo Go URLs, or raw internal ids unless intentional.

## Recommendation

Do this as the MVP linking slice:

1. Choose `app.apprunners.club` or another canonical app-entry domain.
2. Implement `https` run links and `https` access links in Phase 1.
3. Extend the protected incoming-link parser to support both native and `https`.
4. Add Universal Links / App Links once the route contract is stable.
5. Add community and invite `https` links only after run/access links are working.
