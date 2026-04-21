import { count } from 'drizzle-orm'

import { db } from './client.js'
import { crews, meetups } from './schema/index.js'

function buildFutureDate(daysFromNow: number, hour: number, minute: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, minute, 0, 0)

  return date
}

async function main() {
  const [existingCrews] = await db.select({ value: count() }).from(crews)

  if ((existingCrews?.value ?? 0) === 0) {
    await db.insert(crews).values([
      {
        name: 'Retiro Tempo Crew',
        city: 'Madrid',
        pace: '5:15/km',
        vibe: 'steady + social',
        description: 'Mid-week tempo sessions and easy post-run coffee in Retiro.',
      },
      {
        name: 'Barcelona Sunrise Run',
        city: 'Barcelona',
        pace: '6:00/km',
        vibe: 'easy mornings',
        description: 'Low-pressure weekday sunrise group with a consistent local core.',
      },
      {
        name: 'Valencia Race Prep',
        city: 'Valencia',
        pace: '4:45/km',
        vibe: 'half marathon block',
        description: 'Structured group for runners building toward spring and autumn races.',
      },
    ])
  }

  const [existingMeetups] = await db.select({ value: count() }).from(meetups)

  if ((existingMeetups?.value ?? 0) === 0) {
    const crewRows = await db.select().from(crews)
    const crewByName = new Map(crewRows.map((crew) => [crew.name, crew]))

    await db.insert(meetups).values([
      {
        crewId: crewByName.get('Retiro Tempo Crew')!.id,
        createdByUserId: 'seed',
        title: 'Thursday shakeout',
        location: 'Parque del Retiro',
        distanceKm: 6,
        startsAt: buildFutureDate(1, 19, 30),
      },
      {
        crewId: crewByName.get('Retiro Tempo Crew')!.id,
        createdByUserId: 'seed',
        title: 'Sunday long run',
        location: 'Atocha to Casa de Campo',
        distanceKm: 14,
        startsAt: buildFutureDate(4, 8, 30),
      },
      {
        crewId: crewByName.get('Barcelona Sunrise Run')!.id,
        createdByUserId: 'seed',
        title: 'Beachfront sunrise',
        location: 'Barceloneta promenade',
        distanceKm: 8,
        startsAt: buildFutureDate(2, 7, 0),
      },
      {
        crewId: crewByName.get('Valencia Race Prep')!.id,
        createdByUserId: 'seed',
        title: 'Race pace block',
        location: 'Jardín del Turia',
        distanceKm: 12,
        startsAt: buildFutureDate(3, 18, 45),
      },
    ])
  }

  console.log('Seed completed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    process.exit()
  })
