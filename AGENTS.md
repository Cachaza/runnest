# Agent Instructions

- Do not start local development servers, Expo, API watchers, Docker services, database services, or any long-running runtime environment unless the user explicitly asks for it in that turn.
- The user manages the local environment manually. Prefer build/typecheck commands and file changes; leave run instructions in the final response instead of launching servers.
- Preserve the current Expo Router auth structure in `apps/mobile/app`:
  - `sign-in.tsx` is the only public auth entry screen.
  - `onboarding.tsx` is the mandatory intermediate step for authenticated users who still do not have a completed profile.
  - `(app)/` is only for authenticated users with completed onboarding.
  - `(app)/(tabs)/` contains the main authenticated shell: `index`, `communities`, and `profile`.
  - `(app)/modal.tsx`, `(app)/settings.tsx`, `(app)/runner/[username].tsx`, and `(app)/crew/[id].tsx` live inside the authenticated app group.
- Keep routing decisions centralized in `apps/mobile/app/_layout.tsx`:
  - unauthenticated users go to `sign-in`
  - authenticated users without profile go to `onboarding`
  - authenticated users with profile go to `(app)`
- Do not reintroduce auth forms inside tab screens or other authenticated routes.
- When changing navigation, keep modal/detail routes inside `(app)/_layout.tsx` and keep tabs inside `(app)/(tabs)/_layout.tsx`.
- For the current org-backed community model, product rules, and UX direction, use `docs/community-vision.md` as the canonical reference.
