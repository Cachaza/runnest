# Runs MVP

## Rol En El Producto

La comunidad es el contenedor. La quedada (`run`) es el core del pivote.

El MVP debe permitir que un admin de una crew cree una quedada, la comparta por WhatsApp y controle quién va sin tener que ordenar mensajes sueltos en un chat.

## Entidad `run`

Campos mínimos:

- `id`
- `communityId`
- `createdByUserId`
- `title`
- `startsAt`
- `meetingPoint`
- `meetingPointLat`
- `meetingPointLng`
- `distanceKm`
- `paceRange`
- `level`
- `runType`
- `capacity`
- `notes`
- `visibility`
- `status`
- `createdAt`
- `updatedAt`

`meetingPointLat` y `meetingPointLng` son opcionales. En v1, `meetingPoint` textual es suficiente.

### `level`

Valores iniciales:

- `beginner`
- `mixed`
- `intermediate`
- `advanced`

### `runType`

Valores iniciales:

- `social`
- `workout`
- `long_run`
- `intervals`
- `other`

### `status`

Valores iniciales:

- `scheduled`
- `cancelled`
- `completed`

### `visibility`

Por defecto hereda de la comunidad.

No se debe usar una quedada de una comunidad privada como inventario público. Si se comparte por link, el fallback web no debe exponer más metadata de la permitida por las reglas de privacidad.

## Entidad `rsvp`

Campos mínimos:

- `runId`
- `userId`
- `status`
- `joinedAt`
- `updatedAt`

### `status`

Valores iniciales:

- `going`
- `maybe`
- `not_going`
- `waitlist`

Debe existir una restricción única por `runId` y `userId`.

## Reglas De Capacity Y Waitlist

- Si `capacity` es `null`, no hay cupo.
- Si hay cupo y quedan plazas, un RSVP a `going` queda como `going`.
- Si hay cupo y ya está lleno, un nuevo RSVP a `going` pasa automáticamente a `waitlist`.
- La waitlist se ordena por `joinedAt`.
- Si alguien cambia de `going` a `maybe`, `not_going` o elimina su asistencia, el primer usuario en `waitlist` sube automáticamente a `going`.
- Una quedada `cancelled` no acepta nuevos `going` ni `waitlist`.

Las notificaciones por promoción desde waitlist quedan fuera de v1.

## Permisos De Creación

La regla depende de `community.mode`.

### `collaborative`

Pueden crear runs:

- `owner`
- `admin`
- `host`
- `member`

El MVP crea comunidades colaborativas por defecto.

### `managed`

Pueden crear runs:

- `owner`
- `admin`
- `host`

Los miembros normales no pueden crear runs oficiales.

`managed` se mantiene en el schema y en las reglas de permisos, pero no guía la UX del MVP.

## Permisos De Lectura

- Miembros activos pueden ver las quedadas de su comunidad.
- Las quedadas públicas pueden ser visibles como share/fallback si la comunidad y la run lo permiten.
- Comunidades privadas no deben filtrar inventario completo en superficies públicas.

## Permisos De RSVP

- Solo usuarios autenticados y con perfil completo pueden hacer RSVP dentro de la app actual.
- El usuario debe ser miembro activo de la comunidad o entrar por un flujo autorizado de access/share antes de confirmar asistencia.
- El host puede ver la lista de asistentes.
- En v1, miembros ven contador y lista salvo que luego se añada configuración específica.

## tRPC MVP

Procedures iniciales:

- `runs.create`
- `runs.list`
- `runs.get`
- `runs.update`
- `runs.cancel`
- `rsvp.set`
- `rsvp.list`

Tests de integración mínimos:

- miembro activo crea run en comunidad `collaborative`
- miembro normal no crea run en comunidad `managed`
- host/admin crea run en comunidad `managed`
- RSVP crea o actualiza estado
- capacity lleno mueve nuevos `going` a `waitlist`
- liberar plaza promociona al primer waitlisted
- run cancelada bloquea nuevos RSVP activos

## UX MVP

- Crear quedada en menos de 30 segundos desde el botón `+`.
- RSVP en un tap desde lista o detalle.
- Community detail muestra próximas quedadas como home principal de la comunidad.
- Detalle de quedada muestra RSVP propio, contador y lista de asistentes.
- Compartir quedada genera un link `https`, no un raw custom scheme.

## Fuera De V1

- GPS tracking durante la quedada
- check-in físico
- chat por quedada
- recordatorios automáticos
- pagos o access tiers
- integración Strava
- mapas o rutas enriquecidas
