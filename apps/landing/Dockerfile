FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json apps/landing/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/geo/package.json packages/geo/package.json

RUN pnpm install --frozen-lockfile --filter @apprunners/landing...

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

ARG PUBLIC_WAITLIST_ENDPOINT
ENV PUBLIC_WAITLIST_ENDPOINT=$PUBLIC_WAITLIST_ENDPOINT

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/landing/node_modules ./apps/landing/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing apps/landing

RUN pnpm --filter @apprunners/landing build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html

EXPOSE 80
