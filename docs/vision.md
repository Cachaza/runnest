# Product Direction - Community Operations For Local Running Groups

## Propósito de este documento

Este documento fija la dirección operativa de AppRunners para el ciclo actual.
Sirve como filtro de decisiones: cualquier feature, refactor o discusión técnica debe poder justificarse contra el objetivo definido aquí.

Si algo no contribuye a este objetivo, no se construye ahora, aunque esté en otros docs del proyecto.

> Nota operativa actual: durante este ciclo se mantiene intacto el gate de auth/onboarding existente. No se toca `onboarding.tsx` ni la estructura de rutas salvo petición explícita.

## Tesis

Los grupos locales de running de 15-80 personas necesitan una herramienta móvil propia para organizar quedadas y miembros.
WhatsApp es caótico para operar una crew y Strava está pensado para tracking y red global.

El hueco real es la operativa diaria de la crew:

- publicar quedadas
- gestionar miembros
- controlar RSVPs, cupos y waitlist
- compartir por WhatsApp sin perder el contexto

Frase de posicionamiento:

> Organiza tu crew de running. Publica quedadas, gestiona miembros y llena tus salidas.

Mensaje frente a Strava:

> Usa Strava para registrar la carrera. Usa AppRunners para organizar la quedada.

## ICP MVP

El ICP único del MVP es:

> Admin u organizador de un grupo informal de running de 15-80 personas que hoy coordina por WhatsApp o Instagram.

Anti-ICP explícito para este ciclo:

- atletas individuales que quieren tracking
- clubes federados grandes
- coaches con producto monetizado
- creators o influencers con audiencia
- marcas y eventos profesionales

Coaches, creators y comunidades `managed` quedan en radar, pero fuera del MVP.

## Criterio de éxito MVP

El MVP tiene éxito si:

> 3 admins reales usan AppRunners para organizar sus próximas 4 quedadas cada uno, sin intervención manual del equipo.

No basta con que los usuarios prueben la app. La señal relevante es que admins reales la usen para operar quedadas reales.

## Validación previa

Antes de construir más producto nuevo, salvo cerrar hardening, hay que hacer 5-10 entrevistas con admins reales de grupos de 15-80 personas.

Hipótesis a validar:

- cuál es el dolor más caro: asistencia, nuevos miembros, ruido en el chat, histórico u otro
- si pagarían por resolverlo o, como mínimo, si instalarían la app y empujarían a su grupo a usarla
- qué les haría cambiar parte del flujo actual de WhatsApp
- cómo descubren hoy nuevos runners

Output esperado:

> Un dolor priorizado, no cuatro.

Slice 1 es bloqueante para Slice 2. No se debe construir el nuevo core de runs sin validar antes que el dolor existe y es suficientemente caro.

## Core Del Producto

La comunidad es el contenedor. La quedada es la protagonista.

El trabajo existente de membership, invites, access links y join requests se mantiene. El pivote lo refuerza porque da la infraestructura de acceso, permisos y crecimiento alrededor de la comunidad.

El core nuevo del pivote es:

- `run`: quedada organizada dentro de una comunidad
- `rsvp`: estado de asistencia por usuario
- capacity y waitlist automática
- share `https` por WhatsApp como canal de adquisición

Ver [runs.md](./runs.md) para el diseño de modelo y reglas.

## Qué Entra En Foco

- cerrar el QA manual pendiente de membership hardening
- entrevistas con admins reales
- schema y API de `run` y `rsvp`
- permisos de creación según `community.mode`
- lista de próximas quedadas en community detail
- crear quedada en menos de 30 segundos
- RSVP en un tap
- waitlist automática cuando hay cupo
- link `https://app.apprunners.club/run/<id>` para compartir por WhatsApp
- fallback web mínimo para runs y access links
- Universal Links y App Links para el loop de share

## Qué Queda Fuera De Foco

Estas cosas no se construyen en el MVP:

- tracking GPS o actividades
- integración con Strava
- feed social global
- challenges, segmentos o rankings
- planes de entrenamiento
- coaching o monetización `managed`
- access tiers o pagos
- marketplace de coaches
- apps admin o landing completa nuevas
- web app completa
- analítica avanzada
- chat por quedada o comunidad
- recordatorios automáticos en v1

## Roadmap Ejecutable

### Slice 0 - Cerrar Lo Abierto

Duración estimada: 1-2 semanas.

- ejecutar manual QA pendiente de [mobile-membership-hardening-checklist.md](./mobile-membership-hardening-checklist.md)
- cerrar el slice de hardening sin añadir features nuevas a membership
- no tocar invite deep links ni community deep links todavía

### Slice 1 - Validación Con Admins Reales

Duración estimada: 1-2 semanas, en paralelo a Slice 0.

- listar 10-15 admins potenciales
- hacer 5-10 entrevistas de 15-20 minutos
- sintetizar dolor priorizado y ajuste de scope
- tomar gate decision: seguir con la tesis o ajustar antes de codear más

### Slice 2 - Runs MVP

Duración estimada: 3-4 semanas.

- schema de `run` y `rsvp` en `packages/db`
- tRPC `runs.create`, `runs.list`, `runs.get`, `runs.update`, `runs.cancel`
- tRPC `rsvp.set`, `rsvp.list`
- permisos por mode: `collaborative` vs `managed`
- pantalla de próximas quedadas en community detail
- pantalla de crear quedada
- pantalla detalle con RSVP y lista de asistentes
- waitlist automática
- tests de integración para create, RSVP, cupo y cancel

### Slice 3 - HTTPS Share Y Universal/App Links

Duración estimada: 2-3 semanas.

- decidir dominio canónico, preferiblemente `app.apprunners.club`
- servir `apple-app-site-association` y `assetlinks.json`
- configurar Universal Links iOS
- configurar App Links Android
- builder de URL canónica para runs
- parser centralizado para `https` y `apprunners://`
- fallback mínimo `/run/<id>`
- fallback mínimo `/access/<code>`
- QA de WhatsApp en iOS y Android, signed in y signed out

### Slice 4 - Pulido Para Los Primeros 3 Admins

Duración estimada: 2 semanas.

- crear comunidad rápida y primera quedada en menos de 2 minutos
- copy orientado al admin, no al runner individual
- empty states útiles
- compartir comunidad por WhatsApp
- bug fixes y feedback de los primeros 3 admins

### Slice 5 - Notificaciones Básicas

Se activa cuando los 3 admins lo pidan o el uso real lo haga obvio.

- nuevo RSVP a tu quedada si eres host
- invite recibida
- solicitud de acceso para admins
- recordatorio 24h antes de la quedada, configurable

## Reglas De Decisión

Antes de construir algo nuevo, debe pasar este filtro:

1. ¿Ayuda a 3 admins reales a organizar 4 quedadas cada uno?
2. ¿Ataca el dolor priorizado por entrevistas, no una intuición?
3. ¿Hace que WhatsApp sea menos necesario para operar la quedada?
4. ¿Refuerza runs, RSVP, membership o share links?
5. ¿Mantiene `managed` como opcionalidad futura sin construirlo ahora?

Si la respuesta no es clara, se aparca.

## Riesgos Conocidos

- **Coste de switching desde WhatsApp demasiado alto**: validar en Slice 1 antes de seguir construyendo.
- **Strava añade RSVP o eventos básicos**: mantener foco en operativa fina: roles, invites, access control, capacity y waitlist.
- **Distracción con `managed` o creators**: regla dura: no tocar hasta tener 3 admins activos en collaborative.
- **Construir features que los admins no piden**: priorizar por feedback real de los primeros admins.
- **Universal Links consumen más tiempo del esperado**: asumir 2-3 semanas reales y validar en builds, no en Expo Go.

## Relación Con Otros Docs

Este documento tiene prioridad operativa durante el ciclo actual.

- [product-positioning.md](./product-positioning.md): tesis, ICP, anti-ICP y diferenciación.
- [runs.md](./runs.md): modelo de `run`/`rsvp`, permisos y reglas de waitlist.
- [community-vision.md](./community-vision.md): modelo conceptual de largo plazo. `managed` se preserva, pero queda fuera de v1.
- [mobile-membership-and-invites.md](./mobile-membership-and-invites.md): infraestructura de membership e invites ya construida.
- [https-linking-plan.md](./https-linking-plan.md): `run` share links suben a Phase 1 porque son el loop de adquisición.
- [monorepo-future-structure.md](./monorepo-future-structure.md): referencia futura si aparecen apps admin o landing completa.

Cualquier cambio de foco debe ser explícito y razonado.
