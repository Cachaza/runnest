export type CommunityKind = 'crew_local' | 'creator_community' | 'club' | 'training_group'
export type CommunityMode = 'collaborative' | 'managed'
export type CommunityVisibility = 'public' | 'private'

export function labelForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'Crew'
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
      return 'crew'
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
    return 'Los miembros activos pueden proponer y organizar quedadas con un estilo más horizontal.'
  }

  return 'El staff publica las quedadas oficiales y mantiene una propuesta más curada para la comunidad.'
}

export function labelForMeetupStyle(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? 'Abierto a miembros' : 'Oficial'
}

export function labelForMeetupOrganizer(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? 'Propuesta de' : 'Publicado por'
}

export function createMeetupCtaLabel(mode?: CommunityMode | null) {
  return mode === 'collaborative' ? '+ Proponer quedada' : '+ Publicar quedada'
}

export function createMeetupTitle(mode?: CommunityMode | null) {
  return mode === 'collaborative'
    ? 'Propón la próxima quedada de tu comunidad.'
    : 'Publica la próxima quedada oficial de tu comunidad.'
}

export function createMeetupBody(mode?: CommunityMode | null) {
  return mode === 'collaborative'
    ? 'En los espacios collaborative los miembros activos pueden mover el grupo con planes sencillos y claros.'
    : 'En los espacios managed el staff marca el calendario con quedadas oficiales y una propuesta más guiada.'
}

export function emptyMeetupsCopy(mode: CommunityMode, entityLabelLower: string) {
  if (mode === 'collaborative') {
    return `Cuando alguien de esta ${entityLabelLower} proponga una salida, aparecerá aquí para que el grupo se organice.`
  }

  return `Cuando el staff de esta ${entityLabelLower} publique una salida oficial, aparecerá aquí.`
}

export function modeCommunityCardCopy(mode?: CommunityMode | null) {
  if (mode === 'collaborative') {
    return 'Aquí los miembros pueden proponer planes, mover horarios y organizar la siguiente quedada.'
  }

  return 'Aquí el staff publica runs oficiales y cuida mejor qué se mueve dentro de la comunidad.'
}

export function managedMemberRunsTitle() {
  return 'Calendario oficial del staff'
}

export function managedMemberRunsBody(entityLabelLower: string) {
  return `Como miembro de esta ${entityLabelLower}, aquí verás las quedadas oficiales del staff y podrás apuntarte cuando encajen contigo.`
}

export function labelForVisibility(visibility?: CommunityVisibility | null) {
  return visibility === 'public' ? 'Pública' : 'Privada'
}

export function descriptionForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'Grupo horizontal para gente de una zona o ciudad. Ideal si quieres que los miembros propongan runs y horarios.'
    case 'creator_community':
      return 'Espacio managed para creator, influencer o coach. El staff controla mejor qué se publica y cómo entra la gente.'
    case 'club':
      return 'Formato más cerrado y disciplinado. Encaja para club privado, staff claro y acceso más controlado.'
    case 'training_group':
      return 'Grupo orientado a preparar objetivos o bloques de entrenamiento. Suele necesitar estructura y hosts visibles.'
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
        accessLinkCopy: 'Preset recomendado: comunidad pública y links con auto-join para crecer fácil.',
      }
    case 'creator_community':
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'public' as CommunityVisibility,
        accessLinkCopy: 'Preset recomendado: managed y approval por defecto en los access links.',
      }
    case 'club':
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'private' as CommunityVisibility,
        accessLinkCopy: 'Preset recomendado: privado y approval casi obligatorio en los access links.',
      }
    case 'training_group':
    default:
      return {
        mode: 'managed' as CommunityMode,
        visibility: 'public' as CommunityVisibility,
        accessLinkCopy: 'Preset recomendado: managed con access links revisados según el tipo de grupo.',
      }
  }
}
