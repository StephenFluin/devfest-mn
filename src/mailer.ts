import { environment } from './environments/environment';

export interface Email {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/**
 * Sends email from the server. To switch providers, add another implementation and pick it in
 * createMailer() (or with MAIL_PROVIDER); nothing else depends on the provider.
 */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** https://resend.com/docs/api-reference/emails/send-email */
class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send({ to, subject, text, replyTo }: Email) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text, reply_to: replyTo }),
    });
    if (!response.ok) {
      throw new Error(`Resend responded with ${response.status}: ${await response.text()}`);
    }
  }
}

/** For local development without an API key: prints the email instead of sending it. */
class ConsoleMailer implements Mailer {
  async send(email: Email) {
    console.log('Email not sent (MAIL_PROVIDER=console):', email);
  }
}

/**
 * Configured by environment variables (or .env in development): MAIL_PROVIDER (resend or console),
 * RESEND_API_KEY, and MAIL_FROM, which must be on a domain verified in Resend. MAIL_PROVIDER
 * defaults to resend in production (K_SERVICE is set on Cloud Run) or when there's an API key, so
 * a missing key in production is an error rather than silently unsent mail.
 */
export function createMailer(): Mailer {
  if (!process.env['RESEND_API_KEY'] && !process.env['MAIL_PROVIDER']) {
    try {
      process.loadEnvFile();
    } catch {
      // No .env file; the provider check below reports what's missing.
    }
  }
  const apiKey = process.env['RESEND_API_KEY'];
  const provider =
    process.env['MAIL_PROVIDER'] ?? (apiKey || process.env['K_SERVICE'] ? 'resend' : 'console');
  switch (provider) {
    case 'resend':
      if (!apiKey) {
        throw new Error('RESEND_API_KEY is not configured');
      }
      return new ResendMailer(
        apiKey,
        process.env['MAIL_FROM'] ?? `${environment.siteName} <${environment.contactEmail}>`,
      );
    case 'console':
      return new ConsoleMailer();
    default:
      throw new Error(`Unknown MAIL_PROVIDER ${provider}`);
  }
}
