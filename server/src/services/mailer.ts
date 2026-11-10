import { env, isMailConfigured } from "../env";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export interface Mail {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  html: string;
}

// Swappable so tests can capture outgoing mail instead of calling Brevo.
type Transport = (mail: Mail) => Promise<void>;

async function brevoTransport(mail: Mail): Promise<void> {
  if (!isMailConfigured()) {
    // No Brevo key: in development, print the mail so the flow is still testable.
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mailer] BREVO_API_KEY absent — mail non envoyé à ${mail.to.email} :\n${mail.text}`);
      return;
    }
    throw new Error("E-mail non configuré (BREVO_API_KEY / MAIL_FROM_EMAIL manquants)");
  }

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": env.brevo.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: env.brevo.senderEmail, name: env.brevo.senderName },
      to: [mail.to],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo a refusé l'envoi (${res.status}) ${detail}`);
  }
}

let transport: Transport = brevoTransport;

export function setMailTransport(t: Transport | null) {
  transport = t ?? brevoTransport;
}

export function sendMail(mail: Mail) {
  return transport(mail);
}

export function sendPasswordResetCode(to: { email: string; name: string }, code: string, validMinutes: number) {
  const text =
    `Bonjour ${to.name},\n\n` +
    `Voici ton code pour réinitialiser ton mot de passe Passerelle : ${code}\n\n` +
    `Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.`;
  const html =
    `<p>Bonjour ${escapeHtml(to.name)},</p>` +
    `<p>Voici ton code pour réinitialiser ton mot de passe Passerelle :</p>` +
    `<p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${code}</p>` +
    `<p>Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.</p>`;
  return sendMail({ to, subject: `${code} — ton code Passerelle`, text, html });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
