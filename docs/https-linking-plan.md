# HTTPS Linking Plan

## Why This Matters

Custom schemes like `apprunners://...` are useful inside the app and for technical testing, but they are not enough for product-facing sharing.

For AppRunners, `https` links matter because:

- WhatsApp, email, Notes, and browsers recognize `https://...` links much more reliably than custom schemes.
- If the app is not installed, a pure custom scheme cannot provide a useful fallback.
- Invite and access flows are product surfaces, not just internal navigation.
- Long term, AppRunners should support Universal Links on iOS and App Links on Android so a single public URL can open the app directly.

The current app already has a native scheme in [apps/mobile/app.json](/home/david/Proyectos/apprunners/apps/mobile/app.json:7), but that should become the fallback/native transport, not the primary share format.

## Product Goal

The public/shareable format should be:

- `https://<domain>/a/<access-code-or-token>`
- `https://<domain>/invite/<token>`
- `https://<domain>/community/<slug>`

Those URLs should:

- open the app directly when the app is installed and the platform supports Universal Links / App Links
- fall back to a minimal web page when the app is not installed
- preserve enough context to complete auth/onboarding and then re-enter the correct app route

## Scope Priority

### Phase 1

- `community-access` share links over `https`
- keep current `apprunners://community-access?...` support as internal/native fallback
- support open-after-auth/onboarding re-entry just like current protected deep links

### Phase 2

- invite redemption links over `https`
- direct community links over `https`
- unify all protected incoming routes behind one parser/allowlist

### Phase 3

- growth/share pages with richer web fallback
- analytics attribution for shared links
- deferred deep linking if we later need install-to-open continuation

## URL Strategy

### Public canonical URLs

- `https://app.apprunners.club/access/<code>`
- `https://app.apprunners.club/invite/<token>`
- `https://app.apprunners.club/community/<slug>`

Use one canonical domain for app entry. Avoid sharing raw Expo URLs or raw custom schemes outside internal testing.

### Native route mapping

- `https://app.apprunners.club/access/<code>` -> `/community-access?code=<code>`
- `https://app.apprunners.club/invite/<token>` -> future invite redemption route
- `https://app.apprunners.club/community/<slug>` -> future protected or public community route

### Fallback behavior

- If the app can open the link directly, open the matching route.
- If not, render a simple web page with:
- short explanation of the destination
- CTA to open/install the app
- fallback CTA that keeps useful context visible, for example the access code

## Technical Architecture

### Mobile

- Keep the existing protected deep-link gate in `apps/mobile/app/_layout.tsx`.
- Extend [protected-deep-links.ts](/home/david/Proyectos/apprunners/apps/mobile/lib/protected-deep-links.ts:1) so it can normalize both:
- native scheme URLs like `apprunners://community-access?code=...`
- public `https` URLs like `https://app.apprunners.club/access/...`
- Keep one centralized allowlist of supported incoming link types.
- Do not let each screen parse raw URLs independently.

### Native platform config

- Configure iOS Associated Domains for Universal Links.
- Configure Android App Links and Digital Asset Links.
- Keep `scheme: "apprunners"` for non-Universal-Link fallback and internal testing.
- Move from Expo Go assumptions to development builds / production builds for real link validation.

### Web/domain layer

- Host a minimal HTTPS entry surface on the canonical domain.
- Serve:
- `apple-app-site-association`
- `assetlinks.json`
- fallback landing pages for `/access/*`, `/invite/*`, `/community/*`

This can live either:

- as a lightweight web app under the future web boundary, or
- as a minimal static site dedicated to app entry and fallback pages

Per `docs/monorepo-future-structure.md`, if we formalize a public site later, this domain logic should belong there rather than inside the mobile app itself.

### Backend/API

- Do not expose raw internal DB ids in public links unless we explicitly accept that tradeoff.
- Prefer opaque tokens for invite links.
- Access codes can stay user-facing when they are already meant to be shared.
- Resolve public URL payloads server-side when needed:
- invite token -> invite metadata
- community slug -> public community metadata
- access code -> access flow metadata

## Proposed Implementation Order

### Step 1. Decide the public domain

- Choose the canonical app-entry domain, for example `app.apprunners.club`
- Reserve subdomain strategy now so future landing site and app-entry URLs do not conflict

### Step 2. Ship `https` links for community access first

- Add canonical URL builder for access links
- Share `https://...` instead of raw custom scheme in the UI
- Keep resolving to `/community-access` in mobile
- Keep the current native scheme path as internal fallback

### Step 3. Extend the incoming-link parser

- Support:
- `apprunners://community-access?code=...`
- `https://app.apprunners.club/access/<code>`
- Normalize both into the same internal route object

### Step 4. Add platform association config

- iOS Associated Domains
- Android App Links
- hosted `apple-app-site-association`
- hosted `assetlinks.json`

### Step 5. Add invite HTTPS links

- Introduce a dedicated invite route
- define token format and server resolution
- reuse the same protected-route gate after auth/onboarding

### Step 6. Add direct community HTTPS links

- support public community opening by slug
- define behavior for private communities:
- either show gated landing/fallback
- or require auth and then route into allowed app surface only

## Route Policy

### Access links

- Safe first route for `https` rollout
- already mapped to a dedicated screen
- already supports protected re-entry behavior

### Invite links

- Should become distinct from generic access links
- needs explicit token semantics and redemption state
- should not piggyback forever on access-code UX

### Community links

- public communities can open directly
- private communities must not leak private inventory through public fallback pages
- fallback page for a private community should be minimal and non-indexable

## UX Rules

- Shared links should be short and readable enough to survive messaging apps.
- The user should never need to manually copy a raw custom scheme.
- If the app is not installed, the fallback page should still explain what the link is for.
- If auth/onboarding is required, the user should land in the intended destination after completion.
- Private links must not expose more metadata than the product rules allow.

## Analytics

Add analytics only after the basic linking contract is stable.

Initial useful signals:

- link opened
- app-open via universal link vs fallback web page
- redeemed access link
- accepted invite
- install fallback viewed

Do not block the first version on analytics.

## Risks

- Trying to solve install fallback, attribution, and universal links all at once will slow the slice down.
- If we mix public web fallback pages with private-community semantics carelessly, we can leak private inventory.
- Expo Go is not a reliable validation environment for this feature set.
- If we do not choose one canonical domain early, we will create migration debt in shared links.

## Definition Of Done For Phase 1

- Community access links are shared as `https://...`, not as raw scheme URLs.
- The same link works when pasted into WhatsApp and appears as a normal clickable URL.
- When opened on a device with the app installed and associated correctly, it resolves into the app.
- When opened signed out, the app completes sign-in/onboarding and then re-enters `/community-access`.
- When opened without the app installed, the user sees a meaningful fallback page.
- Native-scheme fallback still works for direct internal testing.

## QA Checklist For HTTPS Links

- Share an access link via WhatsApp and verify the URL is clickable.
- Open the link on iPhone with the app installed.
- Open the link on Android with the app installed.
- Open the link signed out and confirm deferred re-entry after auth/onboarding.
- Open the link on a device without the app installed and verify fallback page quality.
- Confirm private links do not expose too much metadata in fallback.
- Confirm copied/shared links do not include local dev hosts, Expo Go URLs, or raw internal ids unless intentional.

## Recommendation

Do this as the next linking slice:

1. Choose canonical domain.
2. Implement `https` access links first.
3. Extend the protected incoming-link parser to support both native and `https`.
4. Add Universal Links / App Links once the route contract is stable.
5. Then build invite `https` links on top of the same infrastructure.
