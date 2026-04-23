import { env } from './env.js'

type EmailMessage = {
  html?: string
  subject: string
  text: string
  to: string
}

export async function sendTransactionalEmail(message: EmailMessage) {
  if (env.resendApiKey && env.emailFrom) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()

      throw new Error(`Resend error ${response.status}: ${body}`)
    }

    return
  }

  console.log('[email:fallback]', JSON.stringify(message))
}
