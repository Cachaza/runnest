import { count, inArray } from 'drizzle-orm'

import { findMunicipalityBySlug, type Municipality } from '@apprunners/geo'

import { db, pool } from './client.js'
import type { AvailabilitySlot } from './schema/app.js'
import { crews, meetups, meetupRsvps, profiles, user as authUsers } from './schema/index.js'

type SeedRunner = {
  email: string
  id: string
  image?: string
  name: string
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

type SeedCrew = {
  citySlug: string
  description: string
  name: string
  pace: string
  vibe: string
}

type SeedMeetup = {
  createdByUsername: string
  crewName: string
  daysFromNow: number
  distanceKm: number
  hour: number
  key: string
  location: string
  minute: number
  title: string
}

const legacySeedCrewNames = ['Retiro Tempo Crew', 'Barcelona Sunrise Run', 'Valencia Race Prep']

function requireMunicipality(slug: string) {
  const municipality = findMunicipalityBySlug(slug)

  if (!municipality) {
    throw new Error(`Missing municipality in @apprunners/geo: ${slug}`)
  }

  return municipality
}

function locationProfileFields(municipality: Municipality) {
  return {
    city: municipality.name,
    cityLat: municipality.lat,
    cityLng: municipality.lng,
    cityProvince: municipality.province,
    citySlug: municipality.slug,
  }
}

const seedRunners: SeedRunner[] = [
  {
    email: 'marta.retiro@example.test',
    id: 'seed-user-marta-retiro',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=marta-retiro',
    name: 'Marta Lacruz',
    profile: {
      area: 'Retiro',
      availability: 'Martes y jueves tarde, domingo manana',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Busca grupo para preparar 10K sin dejar el cafe post-run.',
      citySlug: 'madrid',
      distance: '10K',
      goals: 'Mejorar ritmo, Preparar carreras, Conocer gente',
      level: 'Avanzado',
      pace: '5:10/km',
      username: 'marta_retiro',
    },
  },
  {
    email: 'diego.canal@example.test',
    id: 'seed-user-diego-canal',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=diego-canal',
    name: 'Diego Navas',
    profile: {
      area: 'Chamberi',
      availability: 'Lunes y miercoles noche, sabado manana',
      availabilitySlots: [
        { day: 'mon', period: 'evening' },
        { day: 'wed', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Entrena media maraton y le van los bloques con ritmo claro.',
      citySlug: 'madrid',
      distance: 'Media maraton',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:45/km',
      username: 'diego_canal',
    },
  },
  {
    email: 'pablo.chamberi@example.test',
    id: 'seed-user-pablo-chamberi',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=pablo-chamberi',
    name: 'Pablo Soriano',
    profile: {
      area: 'Chamberi',
      availability: 'Entre semana tarde',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'wed', period: 'afternoon' },
      ],
      bio: 'Prefiere descubrir crews antes de publicar todo su perfil.',
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
    email: 'laura.montjuic@example.test',
    id: 'seed-user-laura-montjuic',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=laura-montjuic',
    name: 'Laura Serra',
    profile: {
      area: 'Eixample',
      availability: 'Martes mediodia, viernes tarde y domingo manana',
      availabilitySlots: [
        { day: 'tue', period: 'midday' },
        { day: 'fri', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Quiere cerrar su primer 10K con gente constante.',
      citySlug: 'barcelona',
      distance: '10K',
      goals: 'Primer 10K, Ser constante, Conocer gente',
      level: 'Intermedio',
      pace: '5:55/km',
      username: 'laura_montjuic',
    },
  },
  {
    email: 'nil.barceloneta@example.test',
    id: 'seed-user-nil-barceloneta',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=nil-barceloneta',
    name: 'Nil Ferrer',
    profile: {
      area: 'Barceloneta',
      availability: 'Miercoles noche y sabado manana',
      availabilitySlots: [
        { day: 'wed', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Maratoniano de ciudad que disfruta tiradas largas al amanecer.',
      citySlug: 'barcelona',
      distance: 'Maraton',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:35/km',
      username: 'nil_barceloneta',
    },
  },
  {
    email: 'candela.turia@example.test',
    id: 'seed-user-candela-turia',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=candela-turia',
    name: 'Candela Ruiz',
    profile: {
      area: 'Ruzafa',
      availability: 'Lunes tarde, jueves tarde y domingo manana',
      availabilitySlots: [
        { day: 'mon', period: 'afternoon' },
        { day: 'thu', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Preparando media maraton con tiradas por el Turia.',
      citySlug: 'valencia',
      distance: 'Media maraton',
      goals: 'Preparar carreras, Ser constante',
      level: 'Avanzado',
      pace: '5:20/km',
      username: 'candela_turia',
    },
  },
  {
    email: 'ruben.malvarrosa@example.test',
    id: 'seed-user-ruben-malvarrosa',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=ruben-malvarrosa',
    name: 'Ruben Peiro',
    profile: {
      area: 'Malvarrosa',
      availability: 'Martes noche y sabado manana',
      availabilitySlots: [
        { day: 'tue', period: 'evening' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Busca grupo para bloques de maraton y rodajes largos.',
      citySlug: 'valencia',
      distance: 'Maraton',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Competitivo',
      pace: '4:50/km',
      username: 'ruben_malvarrosa',
    },
  },
  {
    email: 'iria.alameda@example.test',
    id: 'seed-user-iria-alameda',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=iria-alameda',
    name: 'Iria Robles',
    profile: {
      area: 'Alameda',
      availability: 'Lunes y miercoles tarde',
      availabilitySlots: [
        { day: 'mon', period: 'afternoon' },
        { day: 'wed', period: 'afternoon' },
      ],
      bio: 'Empieza desde cero y quiere repetir sin presion.',
      citySlug: 'sevilla',
      distance: '5K',
      goals: 'Primer 10K, Ser constante, Conocer gente',
      level: 'Principiante',
      pace: '6:20/km',
      username: 'iria_alameda',
    },
  },
  {
    email: 'manu.triana@example.test',
    id: 'seed-user-manu-triana',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=manu-triana',
    name: 'Manu Torres',
    profile: {
      area: 'Triana',
      availability: 'Jueves tarde y domingo manana',
      availabilitySlots: [
        { day: 'thu', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Ritmo comodo, ganas de 10K y planes sociales.',
      citySlug: 'sevilla',
      distance: '10K',
      goals: 'Preparar carreras, Conocer gente',
      level: 'Intermedio',
      pace: '5:35/km',
      username: 'manu_triana',
    },
  },
  {
    email: 'ane.casco@example.test',
    id: 'seed-user-ane-casco',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=ane-casco',
    name: 'Ane Bilbao',
    profile: {
      area: 'Casco Viejo',
      availability: 'Martes tarde y sabado manana',
      availabilitySlots: [
        { day: 'tue', period: 'afternoon' },
        { day: 'sat', period: 'morning' },
      ],
      bio: 'Le gustan las cuestas, pero con grupo y ritmo sostenible.',
      citySlug: 'bilbao',
      distance: '15K',
      goals: 'Ser constante, Preparar carreras',
      level: 'Intermedio',
      pace: '5:50/km',
      username: 'ane_casco',
    },
  },
  {
    email: 'jon.deusto@example.test',
    id: 'seed-user-jon-deusto',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=jon-deusto',
    name: 'Jon Etxeberria',
    profile: {
      area: 'Deusto',
      availability: 'Miercoles noche y domingo manana',
      availabilitySlots: [
        { day: 'wed', period: 'evening' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Media maraton, tempo y sesiones con desnivel controlado.',
      citySlug: 'bilbao',
      distance: 'Media maraton',
      goals: 'Preparar carreras, Mejorar ritmo',
      level: 'Avanzado',
      pace: '4:55/km',
      username: 'jon_deusto',
    },
  },
  {
    email: 'sara.zurriola@example.test',
    id: 'seed-user-sara-zurriola',
    image: 'https://api.dicebear.com/9.x/thumbs/png?seed=sara-zurriola',
    name: 'Sara Elizalde',
    profile: {
      area: 'Gros',
      availability: 'Viernes tarde y domingo manana',
      availabilitySlots: [
        { day: 'fri', period: 'afternoon' },
        { day: 'sun', period: 'morning' },
      ],
      bio: 'Prepara 15K costeros y le encajan grupos de ritmo medio.',
      citySlug: 'donostia-san-sebastian',
      distance: '15K',
      goals: 'Preparar carreras, Conocer gente',
      level: 'Avanzado',
      pace: '5:15/km',
      username: 'sara_zurriola',
    },
  },
]

const seedCrews: SeedCrew[] = [
  {
    citySlug: 'madrid',
    description: 'Bloques de calidad para preparar una 10K urbana con ritmos medidos y cafe en Retiro.',
    name: 'Retiro 10K Lab',
    pace: '5:05/km',
    vibe: '10K race prep + social',
  },
  {
    citySlug: 'madrid',
    description: 'Tiradas progresivas por Canal, Oeste y Casa de Campo para medias sin ir solo.',
    name: 'Madrid Long Run Norte',
    pace: '5:30/km',
    vibe: 'steady long run',
  },
  {
    citySlug: 'barcelona',
    description: 'Rodajes de amanecer para preparar 10K y media maraton con salida desde la playa.',
    name: 'Barcelona Media Sunrise',
    pace: '5:50/km',
    vibe: 'easy mornings + half',
  },
  {
    citySlug: 'barcelona',
    description: 'Sesiones estructuradas con desnivel suave para bloques de maraton y media.',
    name: 'Montjuic Marathon Block',
    pace: '4:45/km',
    vibe: 'structured marathon',
  },
  {
    citySlug: 'valencia',
    description: 'Grupo de Ruzafa y Turia para media maraton, cambios de ritmo y constancia semanal.',
    name: 'Valencia Turia Race Prep',
    pace: '5:15/km',
    vibe: 'half marathon block',
  },
  {
    citySlug: 'valencia',
    description: 'Tiradas largas con estrategia de negative split para runners de maraton.',
    name: 'Valencia Marathon Negative Split',
    pace: '4:50/km',
    vibe: 'marathon pace',
  },
  {
    citySlug: 'sevilla',
    description: 'Crew amable para pasar de correr suelto a terminar 5K y 10K con compania.',
    name: 'Sevilla First 5K Club',
    pace: '6:15/km',
    vibe: 'low-pressure social',
  },
  {
    citySlug: 'bilbao',
    description: 'Cuestas, tempo y rodajes por la ria para preparar 15K y media maraton.',
    name: 'Bilbao Hills Tempo',
    pace: '5:05/km',
    vibe: 'tempo + hills',
  },
  {
    citySlug: 'donostia-san-sebastian',
    description: 'Rodajes costeros para 15K, media y carreras populares con final de pintxo.',
    name: 'Donostia Coastal 15K',
    pace: '5:20/km',
    vibe: 'coastal race prep',
  },
]

const seedMeetups: SeedMeetup[] = [
  {
    createdByUsername: 'marta_retiro',
    crewName: 'Retiro 10K Lab',
    daysFromNow: 1,
    distanceKm: 8,
    hour: 19,
    key: 'retiro-10k-block',
    location: 'Parque del Retiro, Puerta de Alcala',
    minute: 30,
    title: 'Bloque Carrera del Retiro 10K',
  },
  {
    createdByUsername: 'diego_canal',
    crewName: 'Madrid Long Run Norte',
    daysFromNow: 4,
    distanceKm: 16,
    hour: 8,
    key: 'casa-campo-long',
    location: 'Canal Isabel II a Casa de Campo',
    minute: 30,
    title: 'Tirada larga media maraton',
  },
  {
    createdByUsername: 'marta_retiro',
    crewName: 'Retiro 10K Lab',
    daysFromNow: 8,
    distanceKm: 10,
    hour: 19,
    key: 'retiro-10k-test',
    location: 'Parque del Retiro, Estanque',
    minute: 15,
    title: 'Test 10K ritmo objetivo',
  },
  {
    createdByUsername: 'laura_montjuic',
    crewName: 'Barcelona Media Sunrise',
    daysFromNow: 2,
    distanceKm: 7,
    hour: 7,
    key: 'barceloneta-10k',
    location: 'Passeig Maritim de la Barceloneta',
    minute: 0,
    title: 'Rodaje primer 10K Barceloneta',
  },
  {
    createdByUsername: 'nil_barceloneta',
    crewName: 'Montjuic Marathon Block',
    daysFromNow: 5,
    distanceKm: 18,
    hour: 8,
    key: 'montjuic-marathon',
    location: 'Font Magica de Montjuic',
    minute: 15,
    title: 'Tirada maraton con final progresivo',
  },
  {
    createdByUsername: 'laura_montjuic',
    crewName: 'Barcelona Media Sunrise',
    daysFromNow: 9,
    distanceKm: 12,
    hour: 7,
    key: 'diagonal-half',
    location: 'Avinguda Diagonal, Glories',
    minute: 15,
    title: 'Bloque suave media Barcelona',
  },
  {
    createdByUsername: 'candela_turia',
    crewName: 'Valencia Turia Race Prep',
    daysFromNow: 3,
    distanceKm: 12,
    hour: 18,
    key: 'turia-half-pace',
    location: 'Jardin del Turia, Puente de las Flores',
    minute: 45,
    title: 'Ritmo media por el Turia',
  },
  {
    createdByUsername: 'ruben_malvarrosa',
    crewName: 'Valencia Marathon Negative Split',
    daysFromNow: 6,
    distanceKm: 22,
    hour: 8,
    key: 'valencia-marathon-long',
    location: 'Ciudad de las Artes y las Ciencias',
    minute: 0,
    title: 'Tirada maraton negative split',
  },
  {
    createdByUsername: 'candela_turia',
    crewName: 'Valencia Turia Race Prep',
    daysFromNow: 10,
    distanceKm: 14,
    hour: 18,
    key: 'turia-14k',
    location: 'Jardin del Turia, Palau de la Musica',
    minute: 30,
    title: '14K controlados para media',
  },
  {
    createdByUsername: 'iria_alameda',
    crewName: 'Sevilla First 5K Club',
    daysFromNow: 1,
    distanceKm: 5,
    hour: 18,
    key: 'sevilla-first-5k',
    location: 'Alameda de Hercules',
    minute: 30,
    title: 'Primer 5K sin presion',
  },
  {
    createdByUsername: 'manu_triana',
    crewName: 'Sevilla First 5K Club',
    daysFromNow: 7,
    distanceKm: 9,
    hour: 9,
    key: 'sevilla-10k-build',
    location: 'Parque de Maria Luisa',
    minute: 0,
    title: 'Construccion 10K Maria Luisa',
  },
  {
    createdByUsername: 'jon_deusto',
    crewName: 'Bilbao Hills Tempo',
    daysFromNow: 2,
    distanceKm: 11,
    hour: 20,
    key: 'bilbao-hills-tempo',
    location: 'Campo Volantin a Artxanda',
    minute: 0,
    title: 'Tempo con cuestas Artxanda',
  },
  {
    createdByUsername: 'ane_casco',
    crewName: 'Bilbao Hills Tempo',
    daysFromNow: 6,
    distanceKm: 15,
    hour: 9,
    key: 'bilbao-15k-test',
    location: 'Museo Guggenheim',
    minute: 30,
    title: 'Test 15K por la ria',
  },
  {
    createdByUsername: 'sara_zurriola',
    crewName: 'Donostia Coastal 15K',
    daysFromNow: 4,
    distanceKm: 13,
    hour: 18,
    key: 'zurriola-15k',
    location: 'Playa de Zurriola',
    minute: 45,
    title: 'Progresivo costero 15K',
  },
  {
    createdByUsername: 'sara_zurriola',
    crewName: 'Donostia Coastal 15K',
    daysFromNow: 11,
    distanceKm: 18,
    hour: 9,
    key: 'donostia-half',
    location: 'La Concha a Ondarreta',
    minute: 0,
    title: 'Tirada larga media Donostia',
  },
]

const seedRsvps: { meetupKey: string; usernames: string[] }[] = [
  { meetupKey: 'retiro-10k-block', usernames: ['marta_retiro', 'diego_canal', 'pablo_chamberi'] },
  { meetupKey: 'casa-campo-long', usernames: ['diego_canal', 'marta_retiro', 'pablo_chamberi'] },
  { meetupKey: 'retiro-10k-test', usernames: ['marta_retiro', 'diego_canal'] },
  { meetupKey: 'barceloneta-10k', usernames: ['laura_montjuic', 'nil_barceloneta'] },
  { meetupKey: 'montjuic-marathon', usernames: ['nil_barceloneta', 'laura_montjuic'] },
  { meetupKey: 'diagonal-half', usernames: ['laura_montjuic', 'nil_barceloneta'] },
  { meetupKey: 'turia-half-pace', usernames: ['candela_turia', 'ruben_malvarrosa'] },
  { meetupKey: 'valencia-marathon-long', usernames: ['ruben_malvarrosa', 'candela_turia'] },
  { meetupKey: 'turia-14k', usernames: ['candela_turia', 'ruben_malvarrosa'] },
  { meetupKey: 'sevilla-first-5k', usernames: ['iria_alameda', 'manu_triana'] },
  { meetupKey: 'sevilla-10k-build', usernames: ['manu_triana', 'iria_alameda'] },
  { meetupKey: 'bilbao-hills-tempo', usernames: ['jon_deusto', 'ane_casco'] },
  { meetupKey: 'bilbao-15k-test', usernames: ['ane_casco', 'jon_deusto'] },
  { meetupKey: 'zurriola-15k', usernames: ['sara_zurriola'] },
  { meetupKey: 'donostia-half', usernames: ['sara_zurriola'] },
]

function buildFutureDate(daysFromNow: number, hour: number, minute: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, minute, 0, 0)

  return date
}

function requireMapValue<TKey, TValue>(map: Map<TKey, TValue>, key: TKey, label: string) {
  const value = map.get(key)

  if (!value) {
    throw new Error(`Missing ${label}: ${String(key)}`)
  }

  return value
}

async function main() {
  const seedUserIds = seedRunners.map((runner) => runner.id)
  const seedCrewNames = [...new Set([...legacySeedCrewNames, ...seedCrews.map((crew) => crew.name)])]

  await db.transaction(async (tx) => {
    const existingSeedCrews = await tx
      .select({ id: crews.id })
      .from(crews)
      .where(inArray(crews.name, seedCrewNames))
    const existingSeedCrewIds = existingSeedCrews.map((crew) => crew.id)

    await tx.delete(meetupRsvps).where(inArray(meetupRsvps.userId, seedUserIds))

    if (existingSeedCrewIds.length > 0) {
      const existingSeedMeetups = await tx
        .select({ id: meetups.id })
        .from(meetups)
        .where(inArray(meetups.crewId, existingSeedCrewIds))
      const existingSeedMeetupIds = existingSeedMeetups.map((meetup) => meetup.id)

      if (existingSeedMeetupIds.length > 0) {
        await tx.delete(meetupRsvps).where(inArray(meetupRsvps.meetupId, existingSeedMeetupIds))
      }

      await tx.delete(meetups).where(inArray(meetups.crewId, existingSeedCrewIds))
    }

    await tx.delete(crews).where(inArray(crews.name, seedCrewNames))
    await tx.delete(profiles).where(inArray(profiles.userId, seedUserIds))
    await tx.delete(authUsers).where(inArray(authUsers.id, seedUserIds))

    await tx.insert(authUsers).values(
      seedRunners.map((runner) => ({
        email: runner.email,
        emailVerified: true,
        id: runner.id,
        image: runner.image,
        name: runner.name,
      })),
    )

    await tx.insert(profiles).values(
      seedRunners.map((runner) => {
        const municipality = requireMunicipality(runner.profile.citySlug)

        return {
          ...runner.profile,
          ...locationProfileFields(municipality),
          notificationMeetups: runner.profile.notificationMeetups ?? true,
          notificationReminders: runner.profile.notificationReminders ?? true,
          publicProfile: runner.profile.publicProfile ?? true,
          showArea: runner.profile.showArea ?? true,
          showCity: runner.profile.showCity ?? true,
          userId: runner.id,
        }
      }),
    )

    const insertedCrews = await tx
      .insert(crews)
      .values(
        seedCrews.map((crew) => {
          const municipality = requireMunicipality(crew.citySlug)

          return {
            ...locationProfileFields(municipality),
            description: crew.description,
            name: crew.name,
            pace: crew.pace,
            vibe: crew.vibe,
          }
        }),
      )
      .returning({
        id: crews.id,
        name: crews.name,
      })
    const crewByName = new Map(insertedCrews.map((crew) => [crew.name, crew.id]))
    const userIdByUsername = new Map(seedRunners.map((runner) => [runner.profile.username, runner.id]))

    const insertedMeetups = await tx
      .insert(meetups)
      .values(
        seedMeetups.map((meetup) => {
          const seedCrew = seedCrews.find((crew) => crew.name === meetup.crewName)
          const municipality = seedCrew ? requireMunicipality(seedCrew.citySlug) : null

          return {
            crewId: requireMapValue(crewByName, meetup.crewName, 'seed crew'),
            createdByUserId: requireMapValue(userIdByUsername, meetup.createdByUsername, 'seed runner'),
            distanceKm: meetup.distanceKm,
            location: meetup.location,
            locationLat: municipality?.lat ?? null,
            locationLng: municipality?.lng ?? null,
            startsAt: buildFutureDate(meetup.daysFromNow, meetup.hour, meetup.minute),
            title: meetup.title,
          }
        }),
      )
      .returning({ id: meetups.id, title: meetups.title })

    const meetupIdByTitle = new Map(insertedMeetups.map((meetup) => [meetup.title, meetup.id]))
    const meetupIdByKey = new Map(
      seedMeetups.map((meetup) => [
        meetup.key,
        requireMapValue(meetupIdByTitle, meetup.title, 'inserted seed meetup'),
      ]),
    )
    const rsvpValues = seedRsvps.flatMap((plan) => {
      const meetupId = requireMapValue(meetupIdByKey, plan.meetupKey, 'seed meetup')

      return plan.usernames.map((username) => ({
        meetupId,
        userId: requireMapValue(userIdByUsername, username, 'seed RSVP runner'),
      }))
    })

    await tx.insert(meetupRsvps).values(rsvpValues).onConflictDoNothing()
  })

  const [userCount] = await db.select({ value: count() }).from(authUsers)
  const [profileCount] = await db.select({ value: count() }).from(profiles)
  const [crewCount] = await db.select({ value: count() }).from(crews)
  const [meetupCount] = await db.select({ value: count() }).from(meetups)
  const [rsvpCount] = await db.select({ value: count() }).from(meetupRsvps)

  console.log(
    [
      'Seed completed.',
      `users=${userCount?.value ?? 0}`,
      `profiles=${profileCount?.value ?? 0}`,
      `crews=${crewCount?.value ?? 0}`,
      `meetups=${meetupCount?.value ?? 0}`,
      `rsvps=${rsvpCount?.value ?? 0}`,
    ].join(' '),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
