import { randomUUID } from 'node:crypto'

import { and, eq, inArray } from 'drizzle-orm'

import { db, notificationDeliveries, userPushDevices } from '@apprunners/db'

type NotificationPayload = {
  body: string
  data?: Record<string, string | number | boolean | null>
  notificationType: string
  title: string
  userIds: string[]
}

type ExpoPushMessage = {
  body: string
  channelId?: string
  data?: Record<string, string | number | boolean | null>
  sound?: 'default'
  title: string
  to: string
}

function chunkMessages<TValue>(items: TValue[], size: number) {
  const chunks: TValue[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isMissingPushTablesError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof (error as { cause?: { code?: unknown } }).cause?.code === 'string' &&
    (error as { cause?: { code?: string } }).cause?.code === '42P01'
  )
}

export async function sendPushNotificationToUsers(payload: NotificationPayload) {
  try {
    const targetUserIds = Array.from(new Set(payload.userIds.filter(Boolean)))

    if (targetUserIds.length === 0) {
      return
    }

    const devices = await db
      .select({
        id: userPushDevices.id,
        expoPushToken: userPushDevices.expoPushToken,
        userId: userPushDevices.userId,
      })
      .from(userPushDevices)
      .where(
        and(
          inArray(userPushDevices.userId, targetUserIds),
          eq(userPushDevices.isActive, true),
        ),
      )

    if (devices.length === 0) {
      return
    }

    const deliveryIdsByToken = new Map<string, string>()

    await db.insert(notificationDeliveries).values(
      devices.map((device) => {
        const deliveryId = randomUUID()
        deliveryIdsByToken.set(device.expoPushToken, deliveryId)

        return {
          id: deliveryId,
          userId: device.userId,
          pushDeviceId: device.id,
          notificationType: payload.notificationType,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }),
    )

    const messages: ExpoPushMessage[] = devices.map((device) => ({
      to: device.expoPushToken,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      channelId: 'default',
    }))

    for (const chunk of chunkMessages(messages, 100)) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      })

      const rawBody = await response.text()
      let parsedBody: unknown = null

      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        parsedBody = rawBody
      }

      if (!response.ok) {
        await Promise.all(
          chunk.map((message) =>
            db
              .update(notificationDeliveries)
              .set({
                status: 'failed' as const,
                errorMessage: `Expo push error ${response.status}`,
                providerResponse: typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody),
                updatedAt: new Date(),
              })
              .where(eq(notificationDeliveries.id, deliveryIdsByToken.get(message.to) ?? '')),
          ),
        )

        continue
      }

      const ticketRows = Array.isArray((parsedBody as { data?: unknown[] } | null)?.data)
        ? (((parsedBody as { data: Array<Record<string, unknown>> }).data) ?? [])
        : []

      await Promise.all(
        chunk.map((message, index) => {
          const ticket = ticketRows[index] ?? {}
          const deliveryId = deliveryIdsByToken.get(message.to)

          if (!deliveryId) {
            return Promise.resolve()
          }

          const status = ticket.status === 'ok' ? ('sent' as const) : ('failed' as const)
          const errorMessage =
            typeof ticket.message === 'string'
              ? ticket.message
              : typeof ticket.details === 'string'
                ? ticket.details
                : null

          return db
            .update(notificationDeliveries)
            .set({
              status,
              sentAt: status === 'sent' ? new Date() : null,
              providerTicketId: typeof ticket.id === 'string' ? ticket.id : null,
              providerResponse: JSON.stringify(ticket),
              errorMessage,
              updatedAt: new Date(),
            })
            .where(eq(notificationDeliveries.id, deliveryId))
        }),
      )
    }
  } catch (error) {
    if (isMissingPushTablesError(error)) {
      console.log('[push] skipped because push tables are not migrated yet')
      return
    }

    throw error
  }
}
