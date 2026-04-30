FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/geo/package.json packages/geo/package.json

RUN pnpm install --frozen-lockfile --filter @apprunners/api...

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/geo/node_modules ./packages/geo/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/geo packages/geo

RUN pnpm --filter @apprunners/api... build

ENV PORT=8787
ENV RUN_MIGRATIONS=false

EXPOSE 8787

CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then pnpm --filter @apprunners/api db:migrate; fi; pnpm --filter @apprunners/api start"]
