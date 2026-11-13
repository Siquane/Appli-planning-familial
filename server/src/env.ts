import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
    redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? "",
  },
  // Object storage for documents and recipe attachments. Cloudflare R2 is
  // S3-compatible: endpoint https://<account-id>.r2.cloudflarestorage.com,
  // region "auto". Leave empty to disable uploads (routes answer 503).
  storage: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  // Transactional e-mail (password reset codes) via Brevo's HTTP API.
  brevo: {
    apiKey: process.env.BREVO_API_KEY ?? "",
    senderEmail: process.env.MAIL_FROM_EMAIL ?? "",
    senderName: process.env.MAIL_FROM_NAME ?? "Passerelle",
  },
  // Weekly menu suggestions (POST /meals/generate) call the Claude API.
  // Leave empty to disable the feature (route answers 503).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // In-app purchases through RevenueCat. secretKey: project secret API key
  // (sk_…) to read a customer's entitlements; webhookAuth: the value set as
  // « Authorization header » on the RevenueCat webhook. Empty = disabled.
  revenuecat: {
    secretKey: process.env.REVENUECAT_SECRET_KEY ?? "",
    webhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH ?? "",
  },
  appDeepLink: process.env.APP_DEEP_LINK ?? "passerelle://calendar-connected",
};

export const isGoogleConfigured = () => !!(env.google.clientId && env.google.clientSecret && env.google.redirectUri);
export const isMicrosoftConfigured = () => !!(env.microsoft.clientId && env.microsoft.clientSecret && env.microsoft.redirectUri);
export const isStorageConfigured = () =>
  !!(env.storage.bucket && env.storage.accessKeyId && env.storage.secretAccessKey);
export const isMailConfigured = () => !!(env.brevo.apiKey && env.brevo.senderEmail);
export const isMealAiConfigured = () => !!env.anthropicApiKey;
export const isBillingConfigured = () => !!env.revenuecat.secretKey;
