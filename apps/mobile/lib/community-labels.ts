export type CommunityKind = 'crew_local' | 'creator_community' | 'club' | 'training_group'
export type CommunityMode = 'collaborative' | 'managed'
export type CommunityVisibility = 'public' | 'private'

export function labelForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'Grupo'
    case 'club':
      return 'Club'
    case 'training_group':
      return 'Grupo de entreno'
    case 'creator_community':
    default:
      return 'Comunidad'
  }
}

export function lowerLabelForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'grupo'
    case 'club':
      return 'club'
    case 'training_group':
      return 'grupo'
    case 'creator_community':
    default:
      return 'comunidad'
  }
}

export function labelForMode(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? 'Colaborativo' : 'Dirigido'
}

export function descriptionForMode(mode?: CommunityMode | null) {
  if (mode === 'collaborative') {
    return 'Cualquiera del grupo puede crear salidas. El grupo se organiza desde la app.'
  }

  return 'El equipo decide las salidas y las publica. Los demás se apuntan si les viene bien.'
}

export function labelForMeetupStyle(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? 'Abierta' : 'Del equipo'
}

export function labelForMeetupOrganizer(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? 'Creada por' : 'Publicada por'
}

export function createMeetupCtaLabel(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? '+ Salida' : '+ Salida'
}

export function createMeetupTitle(mode?: CommunityMode | null) {
  return mode === 'collaborative'
    ? 'Crea la próxima salida.'
    : 'Publica la próxima salida del grupo.'
}

export function createMeetupBody(mode?: CommunityMode | null) {
  return mode === 'collaborative'
    ? 'Hora, lugar y km. El grupo se apunta desde aquí.'
    : 'Día, hora, sitio y distancia. El equipo coordina y los demás se apuntan.'
}

export function emptyMeetupsCopy(mode: CommunityMode, entityLabelLower: string) {
  if (mode === 'collaborative') {
    return `Cuando alguien de este ${entityLabelLower} cree una salida, aparecerá aquí.`
  }

  return `Cuando el equipo publique una salida, aparecerá aquí para que te apuntes.`
}

export function modeCommunityCardCopy(mode?: CommunityMode | null) {
  if (mode === 'collaborative') {
    return 'El grupo crea salidas cuando quiere. Todos se apuntan desde la app.'
  }

  return 'El equipo publica las salidas. Tú te apuntas si te viene bien.'
}

export function managedMemberRunsTitle() {
  return 'Salidas que publica el equipo'
}

export function managedMemberRunsBody(entityLabelLower: string) {
  return `El equipo publica las salidas aquí. Tú te apuntas a las que te vengan bien.`
}

export function labelForVisibility(visibility?: CommunityVisibility | null) {
  return visibility === 'public' ? 'Pública' : 'Privada'
}

export function descriptionForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'Gente de tu zona que corre y se reúne. Sin compromiso, solo salidas cuando toca.'
    case 'creator_community':
      return 'Un coach o influencer coordina el grupo. Tú sigues el plan que publica.'
    case 'club':
      return 'Un club estructurado. Acceso controlado, equipo claro, plan definido.'
    case 'training_group':
      return 'Grupo que se prepara para un objetivo. Entrenamientos coordinados con propósito.'
    default:
      return ''
  }
}

export function recommendedSetupForCommunityKind(kind: CommunityKind) {
  switch (kind) {
    case 'crew_local':
      return {
        mode: 'collaborative' as CommunityMode,
        visibility: 'public' as CommunityVisibility,
        accessLinkCopy: 'Público: que se apunte quien quiera. Códigos sin aprobación para que crezca.',
      }
    case 'creator_community':
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'public' as CommunityVisibility,
        accessLinkCopy: 'Tú diriges. Público pero con códigos que piden aprobación por defecto.',
      }
    case 'club':
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'private' as CommunityVisibility,
        accessLinkCopy: 'Privado: control total. Códigos con aprobación obligatoria.',
      }
    case 'training_group':
    default:
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'public' as CommunityVisibility,
        accessLinkCopy: 'Público. Tú diriges el entrenamiento con códigos revisados.',
      }
  }
}
