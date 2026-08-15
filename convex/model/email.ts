import { fail } from "./errors";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailErrorCode = "SEND_EMAIL_FAILED";

export async function sendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!response.ok) {
    fail<SendEmailErrorCode>("SEND_EMAIL_FAILED", "No se pudo enviar el email.");
  }
}
