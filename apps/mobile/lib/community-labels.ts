export type CommunityKind = 'crew_local' | 'creator_community' | 'club' | 'training_group'

export function labelForCommunityKind(kind?: CommunityKind | null) {
  switch (kind) {
    case 'crew_local':
      return 'Crew'
    case 'club':
      return 'Club'
    case 'training_group':
      return 'Training Group'
    case 'creator_community':
    default:
      return 'Community'
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
      return 'community'
  }
}

