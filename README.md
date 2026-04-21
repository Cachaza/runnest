# AppRunners Monorepo

Base inicial para una app social de running con:

- `apps/mobile`: Expo Router con navegación por tabs
- `apps/api`: Hono sobre Node.js con Better Auth y tRPC
- `packages/db`: Drizzle ORM, schema compartido y seed
- `docker-compose.yml`: Postgres para desarrollo local
- `pnpm-workspace.yaml`: monorepo simple con `pnpm`

## Primer arranque

1. Instala dependencias:

```bash
pnpm install
```

2. Levanta Postgres:

```bash
pnpm db:up
```

3. Crea variables de entorno:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Genera un secreto fuerte para Better Auth y sustitúyelo en `apps/api/.env`.

4. Aplica el schema de Drizzle, que incluye las tablas de Better Auth y de dominio:

```bash
pnpm db:migrate
```

5. Siembra datos base:

```bash
pnpm db:seed
```

6. Arranca API y app móvil:

```bash
pnpm dev
```

## Notas

- Postgres del monorepo publica en `localhost:5433` para no colisionar con instancias locales ya ocupando `5432`.
- En Android Emulator, `apps/mobile` usa `http://10.0.2.2:8787` por defecto si no defines `EXPO_PUBLIC_API_URL`.
- En dispositivo físico tendrás que apuntar `EXPO_PUBLIC_API_URL` a la IP de tu máquina o a tu VPS.
- `Better Auth` usa el adaptador de Drizzle; sus tablas (`user`, `session`, `account`, `verification`) viven en `packages/db/src/schema/auth.ts` junto al resto del schema compartido.
