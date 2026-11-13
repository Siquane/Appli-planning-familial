# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 13 novembre 2026.

## Contexte

- Application famille : planning, tâches récurrentes, livre de recettes, anniversaires, menu de la semaine, documents, budget.
- Stack : serveur Express + Prisma (Postgres) dans `server/`, application mobile Expo SDK 57 / React Native dans `mobile/`.
- Dépôt : `Siquane/Appli-planning-familial` (privé). Branche principale : `main`.
- Une session = une branche de travail `claude/...`, fusionnée dans `main` par pull request.

## Ce qui est fait (sur `main`, PR #1 fusionnée)

1. **Menu de la semaine** : terminé et testé. Ne pas le réécrire.
2. **Documents et pièces jointes**
   - Bibliothèque familiale (Profil → Documents) : catégories fixes (santé, assurance, école, administratif, maison, autre) + membre concerné, filtres.
   - Pièces jointes aux recettes (photo ou PDF). Pas de pièces jointes aux tâches.
   - Fichiers dans Cloudflare R2 (bucket privé `passerelle-documents`), la base ne garde que la clé. Liens signés : 10 min pour l'envoi, 1 h pour la lecture.
   - Envoi direct téléphone → R2 en 3 étapes (demande de lien, envoi, confirmation avec vérification de taille). Photos et PDF uniquement, 5 Mo max.
   - Supprimer une recette ou un document efface aussi le fichier.
3. **Budget** (Profil → Budget, réglages dans Budget → Réglages)
   - Dépenses saisies à la main : montant (en centimes), libellé, catégorie, date (jour calendaire), membre optionnel.
   - Catégories fixes (courses, logement, transport, santé, enfants, loisirs, factures, autre) + catégories personnalisées. Supprimer une catégorie range ses dépenses dans « Autre ».
   - Plafond mensuel par catégorie, défini une fois pour tous les mois, dépassement en rouge.
   - Dépenses récurrentes ajoutées au jour choisi (ramené au dernier jour des mois courts), générées à l'ouverture du mois, jamais en avance. Modifier/supprimer la copie d'un mois ne touche pas les autres mois.

## Mise en ligne (faite)

- **Base de données** : Neon (Europe, Frankfurt), adresse directe sans `-pooler`.
- **Serveur** : Render, dossier racine `server`, offre gratuite (mise en veille, premier appel lent). Adresse : `https://appli-planning-familial-0lyd.onrender.com` (`/health` répond `{"ok":true}`). C'est cette adresse qui est dans `mobile/eas.json`.
- **R2** : configuré (5 variables `S3_*` dans Render).
- **E-mails** : mot de passe oublié par code à 6 chiffres, envoyé via Brevo (ajouté par une autre session, voir `server/src/services/mailer.ts`).
- **Appli mobile** : Android uniquement. Compilation via GitHub Actions « EAS Build (Android preview) » (bouton Run workflow, Node 22), secret `EXPO_TOKEN` ajouté. L'APK s'installe depuis le lien expo.dev affiché à la fin du workflow.

## Synchronisation d'agenda Google / Outlook : pas activée

- Le serveur sait synchroniser les tâches avec Google Agenda et Outlook, mais **aucun identifiant OAuth n'est configuré dans Render** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`).
- Conséquence : dans Profil → Synchronisation calendrier, Google et Outlook affichent « Pas encore activé sur le serveur » et un bouton « Bientôt » (avant, « Connecter » ouvrait une page d'erreur brute). Apple Calendar fonctionne (passe par le téléphone).
- Décision du 10/11/2026 : ne pas les activer pour l'instant. Pour le faire plus tard : créer une application dans le portail Azure (Outlook) ou Google Cloud (Google Agenda), avec l'adresse de retour `https://appli-planning-familial-0lyd.onrender.com/calendar/microsoft/callback` (ou `/calendar/google/callback`), puis ajouter les 3 variables correspondantes dans Render. Environ 15 min chacun.

## Ajouts récents (branche, PR #4)

- Rappel : une ligne dédiée (cloche + interrupteur) au lieu d'une puce confondue avec les catégories.
- Catégorie, jours, durée, priorité, échéance : toutes les puces sur une seule ligne (`Chip` avec `fill`). « 1.5h » → « 1h30 ».
- Plusieurs jours cochés : interrupteur « Heure différente selon le jour » (`ScheduleTimes`, `lib/dayTimes.ts`), une tâche par jour avec sa propre heure.
- Fiche d'une tâche : icône « Dupliquer » en haut, qui ouvre le formulaire de création prérempli.

## Optimisations (12/11/2026)

- **Cache sur le téléphone** : les données (sauf documents) sont gardées 7 jours dans AsyncStorage et s'affichent tout de suite au lancement ; effacées à la déconnexion (`mobile/src/lib/queryClient.ts`).
- **Serveur éveillé** : pas via GitHub Actions (dépôt privé = 2 000 min/mois, un ping toutes les 10 min en consommerait plus de 4 000). À faire avec un service externe gratuit (cron-job.org) qui appelle `/health` toutes les 10 minutes.
- **Tests automatiques** : workflow `.github/workflows/tests.yml` sur chaque pull request et sur `main` (serveur avec Postgres, vérification des migrations, mobile).
- **Limites de tentatives** : connexion et code de réinitialisation 10 / 15 min par e-mail et IP ; inscription et demande de code 10 / heure par IP (`server/src/middleware/rateLimits.ts`). Les tests les désactivent via `DISABLE_RATE_LIMIT=1`.
- **Bouton « + »** : menu d'ajout rapide (tâche, dépense, document, recette, repas).
- **Notifications** : récap du soir à 20 h (tâches du lendemain, interrupteur dans l'onglet Notifications) ; message quand une dépense fait dépasser un plafond ; la synchro des rappels de tâches n'annule plus les rappels d'anniversaire.

## Navigation : les 4 piliers (12/11/2026)

- Barre du bas = les 4 anneaux du logo Passerelle, de gauche à droite : **Planning** (cyan), **Repas** (bleu clair), **Budget** (lavande), **Famille** (violet), avec le « + » d'ajout rapide au milieu. Couleurs dans `theme/tokens.ts` (`pillar1`…`pillar4`).
- Repas = menu de la semaine + recettes (sélecteur en haut ; contenus dans `src/screens/MealsBody.tsx` et `RecipesBody.tsx`, réutilisés par `/meals` et `/recipes`).
- Famille = membres, documents, anniversaires, partage.
- Recherche (`/search`), notifications (`/inbox`, pour ne pas entrer en conflit avec l'écran d'accueil `(onboarding)/notifications`) et profil (`/profile`) ne sont plus des onglets : icônes en haut de chaque onglet (`TabHeader` dans `components/PageHeader.tsx`).

## Mises à jour de l'appli sans nouvel APK (EAS Update, 13/11/2026)

- `expo-updates` installé, canal `preview`, `runtimeVersion: "1"` dans `mobile/app.json`.
- Workflow `.github/workflows/eas-update.yml` : à chaque fusion dans `main` qui touche `mobile/`, publie une mise à jour ; l'appli la télécharge et l'applique au démarrage (`src/lib/updates.ts`). Aussi lançable à la main (« Run workflow »).
- **Règle à respecter** : si un changement ajoute ou modifie un module natif, une permission ou `app.json` côté natif, augmenter `runtimeVersion` ("1" → "2") et compiler un nouvel APK. Garde-fou : si `package.json` ou `app.json` changent sans nouveau `runtimeVersion`, le workflow ne publie rien (avertissement).
- L'URL de mise à jour (`https://u.expo.dev/<projectId>`) est ajoutée en CI par `mobile/scripts/configure-updates.js`, après `eas init` (build et update).
- Il faut **un dernier APK** compilé après la fusion de cette fonctionnalité pour l'activer sur les téléphones.

## Améliorations sans nouvel APK (13/11/2026)

- **Liste de courses** (Repas → Courses) : ajout à la main, « Générer depuis le menu de la semaine » (ingrédients des recettes du menu, sans doublons), cases à cocher, « Vider » le panier. Serveur : modèle `ShoppingItem`, routes `/shopping`.
- **Import de recette depuis un lien** (Nouvelle recette → Importer) : le serveur lit les données schema.org Recipe de la page (`server/src/lib/recipeImport.ts`), refuse les adresses privées, 8 s et 3 Mo max ; rien n'est enregistré avant validation du formulaire.
- **Recherche globale** (`/search`) : tâches, recettes et ingrédients, documents, dépenses du mois, liste de courses, sans tenir compte des accents (`src/lib/search.ts`).
- **Carte « Aujourd'hui »** en haut du Planning : prochaine tâche, dîner du soir, reste sur les plafonds du mois (`src/lib/today.ts`).
- **Export du budget** : Budget → « Exporter le mois (tableur) », CSV pour Excel en français, envoyé par le menu de partage du téléphone.
- **Sauvegarde hebdomadaire** : workflow `.github/workflows/backup.yml`, chaque dimanche vers 4 h, `pg_dump` compressé dans R2 sous `backups/`, 8 dernières gardées. Il faut 5 secrets GitHub (Settings → Secrets and variables → Actions) : `BACKUP_DATABASE_URL` (même valeur que `DATABASE_URL` dans Render), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (mêmes valeurs que dans Render). Sans eux, le workflow ne fait rien et reste vert. Restaurer : télécharger le fichier depuis R2, puis `gunzip -c fichier.sql.gz | psql "<adresse Neon>"`.

## Prochain lot (natif, nouvel APK, `runtimeVersion` "2")

Expo SDK 58, widget Android, alertes de bug Sentry (compte sentry.io gratuit + clé DSN à fournir). Puis, à part : mises à jour majeures du serveur.

## Idées notées pour plus tard

Comptes séparés pour chaque membre de la famille, synchronisation Google Agenda, statistiques du budget sur 12 mois, étoiles pour les tâches des enfants, idées cadeaux d'anniversaire, liste de courses en temps réel, thème clair, version iPhone (99 €/an).

## Mises à jour majeures à prévoir plus tard (non faites, demandent du code)

- Serveur : Prisma 5 → 7, Express 4 → 5, zod 3 → 4, vitest 2 → 5, TypeScript 5 → 7, googleapis, msal-node.
- Mobile : Expo SDK 57 → 58 (entraîne react-native, expo-* et outils de test).
- À noter : plusieurs bibliothèques natives mobiles sont déjà plus récentes que la liste officielle d'Expo SDK 57 (async-storage 3, gesture-handler 3, reanimated 4.5.3, screens 4.27, safe-area-context 5.8, svg 15.15.5, worklets 0.11). Si la compilation Android échoue sur l'une d'elles, c'est la première piste.

## Préférences de l'utilisateur

- Travaille en français.
- Poser des questions de clarification avant les réponses détaillées, avec des choix cliquables.
- Ne pas multiplier les étapes manuelles : préférer un commit unique, une PR prête à fusionner.
- Ne pas uploader de fichiers directement sur `main` pendant qu'une PR est ouverte (cela a créé un conflit une fois).

## Conventions du dépôt

- Routes : `server/src/routes/`, migrations Prisma : `server/prisma/migrations/` (générées et vérifiées avec `prisma migrate diff`).
- Mobile : hooks dans `mobile/src/hooks/useApi.ts`, API dans `mobile/src/api/resources.ts`, types dans `mobile/src/api/types.ts`.
- Avant de livrer : `npm run typecheck` et `npm test` dans `server/` (Postgres local requis, base `passerelle_test`) et dans `mobile/` (`npx jest`), plus `npx expo export --platform android` pour vérifier que l'appli se compile.
- Expo : lire la doc versionnée v57 (voir `mobile/AGENTS.md`).
