# Product Direction - Próximos 3 Meses

## Propósito de este documento

Este documento fija la dirección de producto de AppRunners para los próximos 3 meses.
Sirve como filtro de decisiones: cualquier feature, refactor o discusión técnica debe poder justificarse contra el objetivo definido aquí.

Si algo no contribuye a este objetivo, no se construye ahora, aunque esté en otros docs del proyecto.

> Nota operativa actual: aunque este documento marca como deseable un onboarding mucho más ligero, en la iteración en curso no se va a tocar `onboarding.tsx` ni el gate actual de perfil. El trabajo inmediato se concentra en coordinación de grupo, RSVP, invitaciones, recuperación de contraseña y push.

## Visión a largo plazo (no es el foco de los próximos 3 meses)

A largo plazo, AppRunners quiere resolver dos problemas reales:

- correr solo es aburrido y muchos runners no salen por eso
- no todo el mundo vive en una ciudad con clubes de running accesibles

La visión final es una app donde, estés donde estés, puedas encontrar gente con quien salir a correr sin fricción.

Esa visión sigue siendo válida y orienta el rumbo, pero no es lo que se construye en los próximos 3 meses.

## Objetivo de los próximos 3 meses

Validar que AppRunners funciona como herramienta principal de coordinación para un grupo real de runners que ya existe offline, sustituyendo o complementando WhatsApp.

Frase operativa:

> Quiero que un grupo real de 10-30 runners use AppRunners durante 3 meses como su herramienta principal para coordinar quedadas.

## Por qué esta dirección y no la visión completa

La visión grande (conectar runners desconocidos en cualquier ciudad) tiene un problema serio de huevo y gallina geográfico:

- sin masa crítica local, el discovery está vacío
- sin discovery con contenido, el usuario nuevo no vuelve
- sin usuarios que vuelvan, no hay masa crítica local

Resolverlo desde cero requiere meses de trabajo no técnico (marketing local, alianzas, confianza entre desconocidos, seguridad) y no es viable en 3 meses.

La estrategia es construir el sustrato primero:

- Fase corta: grupos que ya existen offline usan la app
- Fase media: las quedadas públicas de esos grupos son visibles a otros runners cercanos
- Fase larga: cuando hay densidad real, el usuario solitario que se baja la app encuentra contenido real al que apuntarse

Es la misma visión, ejecutada desde el sustrato hacia arriba en lugar de desde el usuario solitario hacia abajo.

## Qué entra en foco

### Producto

- coordinación fluida de quedadas dentro de un grupo conocido
- RSVP rápido y vista clara de quién va
- invitar a alguien nuevo al grupo en menos de un minuto
- notificaciones push reales (sin esto, WhatsApp gana)
- onboarding mínimo para que personas no técnicas puedan entrar
- recuperar contraseña funcional

### Mentalidad

- las quedadas se marcan como `public` por defecto cuando tenga sentido, aunque al principio nadie de fuera las vea
- el grupo es la unidad de crecimiento, no el individuo
- el usuario de referencia es la persona menos técnica del grupo, no el early adopter

## Qué queda fuera de foco

Estas cosas siguen existiendo en otros docs y son válidas a futuro, pero no se trabajan ahora:

- toda la capa de comunidades `managed`, creators, influencers
- pagos, suscripciones, tiers de acceso, monetización
- panel admin separado (`apps/admin`)
- landing pública independiente (`apps/landing`)
- deep links `https` completos con Universal Links y App Links
- chat o DMs dentro de la app
- discovery anónimo sin login para usuarios completamente fríos
- features avanzadas de moderación más allá de lo ya implementado

Si aparece la tentación de añadir "una cosita rápida" para cualquiera de estos frentes, se rechaza.

## Roadmap de los 3 meses

### Mes 1: preparar la app para que aguante un grupo real

Semana 1: lo crítico para no perder al grupo el primer domingo
- notificaciones push reales (motor de delivery, no solo preferencias)
- revisar flujo de crear quedada hasta que sea más rápido que mandar un mensaje en WhatsApp
- arreglar "olvidé contraseña" con flujo real

Semana 2: que entrar sea trivial
- onboarding mucho más ligero
- quitar la obligatoriedad de ciudad desde sugerencias
- permitir entrar dando lo mínimo y completar perfil después o nunca
- el test es: una persona de 50+ años con un código tiene que poder entrar sin ayuda

Semana 3: pulir RSVP y vista de quién va
- la pantalla de "quién viene el domingo" tiene que ser instantánea y satisfactoria
- es el corazón del producto en esta fase

Semana 4: meter al grupo y observar
- no construir features nuevas
- probar el flujo completo con 2-3 personas de confianza unos días antes
- meter al grupo entero
- observar uso real, no pedir feedback constantemente

### Mes 2: reaccionar a lo aprendido

No se planifica con detalle ahora.
Se planifica el día 25 del mes 1 con datos reales del grupo.

Reglas para el mes 2:

- arreglar los pain points reales que aparezcan en uso del mes 1
- empezar a invitar 2-3 personas sueltas externas al grupo (compañero de trabajo, vecino, amigo de un amigo) a quedadas públicas concretas
- observar si esas personas se atreven a venir y qué necesitan ver para hacerlo
- esto es el primer experimento real sobre la visión grande, en escala controlada

### Mes 3: validar transferibilidad

- intentar meter un segundo grupo en una zona cercana
- validar si la mecánica funciona fuera del círculo inicial
- decidir si la hipótesis se sostiene y cómo es el siguiente trimestre

## Qué cosas del backlog actual sí entran y cuáles no

### Sí entran

- cerrar el QA manual pendiente de la capa de membresía (`mobile-membership-hardening-checklist.md`)
- arreglar "olvidé contraseña"
- motor real de notificaciones push
- simplificar el onboarding actual
- pulir RSVP y creación de quedadas

### No entran

- migración a deep links `https` con Universal Links / App Links (`https-linking-plan.md`) más allá de lo mínimo necesario para invitar al grupo por código
- nuevas apps en el monorepo (`apps/admin`, `apps/landing`) descritas en `monorepo-future-structure.md`
- features de la fase 3 de `community-vision.md` (entitlements, paid access, premium runs)
- refactors grandes de archivos monolíticos (`router.ts`, `crew/[id].tsx`) salvo que bloqueen una feature en foco

Los refactors por tamaño de archivo no son prioridad por sí mismos.
Solo se hacen si la complejidad bloquea construir algo del foco.

## Reglas de decisión

Antes de construir algo nuevo, debe pasar este filtro:

1. ¿Sirve para que el grupo real use la app durante 3 meses? Si no, fuera.
2. ¿Lo necesita la persona menos técnica del grupo? Si solo lo necesita un power user, baja la prioridad.
3. ¿Compite directamente con algo que el grupo ya hace en WhatsApp? Si sí, tiene que ser claramente mejor o no se construye.
4. ¿Es algo que se puede observar en uso real, o es una intuición de diseño? Lo observable tiene prioridad.

## Riesgos conocidos

- **Quemar el grupo con una mala primera experiencia**: el grupo se da una vez. Si la primera semana es mala, no se recupera. De ahí la insistencia en no meterlos hasta que la app aguante un domingo entero.
- **Planificar el mes 2 antes de tiempo**: lo que aprenda del grupo va a cambiar el plan. Resistir la tentación de cerrar el roadmap completo ahora.
- **Confundir uso con validación**: que el grupo use la app no valida la visión grande. Solo valida la herramienta de coordinación. Para validar la visión grande hay que provocar el experimento de meses 2 y 3.
- **Tentación de añadir features "para creators" o "para admin"**: cada cosita en otra dirección aleja del foco. Se rechazan.
- **Olvidar que el autor es su propio usuario**: usar la app en las quedadas reales propias es la mejor fuente de feedback. No saltarse este canal por pereza.

## Métricas de éxito a los 3 meses

No son métricas de producto SaaS, son señales cualitativas claras:

- el grupo inicial sigue usando la app como herramienta principal en la semana 12
- al menos una persona externa al grupo ha venido a una quedada gracias a la app
- existe un segundo grupo, aunque sea pequeño, usándola en otra zona o contexto
- hay una lista clara de los 3-5 pain points reales que han salido del uso, y un plan para el siguiente trimestre basado en ellos

Si las cuatro se cumplen, la dirección es correcta y se escala.
Si no se cumplen, hay que revisar la hipótesis antes de seguir construyendo.

## Relación con otros docs del proyecto

Este documento tiene prioridad operativa sobre el resto durante los próximos 3 meses.
Los otros docs siguen siendo válidos como visión y arquitectura, pero no marcan el roadmap inmediato:

- `community-vision.md`: define el modelo conceptual y sigue siendo la base. Lo de modos `managed` y creators queda dormido.
- `mobile-membership-and-invites.md`: la capa de infraestructura ya construida sigue siendo correcta. Solo se cierra el QA pendiente, no se amplía.
- `mobile-membership-hardening-checklist.md`: ejecutar el QA manual pendiente entra en foco.
- `https-linking-plan.md`: aplazado. Solo se mantiene `community-access` por código, que basta para invitar al grupo.
- `monorepo-future-structure.md`: aplazado. No se crean nuevas apps en el monorepo.

Cualquier cambio en este documento debe ser explícito y razonado.
