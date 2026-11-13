# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 12 novembre 2026.

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

## Idées notées pour plus tard

Comptes séparés pour chaque membre de la famille, sauvegarde hebdomadaire de la base vers R2, liste de courses générée depuis le menu, synchronisation Google Agenda, widget Android, export CSV du budget.

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
