import { fileURLToPath } from 'node:url'

import { count } from 'drizzle-orm'

import { findMunicipalityBySlug, type Municipality } from '@apprunners/geo'

import { db, pool } from './client.js'
import type {
  AvailabilitySlot,
  CommunityKind,
  CommunityJoinRequestStatus,
  CommunityMode,
  CommunityVisibility,
  MeetupVisibility,
} from './schema/app.js'
import {
  communityAccessLinkClaims,
  communityAccessLinks,
  communities,
  communityBlocks,
  communityJoinRequests,
  communityUserInvites,
  invitation,
  meetups,
  meetupRsvps,
  member,
  organization,
  profiles,
  user,
} from './schema/index.js'

type SeedRunner = {
  id: string
  email: string
  name: string
  image?: string
  profile: {
    area: string
    availability: string
    availabilitySlots: AvailabilitySlot[]
    bio: string
    citySlug: string
    distance: string
    goals: string
    level: string
    notificationMeetups?: boolean
    notificationReminders?: boolean
    pace: string
    publicProfile?: boolean
    showArea?: boolean
    showCity?: boolean
    username: string
  }
}

type SeedCommunity = {
  id: string
  ownerUserId: string
  slug: string
  name: string
  description: string
  kind: CommunityKind
  mode: CommunityMode
  visibility: CommunityVisibility
  citySlug: string
  pace?: string
  vibe?: string
}

type SeedMembership = {
  communityId: string
  userId: string
  role: string
}

type SeedMeetup = {
  key: string
  communityId: string
  createdByUserId: string
  title: string
  location: string
  distanceKm: number
  daysFromNow: number
  hour: number
  minute: number
  visibility: MeetupVisibility
}

type SeedRsvp = {
  meetupKey: string
  userId: string
}

type SeedBlock = {
  communityId: string
  userId: string
  blockedByUserId: string
  reason?: string
}

type SeedInvitation = {
  id: string
  email: string
  inviterId: string
  organizationId: string
  role: string
  expiresInDays: number
}

type SeedUserInvite = {
  id: string
  communityId: string
  invitedUserId: string
  invitedByUserId: string
  role: 'admin' | 'moderator' | 'host' | 'member'
  expiresInDays: number
}

type SeedAccessLink = {
  id: string
  communityId: string
  createdByUserId: string
  code: string
  defaultRole: 'admin' | 'moderator' | 'host' | 'member'
  sourceLabel?: string
  requiresApproval?: boolean
  maxUses?: number
  expiresInDays: number
}

type SeedAccessLinkClaim = {
  id: string
  accessLinkId: string
  communityId: string
  userId: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewedByUserId?: string
}

type SeedJoinRequest = {
  id: string
  communityId: string
  userId: string
  status: CommunityJoinRequestStatus
  reviewedByUserId?: string
}

function requireMunicipality(slug: string) {
  const municipality = findMunicipalityBySlug(slug)

  if (!municipality) {
    throw new Error(`Missing municipality in @apprunners/geo: ${slug}`)
  }

  return municipality
}

function locationFields(municipality: Municipality) {
  return {
    city: municipality.name,
    cityLat: municipality.lat,
    cityLng: municipality.lng,
    cityProvince: municipality.province,
    citySlug: municipality.slug,
  }
}

function dateFromOffset(daysFromNow: number, hour: number, minute: number) {
  const date = new Date()

  date.setSeconds(0, 0)
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() + daysFromNow)

  return date
}

const seedRunners: SeedRunner[] = [
  {
    id: 'user-marta-retiro',
    email: 'marta.retiro@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=marta-retiro',
    name: 'Marta Lacruz',
    profile: {
      area: 'Retiro',
      availability: 'Martes y jueves tarde, domingo mañana',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Corre por constancia, por café post-run y por carreras de 10K con gente.',
      citySlug: 'madrid',
      distance: '10K',
      goals: 'Mejorar ritmo, Preparar carreras, Conocer gente',
      level: 'Avanzado',
      pace: '5:10/km',
      username: 'marta_retiro',
    },
  },
  {
    id: 'user-diego-canal',
    email: 'diego.canal@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=diego-canal',
    name: 'Diego Navas',
    profile: {
      area: 'Chamberi',
      availability: 'Lunes y miércoles noche, sábado mañana',
      availabilitySlots: [
        { day: 'mon', period: 'evening' },
        { day: 'wed', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Le van los bloques estructurados y preparar medias con gente seria.',
      citySlug: 'madrid',
      distance: 'Media maratón',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:45/km',
      username: 'diego_canal',
    },
  },
  {
    id: 'user-pablo-chamberi',
    email: 'pablo.chamberi@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=pablo-chamberi',
    name: 'Pablo Soriano',
    profile: {
      area: 'Chamberi',
      availability: 'Entre semana tarde',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'wed', period: 'afternoon' },
      ],
      bio: 'Prefiere encontrar grupo fácil antes de enseñar toda su vida runner.',
      citySlug: 'madrid',
      distance: '10K',
      goals: 'Ser constante, Conocer gente',
      level: 'Intermedio',
      pace: '5:40/km',
      publicProfile: false,
      showArea: false,
      username: 'pablo_chamberi',
    },
  },
  {
    id: 'user-laura-montjuic',
    email: 'laura.montjuic@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=laura-montjuic',
    name: 'Laura Serra',
    profile: {
      area: 'Eixample',
      availability: 'Martes mediodía, viernes tarde y domingo mañana',
      availabilitySlots: [
        { day: 'tue', period: 'midday' },
        { day: 'fri', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Combina quedadas fáciles con preparación de 10K y media.',
      citySlug: 'barcelona',
      distance: '10K',
      goals: 'Primer 10K, Ser constante, Conocer gente',
      level: 'Intermedio',
      pace: '5:55/km',
      username: 'laura_montjuic',
    },
  },
  {
    id: 'user-nil-barceloneta',
    email: 'nil.barceloneta@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=nil-barceloneta',
    name: 'Nil Ferrer',
    profile: {
      area: 'Barceloneta',
      availability: 'Miércoles noche y sábado mañana',
      availabilitySlots: [
        { day: 'wed', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Maratoniano de ciudad, tiradas largas y ritmo sostenido.',
      citySlug: 'barcelona',
      distance: 'Maratón',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:35/km',
      username: 'nil_barceloneta',
    },
  },
  {
    id: 'user-candela-turia',
    email: 'candela.turia@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=candela-turia',
    name: 'Candela Ruiz',
    profile: {
      area: 'Ruzafa',
      availability: 'Lunes tarde, jueves tarde y domingo mañana',
      availabilitySlots: [
        { day: 'mon', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Quiere combinar media maratón, disciplina y algo de vida social.',
      citySlug: 'valencia',
      distance: 'Media maratón',
      goals: 'Preparar carreras, Ser constante',
      level: 'Avanzado',
      pace: '5:20/km',
      username: 'candela_turia',
    },
  },
  {
    id: 'user-ruben-malvarrosa',
    email: 'ruben.malvarrosa@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=ruben-malvarrosa',
    name: 'Ruben Peiro',
    profile: {
      area: 'Malvarrosa',
      availability: 'Martes noche y sábado mañana',
      availabilitySlots: [
        { day: 'tue', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Busca bloques de maratón y gente con la que repetir tiradas.',
      citySlug: 'valencia',
      distance: 'Maratón',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:50/km',
      username: 'ruben_malvarrosa',
    },
  },
  {
    id: 'user-alejandro-coach',
    email: 'alejandro.coach@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=alejandro-coach',
    name: 'Alejandro Pastor',
    profile: {
      area: 'Madrid Río',
      availability: 'Martes y jueves tarde',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
      ],
      bio: 'Coach de fondo que monta comunidad con sesiones guiadas y estructura.',
      citySlug: 'madrid',
      distance: 'Media maratón',
      goals: 'Mejorar ritmo, Preparar carreras',
      level: 'Competitivo',
      pace: '4:20/km',
      username: 'alejandro_coach',
    },
  },
  {
    id: 'user-marina-creator',
    email: 'marina.creator@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=marina-creator',
    name: 'Marina Soler',
    profile: {
      area: 'Poblenou',
      availability: 'Lunes y miércoles tarde',
      availabilitySlots: [
        { day: 'mon', period: 'afternoon' },
        { day: 'wed', period: 'afternoon' },
      ],
      bio: 'Creadora de comunidad con foco en consistencia, técnica y ambiente premium.',
      citySlug: 'barcelona',
      distance: '10K',
      goals: 'Ser constante, Mejorar ritmo',
      level: 'Avanzado',
      pace: '4:55/km',
      username: 'marina_creator',
    },
  },
  {
    id: 'user-jone-bilbao',
    email: 'jone.bilbao@example.test',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=jone-bilbao',
    name: 'Jone Arrieta',
    profile: {
      area: 'Abando',
      availability: 'Martes y jueves tarde',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
      ],
      bio: 'Gestiona un club privado con acceso controlado y entrenos internos.',
      citySlug: 'bilbao',
      distance: '10K',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Avanzado',
      pace: '5:00/km',
      username: 'jone_bilbao',
    },
  },
]

const seedCommunities: SeedCommunity[] = [
  {
    id: 'org-retiro-social',
    ownerUserId: 'user-marta-retiro',
    slug: 'retiro-social-run-club',
    name: 'Retiro Social Run Club',
    description: 'Crew local para rodajes constantes, planes fáciles de proponer y café después.',
    kind: 'crew_local',
    mode: 'collaborative',
    visibility: 'public',
    citySlug: 'madrid',
    pace: '5:20/km',
    vibe: 'social, steady, coffee',
  },
  {
    id: 'org-chamberi-intervals',
    ownerUserId: 'user-diego-canal',
    slug: 'chamberi-intervals',
    name: 'Chamberí Intervals',
    description: 'Crew local con sesiones de tempo, bloques y gente que responde rápido a propuestas.',
    kind: 'crew_local',
    mode: 'collaborative',
    visibility: 'public',
    citySlug: 'madrid',
    pace: '4:45/km',
    vibe: 'structured, race, tempo',
  },
  {
    id: 'org-barcelona-sunrise',
    ownerUserId: 'user-laura-montjuic',
    slug: 'barcelona-sunrise',
    name: 'Barcelona Sunrise',
    description: 'Crew local para rodajes de mañana, buena energía y constancia sin postureo.',
    kind: 'crew_local',
    mode: 'collaborative',
    visibility: 'public',
    citySlug: 'barcelona',
    pace: '5:45/km',
    vibe: 'easy, social, sunrise',
  },
  {
    id: 'org-turia-social',
    ownerUserId: 'user-candela-turia',
    slug: 'turia-social-mile',
    name: 'Turia Social Mile',
    description: 'Crew local abierta para planes por el río, medias y rodajes largos de finde.',
    kind: 'crew_local',
    mode: 'collaborative',
    visibility: 'public',
    citySlug: 'valencia',
    pace: '5:15/km',
    vibe: 'social, half, consistent',
  },
  {
    id: 'org-alejandro-lab',
    ownerUserId: 'user-alejandro-coach',
    slug: 'alejandro-lab',
    name: 'Alejandro Lab',
    description: 'Community managed por coach con sesiones oficiales, hosts y moderación clara.',
    kind: 'creator_community',
    mode: 'managed',
    visibility: 'public',
    citySlug: 'madrid',
    pace: '4:30/km',
    vibe: 'coach, structured, race',
  },
  {
    id: 'org-marina-circle',
    ownerUserId: 'user-marina-creator',
    slug: 'marina-circle',
    name: 'Marina Circle',
    description: 'Community managed en Barcelona con entrenos, técnica y comunidad más editorial.',
    kind: 'creator_community',
    mode: 'managed',
    visibility: 'public',
    citySlug: 'barcelona',
    pace: '5:00/km',
    vibe: 'coach, premium, steady',
  },
  {
    id: 'org-bilbao-athletics',
    ownerUserId: 'user-jone-bilbao',
    slug: 'bilbao-athletics-club',
    name: 'Bilbao Athletics Club',
    description: 'Club privado con acceso por invitación, planificación interna y visibilidad cerrada.',
    kind: 'club',
    mode: 'managed',
    visibility: 'private',
    citySlug: 'bilbao',
    pace: '5:00/km',
    vibe: 'club, private, disciplined',
  },
]

const seedMemberships: SeedMembership[] = [
  { communityId: 'org-retiro-social', userId: 'user-diego-canal', role: 'host' },
  { communityId: 'org-retiro-social', userId: 'user-pablo-chamberi', role: 'member' },
  { communityId: 'org-retiro-social', userId: 'user-alejandro-coach', role: 'member' },
  { communityId: 'org-chamberi-intervals', userId: 'user-marta-retiro', role: 'member' },
  { communityId: 'org-chamberi-intervals', userId: 'user-pablo-chamberi', role: 'member' },
  { communityId: 'org-barcelona-sunrise', userId: 'user-nil-barceloneta', role: 'host' },
  { communityId: 'org-barcelona-sunrise', userId: 'user-marina-creator', role: 'member' },
  { communityId: 'org-turia-social', userId: 'user-ruben-malvarrosa', role: 'member' },
  { communityId: 'org-alejandro-lab', userId: 'user-diego-canal', role: 'host' },
  { communityId: 'org-alejandro-lab', userId: 'user-marta-retiro', role: 'moderator' },
  { communityId: 'org-alejandro-lab', userId: 'user-pablo-chamberi', role: 'member' },
  { communityId: 'org-marina-circle', userId: 'user-laura-montjuic', role: 'host' },
  { communityId: 'org-marina-circle', userId: 'user-nil-barceloneta', role: 'moderator' },
  { communityId: 'org-marina-circle', userId: 'user-pablo-chamberi', role: 'member' },
  { communityId: 'org-bilbao-athletics', userId: 'user-diego-canal', role: 'admin' },
]

const seedMeetups: SeedMeetup[] = [
  {
    key: 'retiro-member-run',
    communityId: 'org-retiro-social',
    createdByUserId: 'user-pablo-chamberi',
    title: 'Retiro afterwork social 8K',
    location: 'Puerta de Alcalá',
    distanceKm: 8,
    daysFromNow: 2,
    hour: 19,
    minute: 30,
    visibility: 'public',
  },
  {
    key: 'retiro-sunday-long',
    communityId: 'org-retiro-social',
    createdByUserId: 'user-marta-retiro',
    title: 'Tirada larga suave por el Retiro',
    location: 'Estanque del Retiro',
    distanceKm: 12,
    daysFromNow: 5,
    hour: 9,
    minute: 0,
    visibility: 'public',
  },
  {
    key: 'chamberi-tempo',
    communityId: 'org-chamberi-intervals',
    createdByUserId: 'user-diego-canal',
    title: 'Tempo blocks en Canal',
    location: 'Parque de Santander',
    distanceKm: 10,
    daysFromNow: 3,
    hour: 20,
    minute: 0,
    visibility: 'public',
  },
  {
    key: 'barcelona-sunrise',
    communityId: 'org-barcelona-sunrise',
    createdByUserId: 'user-laura-montjuic',
    title: 'Sunrise easy run junto al mar',
    location: 'Hospital del Mar',
    distanceKm: 7,
    daysFromNow: 4,
    hour: 7,
    minute: 15,
    visibility: 'public',
  },
  {
    key: 'turia-half-build',
    communityId: 'org-turia-social',
    createdByUserId: 'user-ruben-malvarrosa',
    title: 'Bloque de media por el Turia',
    location: 'Palau de la Música',
    distanceKm: 14,
    daysFromNow: 6,
    hour: 8,
    minute: 45,
    visibility: 'public',
  },
  {
    key: 'alejandro-host-session',
    communityId: 'org-alejandro-lab',
    createdByUserId: 'user-diego-canal',
    title: 'Session oficial de umbral con Diego',
    location: 'Madrid Río - Matadero',
    distanceKm: 10,
    daysFromNow: 1,
    hour: 19,
    minute: 15,
    visibility: 'public',
  },
  {
    key: 'alejandro-members-briefing',
    communityId: 'org-alejandro-lab',
    createdByUserId: 'user-alejandro-coach',
    title: 'Briefing de pacing para miembros',
    location: 'Parque Enrique Tierno Galván',
    distanceKm: 6,
    daysFromNow: 8,
    hour: 18,
    minute: 30,
    visibility: 'members',
  },
  {
    key: 'marina-official',
    communityId: 'org-marina-circle',
    createdByUserId: 'user-marina-creator',
    title: 'Run & drills Marina Circle',
    location: 'Platja del Bogatell',
    distanceKm: 8,
    daysFromNow: 2,
    hour: 18,
    minute: 45,
    visibility: 'public',
  },
  {
    key: 'bilbao-private-session',
    communityId: 'org-bilbao-athletics',
    createdByUserId: 'user-jone-bilbao',
    title: 'Sesión interna BAC hills',
    location: 'Monte Artxanda',
    distanceKm: 10,
    daysFromNow: 7,
    hour: 9,
    minute: 30,
    visibility: 'members',
  },
]

const seedRsvps: SeedRsvp[] = [
  { meetupKey: 'retiro-member-run', userId: 'user-marta-retiro' },
  { meetupKey: 'retiro-member-run', userId: 'user-diego-canal' },
  { meetupKey: 'retiro-member-run', userId: 'user-alejandro-coach' },
  { meetupKey: 'chamberi-tempo', userId: 'user-marta-retiro' },
  { meetupKey: 'barcelona-sunrise', userId: 'user-nil-barceloneta' },
  { meetupKey: 'turia-half-build', userId: 'user-candela-turia' },
  { meetupKey: 'alejandro-host-session', userId: 'user-alejandro-coach' },
  { meetupKey: 'alejandro-host-session', userId: 'user-marta-retiro' },
  { meetupKey: 'alejandro-members-briefing', userId: 'user-diego-canal' },
  { meetupKey: 'marina-official', userId: 'user-laura-montjuic' },
  { meetupKey: 'bilbao-private-session', userId: 'user-diego-canal' },
]

const seedBlocks: SeedBlock[] = [
  {
    communityId: 'org-bilbao-athletics',
    userId: 'user-pablo-chamberi',
    blockedByUserId: 'user-jone-bilbao',
    reason: 'Expulsado del club privado tras incumplir normas internas.',
  },
]

const seedInvitations: SeedInvitation[] = [
  {
    id: 'invite-bilbao-nil',
    email: 'nil.barceloneta@example.test',
    inviterId: 'user-jone-bilbao',
    organizationId: 'org-bilbao-athletics',
    role: 'member',
    expiresInDays: 7,
  },
]

const seedUserInvites: SeedUserInvite[] = [
  {
    id: 'user-invite-bilbao-nil',
    communityId: 'org-bilbao-athletics',
    invitedUserId: 'user-nil-barceloneta',
    invitedByUserId: 'user-jone-bilbao',
    role: 'member',
    expiresInDays: 7,
  },
  {
    id: 'user-invite-marina-ruben',
    communityId: 'org-marina-circle',
    invitedUserId: 'user-ruben-malvarrosa',
    invitedByUserId: 'user-marina-creator',
    role: 'member',
    expiresInDays: 7,
  },
]

const seedAccessLinks: SeedAccessLink[] = [
  {
    id: 'access-link-alejandro-bio',
    communityId: 'org-alejandro-lab',
    createdByUserId: 'user-alejandro-coach',
    code: 'ALEJANDRO-LAB',
    defaultRole: 'member',
    sourceLabel: 'instagram-bio',
    requiresApproval: false,
    maxUses: 250,
    expiresInDays: 30,
  },
  {
    id: 'access-link-marina-story',
    communityId: 'org-marina-circle',
    createdByUserId: 'user-marina-creator',
    code: 'MARINA-CIRCLE',
    defaultRole: 'member',
    sourceLabel: 'story-drop',
    requiresApproval: true,
    maxUses: 100,
    expiresInDays: 14,
  },
]

const seedAccessLinkClaims: SeedAccessLinkClaim[] = [
  {
    id: 'access-claim-marina-ruben',
    accessLinkId: 'access-link-marina-story',
    communityId: 'org-marina-circle',
    userId: 'user-ruben-malvarrosa',
    status: 'pending',
  },
]

const seedJoinRequests: SeedJoinRequest[] = [
  {
    id: 'join-request-bilbao-laura',
    communityId: 'org-bilbao-athletics',
    userId: 'user-laura-montjuic',
    status: 'pending',
  },
  {
    id: 'join-request-bilbao-ruben',
    communityId: 'org-bilbao-athletics',
    userId: 'user-ruben-malvarrosa',
    status: 'rejected',
    reviewedByUserId: 'user-jone-bilbao',
  },
]

export async function seed() {
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.delete(meetupRsvps)
    await tx.delete(communityBlocks)
    await tx.delete(communityAccessLinkClaims)
    await tx.delete(communityAccessLinks)
    await tx.delete(communityJoinRequests)
    await tx.delete(communityUserInvites)
    await tx.delete(meetups)
    await tx.delete(invitation)
    await tx.delete(member)
    await tx.delete(communities)
    await tx.delete(profiles)
    await tx.delete(organization)
    await tx.delete(user)

    await tx.insert(user).values(
      seedRunners.map((runner) => ({
        createdAt: now,
        email: runner.email,
        emailVerified: true,
        id: runner.id,
        image: runner.image,
        name: runner.name,
        updatedAt: now,
      })),
    )

    await tx.insert(profiles).values(
      seedRunners.map((runner) => {
        const municipality = requireMunicipality(runner.profile.citySlug)

        return {
          availability: runner.profile.availability,
          availabilitySlots: runner.profile.availabilitySlots,
          area: runner.profile.area,
          bio: runner.profile.bio,
          city: municipality.name,
          cityLat: municipality.lat,
          cityLng: municipality.lng,
          cityProvince: municipality.province,
          citySlug: municipality.slug,
          createdAt: now,
          distance: runner.profile.distance,
          goals: runner.profile.goals,
          level: runner.profile.level,
          notificationMeetups: runner.profile.notificationMeetups ?? true,
          notificationReminders: runner.profile.notificationReminders ?? true,
          pace: runner.profile.pace,
          publicProfile: runner.profile.publicProfile ?? true,
          showArea: runner.profile.showArea ?? true,
          showCity: runner.profile.showCity ?? true,
          updatedAt: now,
          userId: runner.id,
          username: runner.profile.username,
        }
      }),
    )

    await tx.insert(organization).values(
      seedCommunities.map((community) => ({
        createdAt: now,
        id: community.id,
        logo: null,
        metadata: JSON.stringify({
          kind: community.kind,
          mode: community.mode,
          visibility: community.visibility,
        }),
        name: community.name,
        slug: community.slug,
        updatedAt: now,
      })),
    )

    await tx.insert(communities).values(
      seedCommunities.map((community) => {
        const municipality = requireMunicipality(community.citySlug)

        return {
          ...locationFields(municipality),
          coverImageUrl: null,
          createdAt: now,
          description: community.description,
          kind: community.kind,
          mode: community.mode,
          name: community.name,
          organizationId: community.id,
          pace: community.pace ?? null,
          slug: community.slug,
          updatedAt: now,
          vibe: community.vibe ?? null,
          visibility: community.visibility,
        }
      }),
    )

    await tx.insert(member).values([
      ...seedCommunities.map((community) => ({
        createdAt: now,
        id: `member-${community.id}-${community.ownerUserId}`,
        organizationId: community.id,
        role: 'owner',
        userId: community.ownerUserId,
      })),
      ...seedMemberships.map((membership) => ({
        createdAt: now,
        id: `member-${membership.communityId}-${membership.userId}`,
        organizationId: membership.communityId,
        role: membership.role,
        userId: membership.userId,
      })),
    ])

    await tx.insert(invitation).values(
      seedInvitations.map((entry) => ({
        createdAt: now,
        email: entry.email,
        expiresAt: dateFromOffset(entry.expiresInDays, 23, 59),
        id: entry.id,
        inviterId: entry.inviterId,
        organizationId: entry.organizationId,
        role: entry.role,
        status: 'pending',
      })),
    )

    await tx.insert(communityUserInvites).values(
      seedUserInvites.map((entry) => ({
        communityId: entry.communityId,
        createdAt: now,
        expiresAt: dateFromOffset(entry.expiresInDays, 23, 59),
        id: entry.id,
        invitedByUserId: entry.invitedByUserId,
        invitedUserId: entry.invitedUserId,
        role: entry.role,
        status: 'pending' as const,
        updatedAt: now,
      })),
    )

    await tx.insert(communityAccessLinks).values(
      seedAccessLinks.map((entry) => ({
        code: entry.code,
        communityId: entry.communityId,
        createdAt: now,
        createdByUserId: entry.createdByUserId,
        defaultRole: entry.defaultRole,
        expiresAt: dateFromOffset(entry.expiresInDays, 23, 59),
        id: entry.id,
        isActive: true,
        maxUses: entry.maxUses ?? null,
        requiresApproval: entry.requiresApproval ?? false,
        sourceLabel: entry.sourceLabel ?? null,
        updatedAt: now,
        usesCount: 0,
      })),
    )

    await tx.insert(communityAccessLinkClaims).values(
      seedAccessLinkClaims.map((entry) => ({
        accessLinkId: entry.accessLinkId,
        communityId: entry.communityId,
        id: entry.id,
        requestedAt: now,
        reviewedAt: entry.reviewedByUserId ? now : null,
        reviewedByUserId: entry.reviewedByUserId ?? null,
        status: entry.status,
        userId: entry.userId,
      })),
    )

    await tx.insert(communityJoinRequests).values(
      seedJoinRequests.map((entry) => ({
        communityId: entry.communityId,
        id: entry.id,
        requestedAt: now,
        reviewedAt: entry.reviewedByUserId ? now : null,
        reviewedByUserId: entry.reviewedByUserId ?? null,
        status: entry.status,
        userId: entry.userId,
      })),
    )

    const insertedMeetups = await tx
      .insert(meetups)
      .values(
        seedMeetups.map((meetup) => {
          const community = seedCommunities.find((entry) => entry.id === meetup.communityId)

          if (!community) {
            throw new Error(`Missing seed community for meetup ${meetup.key}`)
          }

          const municipality = requireMunicipality(community.citySlug)

          return {
            communityId: meetup.communityId,
            createdAt: now,
            createdByUserId: meetup.createdByUserId,
            distanceKm: meetup.distanceKm,
            location: meetup.location,
            locationLat: municipality.lat,
            locationLng: municipality.lng,
            startsAt: dateFromOffset(meetup.daysFromNow, meetup.hour, meetup.minute),
            title: meetup.title,
            visibility: meetup.visibility,
          }
        }),
      )
      .returning({ id: meetups.id })

    const meetupIdByKey = new Map(
      seedMeetups.map((meetup, index) => [meetup.key, insertedMeetups[index]?.id ?? null]),
    )

    await tx.insert(meetupRsvps).values(
      seedRsvps.map((rsvp, index) => {
        const meetupId = meetupIdByKey.get(rsvp.meetupKey)

        if (!meetupId) {
          throw new Error(`Missing inserted meetup for RSVP ${rsvp.meetupKey}`)
        }

        return {
          createdAt: new Date(now.getTime() + index * 1000),
          meetupId,
          userId: rsvp.userId,
        }
      }),
    )

    await tx.insert(communityBlocks).values(
      seedBlocks.map((block) => ({
        blockedByUserId: block.blockedByUserId,
        communityId: block.communityId,
        createdAt: now,
        reason: block.reason ?? null,
        userId: block.userId,
      })),
    )
  })

  const [userCount] = await db.select({ value: count() }).from(user)
  const [communityCount] = await db.select({ value: count() }).from(communities)
  const [membershipCount] = await db.select({ value: count() }).from(member)
  const [meetupCount] = await db.select({ value: count() }).from(meetups)

  console.log('Seed completed')
  console.log(
    JSON.stringify(
      {
        users: userCount?.value ?? 0,
        communities: communityCount?.value ?? 0,
        memberships: membershipCount?.value ?? 0,
        meetups: meetupCount?.value ?? 0,
      },
      null,
      2,
    ),
  )
}

const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectExecution) {
  seed()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await pool.end()
    })
}
