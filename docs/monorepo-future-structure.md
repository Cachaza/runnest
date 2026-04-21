# Monorepo Future Structure

## Purpose

This document defines the intended repo structure if AppRunners grows beyond the current `mobile + api + shared packages` setup.

It exists to keep future web work separated by purpose:

- `mobile` for the real user app
- `admin` for internal operations
- `landing` for the public marketing site

## Current State

Today the repo is a simple `pnpm` workspace with:

- `apps/mobile`: Expo app with Expo Router
- `apps/api`: Hono + tRPC backend
- `packages/db`: shared database schema and tooling
- `packages/geo`: shared location utilities

There is no dedicated public web app yet.
The current web-related files inside `apps/mobile` are Expo web support, not a separate product web frontend.

## Target Structure

If we expand the repo, the preferred direction is:

```text
apps/
  mobile/   -> Expo app for end users
  api/      -> backend API
  admin/    -> private internal admin/backoffice app
  landing/  -> public marketing site

packages/
  db/       -> shared schema, database client, migrations, seed
  geo/      -> shared geo helpers and datasets
  ...       -> future shared packages if they become necessary
```

## Responsibility By App

### `apps/mobile`

Use for:

- authenticated user experience
- onboarding
- communities, runner profiles, meetups, member flows
- the main product

Do not treat Expo web support here as the long-term public website.

### `apps/api`

Use for:

- auth integration
- tRPC procedures
- domain rules
- permissions
- shared backend logic consumed by mobile and future internal tools

### `apps/admin`

Preferred stack: Next.js.

Use for:

- internal-only operations
- user lookup
- community moderation and management
- staff tooling
- operational dashboards
- support workflows
- private analytics views

This is not a user-facing product surface.
It is a backoffice for the owner or staff.

### `apps/landing`

Preferred stack: Astro.

Use for:

- public landing page
- product explanation
- SEO pages
- blog or changelog if needed
- store links
- waitlist or contact forms

This is not the app itself.
It is the public presentation layer.

## Tooling Direction

### Short term

Stay with `pnpm workspaces` while the repo is small.

That is enough for the current shape and also acceptable for the first additional app if complexity stays low.

### When Turborepo becomes reasonable

Consider Turborepo after the repo actually contains multiple app surfaces such as:

- `mobile`
- `api`
- `admin`
- `landing`

It becomes more useful when we want:

- task pipelines across many apps
- cached builds and checks
- cleaner CI execution
- faster repeated local commands in a larger workspace

Do not add Turborepo only as a theoretical improvement.
Add it when the repo size and workflow justify it.

## Product Boundary Rules

Keep these boundaries clear:

- `mobile` is the product users use
- `landing` is public marketing and discovery
- `admin` is private internal tooling

Avoid turning `apps/mobile` web support into the long-term public website or admin panel unless there is a strong temporary reason.

## Naming Suggestion

Recommended names if these apps are created:

- `apps/admin`
- `apps/landing`

Alternative names are acceptable, but keep them explicit and purpose-based.
Avoid ambiguous names like `web` unless the app really contains both marketing and product web surfaces.
