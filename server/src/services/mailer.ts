import { env, isMailConfigured } from "../env";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/** L'appli d'où vient la demande : nom de l'expéditeur et texte des e-mails. */
export type AppName = "passerelle" | "cervelle";
const BRAND: Record<AppName, string> = { passerelle: "Passerelle", cervelle: "Cervelle" };

export interface Mail {
  to: { email: string; name?: string };
  /** Nom affiché de l'expéditeur ; par défaut MAIL_FROM_NAME. */
  senderName?: string;
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
      sender: { email: env.brevo.senderEmail, name: mail.senderName ?? env.brevo.senderName },
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

export function sendPasswordResetCode(to: { email: string; name: string }, code: string, validMinutes: number, app: AppName = "passerelle") {
  const brand = BRAND[app];
  const text =
    `Bonjour ${to.name},\n\n` +
    `Voici ton code pour réinitialiser ton mot de passe ${brand} : ${code}\n\n` +
    `Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.`;
  const html =
    `<p>Bonjour ${escapeHtml(to.name)},</p>` +
    `<p>Voici ton code pour réinitialiser ton mot de passe ${brand} :</p>` +
    `<p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${code}</p>` +
    `<p>Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.</p>`;
  return sendMail({ to, senderName: app === "passerelle" ? undefined : brand, subject: `${code} — ton code ${brand}`, text, html });
}

/** Code de connexion sans mot de passe (ou de création de compte si l'adresse est nouvelle). */
export function sendLoginCode(to: { email: string; name?: string }, code: string, validMinutes: number, app: AppName = "cervelle") {
  const brand = BRAND[app];
  const hello = to.name ? `Bonjour ${to.name},` : "Bonjour,";
  const text =
    `${hello}\n\n` +
    `Voici ton code pour te connecter à ${brand} : ${code}\n\n` +
    `Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.`;
  const html =
    `<p>${escapeHtml(hello)}</p>` +
    `<p>Voici ton code pour te connecter à ${brand} :</p>` +
    `<p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${code}</p>` +
    `<p>Il est valable ${validMinutes} minutes. Si tu n'as rien demandé, ignore simplement cet e-mail.</p>`;
  return sendMail({ to, senderName: app === "passerelle" ? undefined : brand, subject: `${code} — ton code ${brand}`, text, html });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
