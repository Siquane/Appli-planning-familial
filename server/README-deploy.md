# Déployer l'API Passerelle (gratuit)

Le serveur utilise maintenant Postgres (voir `prisma/schema.prisma`) au lieu de SQLite — un vrai `DATABASE_URL` Postgres est donc nécessaire, en local comme en prod.

## En local (dev)

Il faut un Postgres qui tourne quelque part. Le plus simple avec `psql` déjà installé :

```bash
sudo -u postgres psql -c "CREATE ROLE passerelle WITH LOGIN PASSWORD 'passerelle' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE passerelle_dev OWNER passerelle;"
```

`.env` pointe déjà sur `postgresql://passerelle:passerelle@localhost:5432/passerelle_dev`. Puis :

```bash
npm run prisma:migrate   # applique prisma/migrations/ à passerelle_dev
npm run dev
```

Les tests (`npm test`) utilisent une base séparée `passerelle_test` (voir `tests/testDbUrl.ts`) qu'ils réinitialisent à chaque run — créer cette base une fois de la même façon (`CREATE DATABASE passerelle_test OWNER passerelle;`).

## En production (Render + Neon, gratuit, sans carte bancaire)

**1. Base de données — [neon.tech](https://neon.tech)**
Créer un compte, un projet, copier la connection string Postgres fournie (garder le `?sslmode=require` si présent).

**2. API — [render.com](https://render.com)**
- New → Web Service → connecter le repo, root directory `server`.
- Build command : `npm install && npm run build`
- Start command : `npm start` (lance `prisma migrate deploy` puis le serveur — les migrations en attente sont appliquées à chaque déploiement, voir `package.json`)
- Variables d'environnement à définir dans le dashboard Render :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | la connection string Neon |
| `JWT_ACCESS_SECRET` | générée avec `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | générée avec `openssl rand -hex 32` (différente de la précédente) |
| `APP_DEEP_LINK` | `passerelle://calendar-connected` |
| `GOOGLE_REDIRECT_URI` | `https://<ton-service>.onrender.com/calendar/google/callback` (optionnel — laisser vide désactive proprement la sync Google, voir `src/routes/calendar.ts`) |
| `MICROSOFT_REDIRECT_URI` | `https://<ton-service>.onrender.com/calendar/microsoft/callback` (optionnel, idem pour Outlook) |
| `BREVO_API_KEY` | clé API Brevo (brevo.com → SMTP & API → Clés API) — sert à envoyer les codes « Mot de passe oublié » |
| `MAIL_FROM_EMAIL` | l'adresse expéditeur, **validée dans Brevo** (Expéditeurs) |
| `MAIL_FROM_NAME` | optionnel, nom affiché de l'expéditeur (défaut : `Passerelle`) |

**Menus de la semaine générés par IA — [Claude](https://console.anthropic.com) (optionnel)**

Le bouton « Générer mes menus » de l'écran Repas pose quelques questions puis demande des propositions à Claude. Sans clé, l'appli fonctionne mais ce bouton répond « génération non configurée » (503).

| Variable | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | clé API créée sur console.anthropic.com → *API Keys* (chaque génération est facturée à l'usage, quelques centimes) |

**Activer un pack Premium à la main (en attendant le paiement dans l'appli)**

Depuis le dossier `server`, avec la connection string Neon de production :

```bash
DATABASE_URL="<connection string Neon>" npm run premium -- toi@exemple.fr budget 2027-12-31   # pack Budget jusqu'à cette date incluse
DATABASE_URL="<connection string Neon>" npm run premium -- toi@exemple.fr menus 2027-12-31    # pack Menus
DATABASE_URL="<connection string Neon>" npm run premium -- toi@exemple.fr tout 2027-12-31     # les 2
DATABASE_URL="<connection string Neon>" npm run premium -- toi@exemple.fr tout off            # tout retirer
```

Gratuit : 20 documents ; menus générés : 4 semaines le premier mois puis 1 par mois (15 « autre idée » par semaine générée).
Pack Budget : objectifs d'épargne, alertes de plafond, bilan, prévision de fin de mois, export CSV/PDF.
Pack Menus : 12 semaines et 60 « autre idée » par mois.
Les deux packs donnent les documents illimités. Ces valeurs sont dans `src/lib/plan.ts`.

**Abonnements Android (RevenueCat, optionnel)**

Toute la mise en place (Play Console, RevenueCat, clés, test) est décrite dans [`docs/achats-android.md`](../docs/achats-android.md). Côté Render :

| Variable | Valeur |
|---|---|
| `REVENUECAT_SECRET_KEY` | clé secrète RevenueCat (`sk_…`) |
| `REVENUECAT_WEBHOOK_AUTH` | la valeur exacte mise en « Authorization header » du webhook RevenueCat (ex. `Bearer 3f9…`) |

Ne pas laisser `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` vides : `src/env.ts` retombe sinon sur des valeurs de dev codées en dur.

**Stockage des documents — [Cloudflare R2](https://dash.cloudflare.com) (optionnel)**

Les pièces jointes des recettes et la bibliothèque de documents stockent les fichiers dans R2 ; la base ne garde que la clé du fichier. Sans ces variables, l'appli fonctionne mais l'envoi de documents répond « stockage non configuré » (503).

1. R2 → *Create bucket* (ex. `passerelle-documents`). Laisser le bucket **privé** : l'API génère des liens signés temporaires (10 min pour envoyer, 1 h pour consulter).
2. R2 → *Manage R2 API Tokens* → *Create API token*, permission *Object Read & Write* limitée à ce bucket. Noter l'Access Key ID et le Secret.
3. Ajouter dans Render :

| Variable | Valeur |
|---|---|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` (l'account ID est affiché sur la page R2) |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `passerelle-documents` |
| `S3_ACCESS_KEY_ID` | l'Access Key ID du jeton |
| `S3_SECRET_ACCESS_KEY` | le Secret du jeton |

Pour Amazon S3 à la place : laisser `S3_ENDPOINT` vide et mettre la vraie région (ex. `eu-west-3`).

Limites appliquées par l'API : photos (JPEG, PNG, WebP, HEIC) et PDF, 5 Mo maximum par fichier. Supprimer une recette ou un document efface aussi le fichier dans le bucket.

**3. Vérifier**

```bash
curl https://<ton-service>.onrender.com/health   # -> {"ok":true}
```

Le plan gratuit Render met le service en veille après une période d'inactivité — le premier appel après une pause prend ~30-50s le temps qu'il redémarre, c'est normal.

## Côté app mobile

Voir `mobile/.env.local` (à créer, ignoré par git) : `EXPO_PUBLIC_API_URL=https://<ton-service>.onrender.com`.
