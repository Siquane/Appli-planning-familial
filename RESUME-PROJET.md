# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 26 novembre 2026.

## État au 26/11/2026 — à lire d'abord (complète la section suivante)

- **Dépôt public** depuis le 24/11 (GitHub Actions gratuit, les mises à jour EAS
  partent à chaque fusion). Avant de le rendre public : historique vérifié, aucun
  secret ; seule la clé Firebase client de `google-services.json` (publique par nature).
- **Secrets JWT** : en production (`RENDER` ou `NODE_ENV=production`), le serveur
  refuse de démarrer sans `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32 caractères
  et plus) — `server/src/env.ts`.
- **Fusion** : l'utilisatrice a dit « fusionne tout sans me demander » : fusionner dès
  que les vérifications sont vertes (serveur avant l'appli Cervelle). Toujours poser
  des questions à choix cliquables avant une nouveauté. L'API GitHub renvoie parfois
  500/502 sur la fusion : réessayer avec `commit_title` explicite, puis vérifier `main`.
- **Livré du 24 au 26/11** :
  - Comptes partagés (« Comptes », ex-Budget, façon Tricount) : groupes, 4 modes de
    partage, virements minimaux, lien web par personne (`/s/<jeton>`), avances aux
    enfants remboursées avec leur cagnotte.
  - Tâches dans le Planning (« Toutes les tâches »), bouton du bas au-dessus du clavier.
  - **Sorties & idées** (Planning) : météo Open-Meteo + 5 idées de Claude
    (`routes/outings.ts`, `services/outings.ts`, `User.outingCity`), « Ajouter au
    planning » crée un rendez-vous Loisirs. 15 demandes/famille/24 h.
  - **Routines du matin et du soir** (Famille > Routines) : le parent règle les
    étapes, l'enfant coche dans Cervelle (`routes/cervelleRoutines.ts`).
  - **Quiz « Apprends-le à papa/maman »** : carte sur le Planning et écran
    `/cervelle-quiz/<id>` (`routes/cervelleTeach.ts`, `TeachQuiz`).
  - Transitions (`mobile/src/components/motion.tsx`) : pastille du jour qui glisse,
    journée qui glisse, tâches en cascade, onglet qui saute.
  - Côté Cervelle (serveur ici) : calendrier de l'Avent, carte au trésor, album de
    cartes, boss de fin de chapitre, décors à 300/500 pièces, 30 dernières séances.
    Détail dans `RESUME-PROJET.md` du dépôt `Siquane/Cervelle`.
- **Tests serveur en local** : `service postgresql start`, puis vitest avec
  `DATABASE_URL=postgresql://passerelle:passerelle@localhost:5432/passerelle_test`
  (`npx prisma migrate deploy` avant). Migrations : générer avec
  `prisma migrate diff`, ne garder que les lignes de sa propre modification.


## État actuel (19/11/2026) — à lire d'abord

- **Appli** : `runtimeVersion` **"8"**. APK à installer : https://github.com/Siquane/Appli-planning-familial/releases/download/apk-4/passerelle.apk (compilé sur GitHub le 18/11, arm64). Tout ce qui a suivi arrive par **EAS Update** (fermer puis rouvrir l'appli). Ne jamais redescendre `runtimeVersion`.
- **Nouvel APK** : workflow « APK sur GitHub (sans quota Expo) » (`.github/workflows/apk-github.yml`, ~30 min, release `apk-<n°>`). Le workflow EAS cloud (`eas-build.yml`) dépend du quota gratuit Expo (épuisé en novembre, revient chaque 1er du mois).
- **Garde EAS Update** : si `mobile/package.json` ou `app.json` changent sans nouveau `runtimeVersion`, le push n'est pas publié (avertissement) ; le push suivant publiera tout le JS. Un changement natif = nouveau `runtimeVersion` + nouvel APK.
- **Serveur** : Render (`https://appli-planning-familial-0lyd.onrender.com`), déployé à chaque fusion sur `main` (migrations Prisma au déploiement). Base Neon.
- **Rôles de compte** : `owner` (créateur), `full` (tout partagé), `planning` (budget/documents perso), `child` (8–14 ans, accès créé par un parent, voir « Accès enfant »).
- **Fonctions livrées les 17–19/11** : notes + widget Notes, récap du matin, horaires de travail et « Mes horaires », rendez-vous datés et navigation par semaines, liens de partage par membre (page web), accès enfant + « Espace de l'enfant », demandes d'échange d'étoiles, argent de poche automatique, widgets « + » centrés, espacement des formulaires (`space.section`).
- **Restent à faire / idées validées** : RevenueCat / Play Console (achats) ; synchronisation Google/Outlook (pas activée) ; dépendances natives à monter au prochain APK (voir « Dépendances »).
- **À faire par l'utilisatrice dans Render** (si pas fait) : `ANTHROPIC_API_KEY`, `LIFETIME_PREMIUM_EMAILS`. Sauvegarde hebdomadaire : 5 secrets GitHub à ajouter. cron-job.org (`/health` toutes les 10 min).
- Règles : avant de pousser, `git fetch origin main` et partir de main ; migrations datées **après** la dernière de main ; une PR prête à fusionner par changement, fusion seulement après accord.

## Cervelle — appli de révision séparée, même serveur

- Revue complète (état, architecture, décisions, points faibles) : `RESUME-PROJET.md` du dépôt `Siquane/cervelle`.
- Côté serveur ici : `server/src/routes/cervelle.ts`, `server/src/services/cervelleAi.ts`, `server/src/lib/cervelle/`, migrations `20261116080000_cervelle` et `20261116090000_cervelle_programme`, textes officiels dans `docs/programmes/`. PR #41.
- Utilise `ANTHROPIC_API_KEY` (comme les menus). Limites par famille et par 24 h : 15 révisions, 10 interros, 120 messages d'assistant, 400 corrections.
- Programme officiel : CM2, 6e, 5e, 4e, 3e (`lib/cervelle/programme.ts`, tableau des textes en vigueur dans `docs/programmes/README.md`).
- Notifications de l'enfant : `LearnerDevice.pushToken` (migration `20261116130000_cervelle_push`), `PUT /cervelle/child/push`, « fiches prêtes » envoyé par `lib/cervelle/push.ts` via le même envoi Expo que Passerelle (`sendPush` dans `lib/familyAlerts.ts`). Les rappels datés sont programmés par l'appli à partir de `GET /cervelle/learners/me/reminders`. Mode de quiz `express` (6 questions).

## Contexte

- Application famille : planning, tâches récurrentes, livre de recettes, anniversaires, menu de la semaine, documents, budget.
- Stack : serveur Express + Prisma (Postgres) dans `server/`, application mobile Expo SDK 58 / React Native 0.88 dans `mobile/`.
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
- **Tests automatiques** : `.github/workflows/tests-server.yml` (Postgres, vérification des migrations) et `tests-mobile.yml`, seulement sur les pull requests qui touchent `server/` ou `mobile/` (plus sur `main` après fusion) pour tenir dans les 2 000 minutes gratuites par mois. EAS Update ne part pas pour un changement de tests seuls.
- **Limites de tentatives** : connexion et code de réinitialisation 10 / 15 min par e-mail et IP ; inscription et demande de code 10 / heure par IP (`server/src/middleware/rateLimits.ts`). Les tests les désactivent via `DISABLE_RATE_LIMIT=1`.
- **Bouton « + »** : menu d'ajout rapide (tâche, dépense, document, recette, repas).
- **Notifications** : récap du soir à 20 h (tâches du lendemain, interrupteur dans l'onglet Notifications) ; message quand une dépense fait dépasser un plafond ; la synchro des rappels de tâches n'annule plus les rappels d'anniversaire.

## Navigation : les 4 piliers (12/11/2026)

- Barre du bas = les 4 anneaux du logo Passerelle, de gauche à droite : **Planning** (cyan), **Repas** (bleu clair), **Budget** (lavande), **Famille** (violet), avec le « + » d'ajout rapide au milieu. Couleurs dans `theme/tokens.ts` (`pillar1`…`pillar4`).
- Repas = menu de la semaine + recettes (sélecteur en haut ; contenus dans `src/screens/MealsBody.tsx` et `RecipesBody.tsx`, réutilisés par `/meals` et `/recipes`).
- Famille = membres, documents, anniversaires, partage.
- Recherche (`/search`), notifications (`/inbox`, pour ne pas entrer en conflit avec l'écran d'accueil `(onboarding)/notifications`) et profil (`/profile`) ne sont plus des onglets : icônes en haut de chaque onglet (`TabHeader` dans `components/PageHeader.tsx`).

## Partage de famille : plusieurs comptes autour des mêmes données (14/11/2026)

- Il n'y avait **pas de code famille** avant : un compte = une famille. Maintenant tout compte, y compris celui qui crée la famille, demande de confirmer avoir **15 ans ou plus** (majorité numérique ; `age15` obligatoire à l'inscription) ; d'autres personnes la rejoignent avec un **code de 8 caractères valable 7 jours** (ex. `K7F2-9QXA`), depuis « J'ai un code famille » à l'inscription. Le créateur le génère dans Famille → « Comptes de la famille », et choisit le profil :
  - **Complet** : tout est partagé, budget et documents compris.
  - **Planning** : tâches, calendrier, repas, recettes, courses et membres partagés ; **budget et documents personnels** (propres à ce compte).
- Principe : une famille = les données du compte créateur. `requireAuth` (middleware) résout le compte : `req.userId` = id de la famille (toutes les routes marchent telles quelles), `req.accountId` = la personne, `req.privateId` = où vivent son budget et ses documents ; les routeurs budget, catégories, plafonds, récurrentes, épargne, relevés et documents utilisent `privateSpace` (Planning = son propre id). Les pièces jointes de recettes restent à la famille.
- **Un seul abonnement par famille** : packs, essai et quotas de menus se lisent chez le créateur (`packDates` résout la famille) ; l'appli identifie RevenueCat avec `user.familyId`. Un compte de la liste `LIFETIME_PREMIUM_EMAILS` qui a rejoint une autre famille profite des packs de celle-ci, pas du sien.
- Gestion : `GET /family`, `POST/DELETE /family/invite` (créateur), `DELETE /family/accounts/:id` (retirer), `POST /family/leave`. Un compte retiré ou parti redevient sa propre famille, vide. Supprimer le compte créateur demande une confirmation (`409 family_has_members` avec `heir` et `heirs`, puis `confirmFamily: true`, `heirId` facultatif ; l'appli propose une liste `HeirPickerModal` quand plusieurs adultes le peuvent, sinon le seul adulte est proposé dans l'alerte) : l'adulte choisi (par défaut le plus ancien, profil Complet) reprend la famille (`lib/familyHandover.ts` déplace toutes les lignes de l'ancien créateur vers lui, sans l'abonnement ni l'agenda connecté) et les autres comptes le suivent ; sans adulte, chacun devient indépendant et garde son budget et ses documents, seul le planning partagé est effacé. Chaque compte concerné reçoit un message unique (`User.familyNotice`, affiché par `FamilyNoticeModal`, fermé par `DELETE /family/notice`). 6 comptes au plus par famille.
- Synchronisation entre téléphones : les listes partagées (tâches, repas, courses, recettes, membres) se rafraîchissent toutes les minutes et au retour dans l'appli ; l'utilisateur est resynchronisé à chaque retour au premier plan.
- Migration `20261114140000_family_sharing`. Politique de confidentialité et page Confidentialité mises à jour (15 ans, profils, suppression) : **la page publiée est à republier**.
- Pas fait : transférer la famille à un autre adulte, rejoindre depuis un compte existant, notifications « quelqu'un a modifié le planning ».

## Essai gratuit de Budget+ (14/11/2026)

- **4 semaines (28 jours), une seule fois par compte**, démarré à la demande : bouton « Essayer 4 semaines gratuitement » sur l'écran Passerelle+ (carte Budget+), bandeau « Essaie Budget+… » dans l'onglet Budget, accroches des écrans Épargne, Bilan et Import. Comptes existants compris.
- Serveur : `User.budgetTrialStartedAt` ; `hasPack(user, "budget")` est vrai pendant l'essai, donc tous les verrous Budget+ suivent sans autre changement (documents illimités aussi, comme avec un pack). `POST /plan/trial/budget` (409 si déjà utilisé ou si un pack payant tourne) ; `GET /plan` ajoute `packs.budget.trial { available, active, days, endsAt }`. Un achat pendant l'essai reprend la main (la date payée prime, RevenueCat n'est pas touché).
- Appli : bandeau « il reste N jours » dans l'onglet Budget ; dans les 5 derniers jours, bandeau mis en valeur et **notification locale** 5 jours avant la fin à 10 h (`syncTrialReminder`, demande l'autorisation des notifications au démarrage de l'essai). L'écran Passerelle+ garde les boutons d'achat pendant l'essai et n'affiche plus « Gérer mon abonnement » tant que rien n'est payé.
- Pour changer la durée : `BUDGET_TRIAL_DAYS` dans `server/src/lib/plan.ts` (l'appli lit `days` envoyé par le serveur).
- Les menus gardent leur essai historique (4 générations pendant les 30 jours après la création du compte).

## Import de relevé bancaire PDF (Budget+, 14/11/2026)

- Budget → « Importer un relevé » (`mobile/app/statement-import.tsx`) : choix d'un PDF, liste des dépenses trouvées avec catégorie proposée, cases à cocher, « Chaque mois » pour créer une dépense récurrente, puis import des lignes cochées.
- Serveur : `POST /statements/parse` lit le PDF **en mémoire** (bibliothèque `unpdf`, aucun stockage, rien envoyé à Claude) ; `POST /statements/import` enregistre ce qui est coché. Réservé à Budget+, 20 lectures par heure.
- `server/src/lib/statementParser.ts` lit les colonnes Débit / Crédit d'après la position du texte (testé sur un vrai relevé Crédit Agricole : 96 lignes, totaux identiques à la ligne « Total des opérations », contrôle affiché dans l'appli). Autres banques : repli par signe (`-` = dépense) ; à ajuster avec un exemple de relevé.
- `statementCategories.ts` : règles de commerçants courants (≈ 83 % des lignes classées sur le relevé d'essai) ; table `ImportRule` : chaque catégorie corrigée est retenue pour le commerçant (clé sans chiffres ni dates, aucun montant).
- Doublons : une ligne de même montant à ±3 jours d'une dépense existante est décochée (« déjà dans ton budget »). Les entrées d'argent sont ignorées.
- Politique de confidentialité et page Confidentialité de l'appli mis à jour (le PDF n'est jamais conservé). **À republier** : la page publiée de la politique.
- Idées suivantes : détection des dérives d'un mois à l'autre, calendrier des prélèvements, import CSV, lecture de plusieurs mois à la fois.

## Mises à jour de l'appli sans nouvel APK (EAS Update, 13/11/2026)

- `expo-updates` installé, canal `preview`. `runtimeVersion` actuel : **"3"** (lot natif SDK 58 + widgets + Sentry) dans `mobile/app.json`.
- Workflow `.github/workflows/eas-update.yml` : à chaque fusion dans `main` qui touche `mobile/`, publie une mise à jour ; l'appli la télécharge et l'applique au démarrage (`src/lib/updates.ts`). Aussi lançable à la main (« Run workflow »).
- **Règle à respecter** : si un changement ajoute ou modifie un module natif, une permission ou `app.json` côté natif, augmenter `runtimeVersion` ("1" → "2") et compiler un nouvel APK. Garde-fou : si `package.json` ou `app.json` changent sans nouveau `runtimeVersion`, le workflow ne publie rien (avertissement).
- L'URL de mise à jour (`https://u.expo.dev/<projectId>`) est ajoutée en CI par `mobile/scripts/configure-updates.js`, après `eas init` (build et update).
- Un APK n'est nécessaire que lorsque `runtimeVersion` change ; tout le reste arrive par mise à jour au démarrage.

## Améliorations sans nouvel APK (13/11/2026)

- **Liste de courses** (Repas → Courses) : ajout à la main, « Générer depuis le menu de la semaine » (ingrédients des recettes du menu, sans doublons), cases à cocher, « Vider » le panier. Serveur : modèle `ShoppingItem`, routes `/shopping`.
- **Import de recette depuis un lien** (Nouvelle recette → Importer) : le serveur lit les données schema.org Recipe de la page (`server/src/lib/recipeImport.ts`), refuse les adresses privées, 8 s et 3 Mo max ; rien n'est enregistré avant validation du formulaire.
- **Recherche globale** (`/search`) : tâches, recettes et ingrédients, documents, dépenses du mois, liste de courses, sans tenir compte des accents (`src/lib/search.ts`).
- **Carte « Aujourd'hui »** en haut du Planning : prochaine tâche, dîner du soir, reste sur les plafonds du mois (`src/lib/today.ts`).
- **Export du budget** : Budget → « Exporter le mois (tableur) », CSV pour Excel en français, envoyé par le menu de partage du téléphone.
- **Sauvegarde hebdomadaire** : workflow `.github/workflows/backup.yml`, chaque dimanche vers 4 h, `pg_dump` compressé dans R2 sous `backups/`, 8 dernières gardées. Il faut 5 secrets GitHub (Settings → Secrets and variables → Actions) : `BACKUP_DATABASE_URL` (même valeur que `DATABASE_URL` dans Render), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (mêmes valeurs que dans Render). Sans eux, le workflow ne fait rien et reste vert. Restaurer : télécharger le fichier depuis R2, puis `gunzip -c fichier.sql.gz | psql "<adresse Neon>"`.

## Lot natif (13/11/2026, `runtimeVersion` "3", nouvel APK nécessaire)

- **Expo SDK 58** (React Native 0.88, React 19.3). Expo Router embarque désormais sa propre barre d'onglets : `CustomTabBar` reçoit `navigateToTab(route.key)` au lieu de `navigation` (type `BottomTabBarProps` de `expo-router/tabs`) ; `@react-navigation/bottom-tabs` retiré. `@react-native-async-storage/async-storage` reste en v3 (la liste SDK 58 indique 2.2.0, mais la v3 fonctionne déjà sur les APK).
- **4 widgets Android** (`react-native-android-widget`, déclarés dans `app.json`) : « Aujourd'hui », « Tâches du jour », « Menu », « Courses ». L'utilisateur choisit lesquels poser depuis la liste des widgets du téléphone. L'appli enregistre un résumé de ses données sur le téléphone à chaque changement (`src/widgets/sync.ts`, `snapshot.ts`) et redessine les widgets ; Android les redessine aussi toutes les 30 min à partir de ce résumé (`taskHandler.tsx`, enregistré dans `mobile/index.js`, nouveau point d'entrée). Un appui ouvre l'écran correspondant (`/repas?tab=courses` pour les courses). La déconnexion vide les widgets.
- **Sentry** (`src/lib/sentry.ts`) : erreurs uniquement, pas de données personnelles. Actif : DSN du projet Sentry (organisation `siquanelab`, serveurs européens) dans `src/lib/sentry.ts` (pas un secret, elle est publique dans l'appli). Les erreurs apparaissent sur sentry.io → Issues.

- **Widgets, suite** : aperçu illustré dans la liste des widgets (`mobile/assets/widgets/*.png`, générés en HTML) ; widget vide = message + exemple grisé ; un appui ouvre le bon écran via `passerelle://widget/<planning|menu|courses>` (`app/+native-intent.tsx`, `src/widgets/links.ts`, avec reprise après la redirection de démarrage).
- **Profil** : nom modifiable (Profil → Modifier/Ajouter), route serveur `PATCH /auth/me` (recalcule les initiales) ; l'appli resynchronise l'utilisateur via `GET /auth/me` à l'ouverture.
- Planning plus aéré (espacement 20 sur tous les écrans), les 7 jours tiennent sur une ligne.

Mises à jour majeures du serveur : faites le 13/11 au soir (voir « Dépendances et mises à jour »).

## Préférences repas par membre et RGPD (13/11/2026, soir)

- **Fiche membre** (`app/member/[id].tsx`, ouverte depuis l'onglet Famille) : prénom, âge, et section **« Repas » en accordéon** (`components/Accordion.tsx`) : plats préférés, n'aime pas, appétit, jours de cantine, notes ; puis « Santé et régime » : régime, allergies, aliments à limiter.
- **Données sensibles (RGPD art. 9)** : régime, allergies et aliments à limiter ne sont acceptés par le serveur qu'après un **accord explicite** du compte (`User.foodHealthConsentAt`, routes `GET/POST/DELETE /members/food-consent`). Retirer l'accord efface ces champs chez tous les membres.
- **Menus générés** : les membres sont envoyés à Claude **sans prénom** (« Adulte 1 », « Enfant 2 », selon l'âge ; `anonymizeMembers` dans `services/mealPlanner.ts`), données sensibles seulement avec l'accord. Pas de genre, ni saisi ni deviné (choix de l'utilisatrice).
- **Page Confidentialité** (Profil → Confidentialité et données, `app/privacy.tsx`) : ce qui est stocké et où, ce qui part chez Claude, retrait de l'accord, **suppression du compte** (`DELETE /auth/me` avec mot de passe ; efface aussi les fichiers R2). Base de la future politique de confidentialité exigée par le Play Store.
- Décision : Passerelle est destinée à d'autres familles à terme → faire « RGPD propre » dès maintenant.

## Style Passerelle (13/11/2026)

- L'appli reprend le logo : fond bleu nuit `#070912`, cartes `#0f1426`, texte blanc bleuté, dégradé néon cyan → bleu → violet (`theme/tokens.ts` : `color`, `gradient`, `glow`).
- Titres en Space Grotesk, texte en Inter.
- Éléments de marque dans `src/components/Brand.tsx` : `PasserelleArch` (arche à côté du titre de chaque onglet), `GradientRule` (filet sous le titre), `GradientFill` (dégradé dessiné avec react-native-svg, pas de module natif en plus).
- Onglets : l'icône dans l'anneau de sa couleur, halo autour de l'onglet actif (fond intérieur très léger pour garder le contraste). Le « + » est un rond à bord dégradé.
- Boutons principaux remplis du dégradé, texte foncé. Catégories de tâches aux couleurs des anneaux (`categoryColor` dans `lib/weekdays.ts`, Santé en vert).
- Icône, icône Android et écran de lancement refaits depuis le logo (`mobile/assets/`). Logo source : `assets/brand/logo-passerelle.png`.
- `runtimeVersion` passé de "1" à "2" pour ce lot, puis "3" avec le lot natif SDK 58 (qui inclut ce style).
- Icône de l'onglet Repas : bol fumant (`MealIcon` dans `components/icons.tsx`, PR #12), au lieu de fourchette + couteau. Icônes en couleur unie (pas de dégradé vertical, choix de l'utilisateur).
- Profil de marque pour les documents produits par Claude : `CLAUDE.md` à la racine (couleurs, logo, format « pages visuelles »).

## Installation d'un APK (historique du 13/11/2026 ; APK actuel : voir « État actuel »)

- APK de l'époque (runtime "3" : Expo SDK 58, widgets, Sentry, style Passerelle) : https://expo.dev/accounts/siquanes-team/projects/passerelle/builds/541514d0-0b8f-4289-b02a-c78da8d7119e
- Liens périmés, à ne plus utiliser : `5a8ba245…` (runtime "1") et `c5add826…` (runtime "2", sessions parallèles du 13/11). Ils ne reçoivent plus de mises à jour.
- Problème rencontré : « Application non installée » en installant par-dessus une ancienne version (signature différente probable). Solution : **désinstaller l'ancienne appli d'abord**, puis installer. Les données sont sur le serveur ; il faut se reconnecter et réactiver les notifications.
- Ce qui a été ajouté après la compilation de cet APK (bol de l'onglet Repas, nom modifiable dans le profil, dépendances) arrive par EAS Update **une fois la PR #11 fusionnée** (les mises à jour ne sont publiées que depuis main) : fermer puis rouvrir l'appli une fois.
- À confirmer : l'installation a-t-elle réussi ? Le halo des onglets rend-il bien sur le téléphone (jamais vu sur un vrai appareil) ?
- Éviter les sessions en parallèle sur l'appli : le 13/11, trois sessions ont produit des APK et des résumés contradictoires.

## Touche ludique, inspirée de Cervelle (16/11/2026)

- **Tâche « faite »** pour toutes les tâches, jour par jour : modèle `TaskDone` (`taskId` + `day` « AAAA-MM-JJ », unique), routes `GET /tasks/done?week=<lundi>`, `PUT /tasks/:id/done {day}`, `DELETE /tasks/:id/done?day=`. Indépendant des étoiles des enfants (qui restent dans la fiche de la tâche).
- Appli (`src/components/Playful.tsx`) : `DoneCheck` (case ronde à la couleur de la catégorie, rebond + étincelles), `DayRing` (anneau du jour en dégradé + phrase, `progressLine`), `EmptyState` (arche du logo qui flotte). API Animated de React Native uniquement, coupée si « réduire les animations » est activé.
- Planning : case ronde sur chaque tâche, anneau du jour, bulle « Tout est fait… » quand la dernière tâche est cochée. Coche instantanée à l'écran, annulée si l'envoi échoue (`useToggleTaskDone`).
- Formes : `radius` 6 / 14 / 18, puces en pilule par défaut, boutons principaux et secondaires « épais » (rebord `edge` / `edgeSoft` qui s'écrase à l'appui).
- Écrans vides avec l'arche et une phrase sympa : Planning, recettes, documents, notifications, budget, courses.
- Pas de module natif : arrive par EAS Update, avec la migration serveur au déploiement Render.

## Idées notées pour plus tard

Faites depuis : comptes par membre (rôles + accès enfant), étoiles des enfants, thème clair, demandes d'échange d'étoiles, argent de poche automatique.
Encore à faire : synchronisation Google Agenda, statistiques du budget sur 12 mois, idées cadeaux d'anniversaire, liste de courses en temps réel, version iPhone (99 €/an).

## Dépendances et mises à jour (12–13/11/2026)

- **Faites** : zod 3 → 4, vitest 2 → 5 (+ vite 8), googleapis 189, msal-node 7 (PR #7) ; mises à jour sûres serveur et app (PR #13) ; Expo SDK 58 (PR #11), qui corrige aussi les alertes « high » d'`expo-router`. `engines.node >= 22` dans `server/package.json`.
- **Règle zod 4** : ne jamais écrire `schema.partial()` pour une route PATCH (les `.default()` s'appliquent quand même et réinitialisaient les champs absents). Utiliser `patchSchema(schema)` (`server/src/lib/validation.ts`), déjà en place sur toutes les routes PATCH ; test de non-régression dans `tests/routes/members.test.ts`.

- Serveur : à jour dans les versions actuelles (`npm update`), `npm audit` : 0 faille. Déjà faits : zod 4, vitest 5.
- Appli : alignée sur la liste Expo SDK 58 (sauf async-storage gardé en v3, qui fonctionne). `npm audit fix` appliqué ; il reste des alertes faibles/moyennes uniquement dans les outils de test (chaîne jest-expo / jest 29), qui ne partent pas dans l'APK. Elles disparaîtront avec jest 30 quand jest-expo le prendra en charge.
- **Mises à jour majeures du serveur faites (13/11 soir)** : Prisma 7 (adaptateur `@prisma/adapter-pg`, URL de la base dans `server/prisma.config.ts`, plus dans le schéma ; `migrate diff --to-schema` + `SHADOW_DATABASE_URL` en CI), Express 5, express-rate-limit 8 (`ipKeyGenerator`), TypeScript 7 (`module`/`moduleResolution` = `nodenext`), dotenv 18, bcryptjs 3, nanoid 6, googleapis 190, pdfkit 0.20. `@types/node` gardé en 22 (Node 22 sur Render ; `engines.node >= 22.12`, exigé par Prisma 7). Prisma 7 refuse `db push --force-reset` lancé par une IA sans accord explicite : les tests locaux demandent la variable `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` (texte exact de l'accord de l'utilisatrice) ; la CI n'est pas concernée.
- Appli, à suivre au prochain APK : `@sentry/react-native` 8.35 (la liste SDK 58 indique 8.28), gesture-handler 3.5. Ne pas les monter sans nouveau `runtimeVersion` (modules natifs).
- **19/11** : serveur `npm update` (Anthropic SDK 1.10, AWS SDK, msal, express-rate-limit, unpdf, vitest 5.1.1), 0 faille. Appli, JS seulement : TanStack Query 5.108 (+ persister), jest-expo 58.0.15. **À monter au prochain APK (natif)** : expo 58.0.26, expo-router 58.0.32, expo-calendar, expo-file-system, expo-web-browser 58.1, react 19.3.1, reanimated 4.7.2, worklets 0.13.1, svg 15.16.1, datetimepicker 9.3, purchases 11.0.4, Sentry 8.36, gesture-handler 3.5. Pas encore : Prisma 8 (rc), TypeScript 7 côté appli, jest 30 (pas pris en charge par jest-expo).

## Numéro de version Android (PR #5, 11/11/2026)

- `mobile/eas.json` : `appVersionSource: "remote"` + `autoIncrement: true` sur le profil `preview`. EAS augmente le `versionCode` à chaque build, pour que les nouveaux APK s'installent par-dessus l'ancien. Avant, toutes les versions avaient le `versionCode` 1.
- Le build lancé le 13/11 vers 14 h 46 depuis `main` (run n°14, avant la fusion de la PR #11) est en runtime "2" : **ne pas l'installer**, il ne recevra pas de mises à jour. Utiliser l'APK indiqué dans « APK actuel et installation ».

## Incidents réglés (9–11/11/2026), à connaître

- **Mauvais serveur** : l'app pointait vers `appli-planning-familial.onrender.com` (sans `-0lyd`), un service qui **n'est pas le nôtre**. Les comptes créés et les mots de passe tapés avant le 11/11 y sont partis. L'adresse correcte est dans `mobile/eas.json`. Ne pas réutiliser les anciens mots de passe.
- **Réveil du serveur Render** : l'app réessaie pendant 60 s quand le serveur dort (502/503/504), affiche « Le serveur démarre… » après 5 s et appelle `/health` au lancement (`mobile/src/state/authStore.ts`, `useSlowHint`). Le serveur renvoie 500 (pas 502) si l'envoi d'e-mail échoue, pour ne pas déclencher ces réessais.
- **Clavier Android** : l'app est en plein écran (Expo 57), Android ne réduit plus l'écran pour le clavier. Tous les formulaires utilisent `KeyboardScrollView` ou `<Screen keyboard>` (`mobile/src/components/`). À reprendre pour tout nouvel écran avec des champs.
- **Mot de passe oublié** : Brevo configuré et testé (code reçu par e-mail). Variables Render : `BREVO_API_KEY` (clé à accès restreint, « Emails transactionnels : Tous », expire après 90 jours sans envoi), `MAIL_FROM_EMAIL` (adresse validée dans Brevo → Expéditeurs), `MAIL_FROM_NAME` (facultatif). Les e-mails peuvent arriver dans les spams.
- **Build EAS** : `eas-cli` exige Node 22 (workflow corrigé, PR #3).
- La session n'a pas accès réseau à render.com, expo.dev ni à l'API Expo : demander des captures à l'utilisatrice pour Render.

## Préférences de l'utilisateur

- Travaille en français.
- Poser des questions de clarification avant les réponses détaillées, avec des choix cliquables.
- Ne pas multiplier les étapes manuelles : préférer un commit unique, une PR prête à fusionner.
- Ne pas uploader de fichiers directement sur `main` pendant qu'une PR est ouverte (cela a créé un conflit une fois).
- Avant de fusionner une PR ou de lancer un build, demander confirmation (choix cliquable).

## Conventions du dépôt

- Routes : `server/src/routes/`, migrations Prisma : `server/prisma/migrations/` (générées et vérifiées avec `prisma migrate diff`).
- Mobile : hooks dans `mobile/src/hooks/useApi.ts`, API dans `mobile/src/api/resources.ts`, types dans `mobile/src/api/types.ts`.
- Avant de livrer : `npm run typecheck` et `npm test` dans `server/` (Postgres local requis, base `passerelle_test`) et dans `mobile/` (`npx jest`), plus `npx expo export --platform android` pour vérifier que l'appli se compile.
- Expo : lire la doc versionnée v58 (voir `mobile/AGENTS.md`).

## Noms des offres (13/11/2026, soir)

- Les abonnements s'appellent **Repas+** (ex-pack Menus), **Budget+** (ex-pack Budget) et **Passerelle+** (les deux, ex-« Les 2 ») ; l'écran s'intitule « Passerelle+ ». Icônes : toque (`ToqueIcon`) pour Repas+, tirelire (`PiggyBankIcon`) pour Budget+. Les identifiants techniques ne changent pas (`budget`, `meals`, `both`, champs `budgetUntil`/`mealsUntil`).
- Politique de confidentialité : `docs/politique-confidentialite.html`, publiée sur https://claude.ai/artifact/6q5yK3yYE2SmCnZAMqDxmv (à rendre publique par l'utilisatrice, menu Partager). Responsable : Anaïs Guyon, contact Siquane.lab@gmail.com. Lien dans Profil → Confidentialité.

## Fonctionnement sans connexion

- **Lecture** : les dernières données restent sur le téléphone (cache React Query persisté, `src/lib/queryClient.ts`). Une coupure réseau ne déconnecte plus : si le serveur est injoignable pendant le renouvellement de session, la session est gardée (`UnreachableError`).
- **Écriture** : tâches, courses, repas et dépenses (création, modification, suppression) passent par `src/lib/offlineApi.ts` → `writeOrQueue` (`src/lib/outbox.ts`). Sans réponse du serveur, l'écran est mis à jour tout de suite (`offlinePatches.ts`), le changement est gardé dans une file sur le téléphone (`outboxStore`, `outboxQueue.ts`) et envoyé dans l'ordre au retour du réseau. Un élément créé hors connexion a un id temporaire `tmp_…` remplacé par le vrai id dès que le serveur répond ; créer puis supprimer hors connexion n'envoie rien.
- **Conflits** : le dernier changement arrivé l'emporte ; les ajouts sont tous gardés. Un changement que le serveur refuse (déjà supprimé ailleurs) est abandonné avec un message.
- **Réseau** : pas de module natif. Une requête sans réponse marque le téléphone hors connexion (`networkStore`) ; `startOutboxSync` revérifie au retour au premier plan et toutes les 15 s tant que quelque chose attend. Bandeau au-dessus de la barre d'onglets (`OfflineBanner`).
- **Besoin du réseau** (boutons grisés via `Button needsNetwork`) : menus générés, import de relevé, import de recette par lien, enregistrement de recettes et de documents, achats. Le reste (recettes, documents, famille, comptes…) se lit hors connexion mais ne s'écrit pas.

## Rejoindre une famille depuis un compte déjà créé

- `POST /family/join` `{ code, erase?, password? }` (limiteur de connexion) : un compte qui n'est dans aucune famille et qui n'a aucun autre compte chez lui rejoint la famille du code, avec le profil du code. Refus : déjà dans une famille (`already_in_family`), a d'autres comptes (`family_has_members`, 409), code invalide/expiré/complet (`invalid_family_code`), son propre code (`own_code`).
- Compte pas vide (membres, tâches, recettes, repas, documents, dépenses, courses, objectifs, catégories) : `409 account_not_empty` avec `counts` ; avec `erase: true` + mot de passe, le contenu est effacé (fichiers compris, `lib/familyJoin.ts`) puis le compte rejoint. Les packs et l'essai du compte ne comptent plus : ceux de la famille s'appliquent.
- Application : section « Rejoindre une autre famille » dans Famille → Comptes de la famille, visible seulement quand on est seul dans sa famille (`joinFamily` dans `src/lib/account.ts`, `describeContent` dans `src/lib/family.ts`).

## Widget « Ajouter une tâche »

- 5ᵉ widget Android `AjoutTache` (2 × 1, aucun contenu à afficher : un bouton « + Ajouter une tâche » au style Passerelle). Un appui ouvre `/task/new` via `passerelle://widget/add-task` (`src/widgets/links.ts`, `views.tsx` → `AddTaskCard`). Déclaré dans `app.json` avec l'aperçu `assets/widgets/ajout.png`.
- **Brique native nouvelle → `runtimeVersion` passe à "6"** : il faut lancer « EAS Build (Android preview) » depuis `main` et réinstaller l'APK ; les APK runtime "5" ne reçoivent plus de mises à jour OTA.

## Tâches sur plusieurs jours reliées en série (15/11/2026)

- Problème : une tâche = un jour dans la base ; cocher lundi + mercredi créait deux tâches sans lien, et le formulaire de modification n'acceptait qu'un jour.
- `Task.seriesId` (migration `20261115120000_task_series`) relie les tâches créées ensemble. L'identifiant est fabriqué par l'appli (`newSeriesId`, `src/lib/taskSeries.ts`) pour marcher hors connexion. La migration regroupe les anciennes tâches **récurrentes** identiques (titre, catégorie, durée, priorité, membres ; un exemplaire par jour).
- Modifier une tâche agit sur toute la série : jours cochables (au moins un), heure commune ou par jour, cocher = ajouter, décocher = retirer (`planSeriesEdit` réutilise d'abord une tâche décochée pour un nouveau jour, pour garder son rappel). Supprimer depuis la fiche propose « ce jour seulement » ou « tous les jours ». Dupliquer reprend tous les jours.
- Tests serveur en local : la session crée une base neuve + `prisma migrate deploy` puis lance vitest avec une config sans `globalSetup` (non versionnée), ce qui évite le `db push --force-reset` refusé par Prisma 7.
- PR #36 fusionnée le 15/11.
- Les 4 fonctionnalités demandées le 15/11 sont faites (PR #36 à #40).

## Alertes push « quelqu'un a modifié » (15/11/2026)

- Quand un compte modifie le planning, le menu, les courses ou les recettes, les **autres** comptes de la famille reçoivent une notification (« Léa a modifié le planning et la liste de courses. »). Middleware `familyActivity` posé devant `/tasks`, `/meals`, `/shopping`, `/recipes` dans `server/src/index.ts` (sauf `/tasks/auto-slot`, `/meals/generate`, `/recipes/import`, qui n'enregistrent rien) ; regroupement par personne pendant 90 s (`FAMILY_ALERT_DELAY_MS`), en mémoire (`lib/familyAlerts.ts`), envoi via l'API push d'Expo, jetons périmés effacés.
- Base : table `PushToken` (par compte), `User.familyAlerts` (interrupteur, vrai par défaut) ; migration `20261115130000_family_alerts`. Routes `PUT /notifications/push-token`, `GET/PUT /notifications/family-alerts` ; `POST /auth/logout` accepte `pushToken` pour l'oublier.
- Appli : `src/lib/pushAlerts.ts` enregistre le jeton au démarrage et au retour dans l'appli (canal Android `family`) ; un appui ouvre Planning ou Repas ; alerte reçue appli ouverte = données rechargées. Interrupteur dans Notifications, visible seulement s'il y a plusieurs comptes. Page Confidentialité mise à jour (**politique publiée à republier**).
- **Firebase** : projet `passerelle-61282` créé le 15/11 ; `mobile/google-services.json` ajouté (pas un secret) avec `android.googleServicesFile` dans `app.json` → **`runtimeVersion` "7"** : après fusion, lancer « EAS Build (Android preview) » depuis main et installer le nouvel APK (les APK runtime "6" ne reçoivent plus de mises à jour). **À faire par l'utilisatrice** : clé FCM V1 (compte de service Firebase) déposée sur expo.dev → Credentials → Android (guide `docs/notifications-push.md`, étape 2), sinon Expo ne peut pas envoyer.
- PR #37 fusionnée le 15/11.

## Étoiles et récompenses des enfants (15/11/2026)

- Enfant = membre de **moins de 15 ans** (âge saisi, sinon date de naissance ; `lib/stars.ts` côté serveur et appli). Chaque tâche rapporte **1 à 5 étoiles** (`Task.stars`, réglable dans le formulaire quand un enfant est assigné).
- Sur la fiche d'une tâche, un adulte (tout compte connecté) coche « C'est fait » pour chaque enfant assigné : une fois par semaine (`StarCompletion.week` = lundi local « AAAA-MM-JJ », envoyé par l'appli), annulable. Titre et étoiles recopiés : supprimer la tâche ne retire pas les étoiles.
- Famille → « Étoiles et récompenses » (`app/stars.tsx`) : solde et étoiles de la semaine par enfant, récompenses (titre + prix, 30 max) à échanger si le solde suffit (`409 not_enough_stars` sinon), historique (appui long pour effacer une erreur).
- Serveur : `routes/stars.ts` (`GET /stars?week=`, `POST/DELETE /stars/complete`, `/stars/rewards`, `/stars/rewards/:id/redeem`, `DELETE /stars/history/:id`), modèles `StarCompletion`, `Reward`, `RewardRedemption` (migration `20261115140000_stars`), repris par la passation de famille et effacés par « rejoindre une famille ». Gratuit, réseau nécessaire.
- PR #38 fusionnée le 15/11 (étoiles + Firebase, runtime "7"). Clé FCM V1 déposée sur expo.dev par l'utilisatrice. **APK runtime "7"** (build n°17 depuis main, 15/11 23 h 44 UTC, contient Firebase et tout jusqu'à la PR #40) : https://expo.dev/accounts/siquanes-team/projects/passerelle/builds/906dc17a-cd48-40f6-a374-3b88b5e019d8 — à installer sur chaque téléphone (désinstaller l'ancienne version d'abord si « Application non installée »).

## Dépenses en hausse et calendrier des prélèvements (Budget+, 15/11/2026)

- **Dérive** = une catégorie dont le mois dépasse la moyenne des 3 mois précédents d'au moins **25 % ET 20 €**, et qui a servi au moins 2 de ces 3 mois ; l'épargne est ignorée (`server/src/lib/drifts.ts`, `findDrifts`).
- Carte « Dépenses en hausse » dans l'onglet Budget (`GET /expenses/drifts?month=`). Après l'enregistrement d'une dépense (et l'import d'un relevé, pour le mois en cours), `checkDriftAlert` signale la dérive **une fois par catégorie et par mois** (table `DriftAlert`, migration `20261115150000_drift_alerts`) : message à celui qui enregistre (réponse `drift`), ligne dans Notifications, **push** aux autres comptes qui voient ce budget (propriétaire + comptes « complet » ; un compte « planning » a son propre budget). Un appui ouvre `/budget`.
- **Calendrier des prélèvements** (`app/debits.tsx`, `GET /expenses/debits?month=`) : dépenses récurrentes jour par jour, totaux « déjà passé » / « à venir » ; mois passés et en cours = copies réelles, mois à venir = récurrentes prévues.
- PR #39 et #40 fusionnées le 15/11.

## Thème clair (15/11/2026)

- **Sombre par défaut** ; Profil → **Apparence** : « Sombre » / « Clair ». **Ne suit pas le réglage du téléphone** (choix de l'utilisatrice, après une première version qui le suivait). Préférence propre au téléphone (`src/state/themeStore.ts`, AsyncStorage `passerelle-theme`).
- `app.json` inchangé (`userInterfaceStyle` "dark") → **pas de nouveau runtime** : arrive par mise à jour au démarrage.
- Palettes dans `src/theme/tokens.ts` : `color` est **modifié sur place** par `applyTheme` ; la racine (`app/_layout.tsx`) remonte tout l'arbre (clé = thème), ce qui ramène au Planning (le profil y retourne tout seul). Règle : **ne jamais figer une couleur au chargement d'un module** (objet en haut de fichier, `StyleSheet.create`) : la lire au rendu, ou utiliser un getter (`get tint() { return color.pillar1; }`).
- Clair « blanc et néon adouci » : fond `#f4f8ff`, cartes blanches, texte `#0b1530`, échelles `accent*`/`neutral*` inversées (neutral100 = le plus contrasté dans les deux thèmes), dégradé un peu plus foncé, texte des boutons principaux `color.onGradient` (bleu nuit). Contrastes vérifiés (texte 17:1, secondaire 6,5:1, discret 4,8:1, accent 4,8:1).
- Les **widgets restent sombres** (`darkColor`). Écran de lancement, icône et sélecteurs natifs (date, heure) restent sombres.
- Pas vu sur un vrai téléphone : à vérifier.

## Accueil sauté pour un compte déjà configuré (16/11/2026)

- L'accueil (membres, plages protégées…) n'était retenu que sur le téléphone (`passerelle.onboarded` dans SecureStore) : il revenait après chaque réinstallation.
- `app/index.tsx` : si l'accueil n'a pas été vu sur ce téléphone, l'appli regarde le compte (`accountIsSetUp` dans `src/state/onboardingStore.ts`) : compte qui a rejoint une famille, ou qui a des membres ou des tâches → directement au Planning (et l'accueil est noté comme vu). Sans réponse en 10 s (serveur endormi, pas de réseau) → l'accueil, comme avant.

## Notes et widget « Notes » (17/11/2026, `runtimeVersion` "8")

- Famille → **Notes** (`app/notes.tsx`, filtres Toutes / Famille / Perso) et « Note » dans le menu « + ». Écran d'une note : `app/note/[id].tsx` (`/note/new` pour en créer une) : titre facultatif, texte, **Famille** (tous les comptes la voient et la modifient) ou **Perso** (seul l'auteur la voit), couleur, épinglage.
- Serveur : modèle `Note` (migration `20261117170000_notes`), routes `/notes`. Une note Famille vit dans l'espace de la famille (`userId` = famille), une note Perso chez son auteur (`userId` = son compte) : quitter la famille ou supprimer son compte n'emporte que ses notes perso. Seul l'auteur peut rendre perso une note Famille. La passation de famille transfère les notes Famille ; « rejoindre une famille » efface les notes Famille de l'ancien compte.
- **Widget « Notes »** (6ᵉ widget, 3 × 2) : les 4 dernières notes (épinglées d'abord), un appui ouvre la note (`passerelle://widget/note/<id>`), « + » ouvre `/note/new`, le titre ouvre la liste. Aperçu `assets/widgets/notes.png`. Nouveau widget natif → **`runtimeVersion` "8"** : lancer « EAS Build (Android preview) » depuis main et installer le nouvel APK.
- Retour depuis un écran ouvert par un widget : `goBack()` / `useBackFallback()` (`src/lib/navigation.ts`, PR #52).

## Récap du matin et case « Dans les récaps » (17/11/2026)

- **Récap du matin** (`syncMorningDigest`, `src/lib/notifications.ts`) : chaque matin à **9 h par défaut** (heure réglable et interrupteur dans Notifications, préférences du téléphone dans `settingsStore`), toutes les tâches du jour, une par ligne avec qui les fait (« 08:20 École · Jules »). Canal Android `morning` en importance haute : bannière en haut de l'écran avec son, liste complète en dépliant. Un appui ouvre le Planning. Pas de vrai plein écran (réservé par Android aux réveils et appels).
- **Case « Dans les récaps »** sur chaque tâche (`Task.inDigest`, vrai par défaut, migration `20261117180000_task_in_digest`) : décochée, la tâche n'apparaît ni dans le récap du soir ni dans celui du matin ; elle reste au Planning et garde son rappel.
- Pas de nouvel APK (JS seulement, runtime "8").

## Quota Expo épuisé → APK compilé sur GitHub (17/11/2026)

- Le compte Expo gratuit a utilisé toutes ses compilations Android de novembre (remise à zéro le 1er décembre) : « EAS Build (Android preview) » échoue avec « This account has used its Android builds from the Free plan this month ».
- Nouveau workflow **« APK sur GitHub (sans quota Expo) »** (`.github/workflows/apk-github.yml`) : `eas build --local` sur une machine GitHub (Java 17, SDK Android de la machine), même clé de signature (récupérée chez Expo) et même canal de mises à jour. L'APK est publié dans une **Release GitHub** (`apk-<n°>`, fichier `passerelle.apk`, lien en fin de journal). Environ 20–30 min sur les 2 000 min/mois GitHub.
- APK runtime "8" (notes + widget Notes, récap du matin) : à compiler avec ce workflow puis à installer.

## Retouches du 17/11/2026 (soir)

- Bouton « Enregistrer » en haut à droite des 8 formulaires (`TopBar` prop `save`), visible clavier ouvert.
- Bouton principal (dégradé) sans rebord épais (il faisait une bande violette décalée, surtout en thème clair) ; les boutons secondaires gardent le rebord.
- Profil : un seul interrupteur « Apparence » (Sombre / Clair) sur une ligne.
- Planning : `edges={["top"]}` (la barre d'onglets gère déjà le bas ; avant, une bande vide coupait la liste au-dessus des onglets).
- Étoiles : une tâche peut valoir **0 étoile** (« Aucune ») ; elle n'affiche alors pas « C'est fait » pour les enfants.
- Replanifier : jusqu'à 6 propositions (2 heures par jour au plus, `getProposals(…, 6, 2)`) et « Choisir un autre moment » (jour + heure libres).
- Widget « Ajouter une tâche » : 3 × 1 au minimum (`minWidth` 180dp), le texte tient en entier. Reste en runtime "8" : aucun APK runtime "8" n'existe encore.
- Workflow « APK sur GitHub » : 1er essai arrêté par la limite de 60 min ; limite portée à 150 min et compilation arm64 seulement (`ORG_GRADLE_PROJECT_reactNativeArchitectures`).
- APK sur GitHub, 2e essai (18/11) : arrêt net après 70 min sans journal (manque de mémoire probable, machine GitHub à 7 Go). Workflow réglé : Gradle 3 Go, 2 tâches, Kotlin dans le même processus, 10 Go de mémoire d'appoint (swap), journal `build.log` gardé en artefact « journal-compilation » même en cas d'échec.

- APK sur GitHub, 3e essai : machine arrêtée net après 26 min, sans journal. PR #61 : plus de place disque (on garde le SDK Android), swap 4 Go, journal + état mémoire/disque envoyés toutes les 2 min dans une pré-version `journal-<n°>` (`suivi.txt`).
- **4e essai réussi (18/11, 30 min) → APK runtime "8"** : https://github.com/Siquane/Appli-planning-familial/releases/download/apk-4/passerelle.apk (page : https://github.com/Siquane/Appli-planning-familial/releases/tag/apk-4). Contient tout jusqu'à la PR #61. Arm64 seulement (téléphones Android récents). À installer à la place de l'APK runtime "7" ; si « Application non installée », désinstaller l'ancienne version d'abord. Pour les prochains APK : relancer ce workflow depuis main.

## Horaires de travail et replanification (18/11/2026)

- Retour utilisatrice : « Replanifier » proposait 8 h, 9 h, 10 h en semaine alors qu'elle travaille de 9 h à 17 h 30. Le moteur (`server/src/lib/scheduling.ts`) ne connaissait que sommeil / déjeuner / ne pas déranger, ne regardait que l'heure de début des autres tâches, et ignorait les tâches sans membre.
- **Horaires de travail par compte** : champs `workDays Int[]`, `workStart`, `workEnd` sur `User` (le compte, `req.accountId`), migration `20261118110000_work_hours`. `GET/PATCH /constraints` renvoie et accepte `work` / `workDays`, `workStart`, `workEnd` en plus des plages de la famille.
- Moteur : aucun créneau pendant le travail les jours cochés ; la **durée** de la tâche compte (ne déborde ni sur le travail, ni sur le déjeuner, le sommeil ou « ne pas déranger ») ; une tâche existante bloque toute sa durée ; une tâche sans membre bloque tout le monde. Créneaux 17:30, 18:30, 19:30 ajoutés. Même règles pour le placement automatique (`/tasks/auto-slot`, accepte `duration`).
- Appli : nouvel écran **« Mes horaires »** (`app/schedule.tsx`, depuis Profil et depuis « Replanifier ma semaine ») : jours + heures de travail, et sommeil / déjeuner / ne pas déranger (avant, modifiables seulement à l'inscription). JS seulement, pas de nouvel APK (runtime "8").

## Rendez-vous datés et semaines (18/11/2026)

- **Rendez-vous** = une tâche avec `appointmentDate` (« AAAA-MM-JJ »), `location` et `remind` ("hour" = 1 h avant, "eve" = veille 20 h, ou null). Migration `20261118150000_appointments`. Le serveur déduit `weekday` de la date et force `recurring`/`flexible` à false. Les tâches sans date restent la « semaine type », affichées chaque semaine (les tâches ponctuelles existantes ne changent pas).
- Appli : choix **Tâche / Rendez-vous** en haut de « Nouvelle tâche » (formulaire `src/screens/AppointmentForm.tsx` : titre, date, heure, durée, lieu, catégorie, pour qui, rappel, notes). Aussi dans le « + » (`/task/new?kind=appointment`).
- **Planning** : flèches ‹ › pour changer de semaine (« Cette semaine », « Semaine prochaine », « Semaine du … »), numéros des jours sous la barre, « Revenir à cette semaine ». Un RDV n'apparaît que dans sa semaine (`lib/appointments.ts` : `tasksOn`, `inWeek`). Carte : étiquette « Rendez-vous » + lieu.
- Notifications : les RDV sortent des récaps hebdomadaires (`digestTasks`) et ont leurs propres notifications datées (`syncAppointmentNotifications`, ids `rdv:` et `rdvday:`) : le rappel choisi et, si le récap du matin est activé, « Rendez-vous aujourd'hui » à l'heure du récap le jour J. 40 au maximum, recalculées à chaque ouverture/changement.
- Carte « Aujourd'hui » et widgets : un RDV ne compte que le jour de sa date. Replanifier / placement auto : seuls les RDV de la semaine en cours bloquent des créneaux.
- `DateField` accepte `future` (dates à venir) ; corrige au passage l'échéance des objectifs d'épargne, qui ne permettait que des dates passées.
- JS seulement (runtime "8"), plus le serveur.

## Liens de partage par membre (18/11/2026)

- L'ancien lien de partage renvoyait du JSON brut (`/share/public/:token`) et seulement les tâches `synced` (synchro agenda), donc une liste vide. Il est conservé côté serveur mais n'est plus proposé dans l'appli.
- **Un lien par membre** : `FamilyMember.shareToken` (migration `20261118160000_member_share_links`). `GET /share/members` crée les jetons à la demande, `POST /share/members/:id/reset` en fait un nouveau (l'ancien cesse de marcher).
- `GET /share/m/:token?week=AAAA-MM-JJ` = **page web** aux couleurs Passerelle (`server/src/lib/sharePage.ts`) : semaine jour par jour des tâches où ce membre est dans « Pour qui ? » + ses rendez-vous de la semaine, flèches semaine précédente/suivante, aujourd'hui mis en avant (heure de Paris). Pas de notes. `noindex`, `no-store`.
- Écran « Partager le planning » : une carte par membre (« Partager le lien », « Nouveau lien »).

## Accès enfant (moins de 15 ans) — PR 1 (18/11/2026)

- Nouveau rôle **"child"** (`User.familyRole`), lié au membre par `User.childMemberId` (unique, supprimé avec le membre). Migration `20261118170000_child_accounts` (+ table `ChildLoginCode`). Code commun : `server/src/lib/childAccess.ts`.
- Création par un **adulte** de la famille depuis la fiche du membre (8 à 14 ans, âge ou date de naissance requis) : `POST /family/children/:memberId/code` crée le compte si besoin et un code « K7F2-9QXA » à usage unique valable 24 h (seule l'empreinte est gardée). `GET /family/children`, `DELETE /family/children/:memberId` (supprime le compte, son budget, ses documents et leurs fichiers). Créer l'accès = accord parental (politique de confidentialité mise à jour).
- Connexion : écran « J'ai un code enfant » (`app/(auth)/child-code.tsx`) → `POST /auth/child-code`. Adresse e-mail technique `enfant-…@enfants.passerelle.invalid`, jamais montrée (`publicUser` renvoie `email: ""` et `childMemberId`).
- Espace : `resolveSpace` → famille partagée pour le planning, `privateId` = son propre compte (budget et documents à lui). Garde centrale dans `requireAuth` (`childAllowed`) : lecture de tout sauf partage, agendas, facturation, Cervelle ; pas d'écriture sur membres, famille, partage, contraintes, repas, recettes, courses, étoiles, plan, facturation. Tâches : il crée, mais ne modifie/supprime que celles où il est dans « Pour qui ? ».
- Famille dissoute sans héritier → comptes enfants supprimés ; ils ne comptent pas dans la limite de 6 comptes.
- Appli enfant : pas d'onglet Repas (barre : Planning | + | Budget, Famille), pas de Recette/Repas dans le « + », Famille sans gestion (ajout de membres, comptes, partage), étoiles en lecture seule, pas de « Replanifier », Profil sans agendas/Passerelle+/Mes horaires, Confidentialité : « demande à ton parent » pour supprimer.
- À venir (PR 2) : « Espace de Jules » pour que les parents voient ses documents, dépenses et épargne. Idées validées pour plus tard : demande d'échange d'étoiles, argent de poche automatique.

## Espace de l'enfant côté parents — PR 2 (18/11/2026)

- En-tête **`X-Child-Space: <memberId>`** : dans `requireAuth`, un adulte de la même famille (pas un enfant) voit `req.privateId` remplacé par le compte enfant → budget (toutes les routes `privateSpace`) et documents de l'enfant, en lecture et en écriture. Enfant inconnu ou d'une autre famille → 404 `child_space_not_found`. L'en-tête est ignoré pour un compte enfant.
- Appli : `src/state/childSpaceStore.ts` (non persisté) + `src/lib/childSpace.ts` (`enterChildSpace` / `exitChildSpace` oublient les requêtes budget/documents). Fiche du membre → « Son budget » / « Ses documents » ; bandeau `ChildSpaceBanner` « Espace de Jules · Revenir à mon espace » sur Budget et Documents. Le client ajoute l'en-tête ; le cache persistant ne garde pas ces données, et les écritures ne passent pas par la file hors connexion pendant ce mode.

## Demandes d'échange d'étoiles (18/11/2026)

- Modèle `RewardRequest` (migration `20261118180000_reward_requests`) : pending → accepted / declined (+ petit mot du parent).
- `POST /stars/rewards/:id/request` (compte enfant seulement, s'il a assez d'étoiles, une demande en attente par récompense) → notification aux comptes adultes « Jules demande : Cinéma (20 étoiles). » (lien `/stars`). `POST /stars/requests/:id/accept` (enregistre l'échange, revérifie le solde) et `/decline` `{ note }` → notification au téléphone de l'enfant. `GET /stars` renvoie `requests` (en attente + 10 dernières réponses). La garde enfant autorise seulement la route de demande.
- Écran Étoiles : l'enfant voit ses récompenses avec « Demander » (ou « Demandée ») et « Mes demandes » ; les adultes ont un bloc « Demandes » avec Accepter / Refuser (mot facultatif).

## Historique : point de reprise du 13/11/2026 (périmé, gardé pour mémoire)

- **Branche `ccr-b18b6b3c-98hc5q` (jamais fusionnée, partie d'une base du 10/11) reprise entièrement** par la session du 13/11 soir :
  - PR #16 fusionnée : correctif de perte de session (« Missing bearer token », renouvellement du jeton partagé).
  - PR #17 fusionnée : 10 nouvelles catégories de dépenses (Factures → Énergie & eau, Autre → Divers ; migration `20261113160000`).
  - PR #18 fusionnée : menus de la semaine générés par Claude (`POST /meals/generate`, `claude-opus-5-5`). **Nécessite `ANTHROPIC_API_KEY` dans Render** (clé créée par l'utilisatrice sur console.anthropic.com, à ajouter si ce n'est pas fait).
  - PR « Premium » (voir ci-dessous) : quotas gratuits, packs Budget / Menus / les 2, épargne, alertes 80 %/100 %, bilan 6 mois, prévision, export PDF, abonnements Play Store via RevenueCat, **Premium à vie** pour la famille.
- **`runtimeVersion` "5"** (PR #25, 14/11) : widgets réductibles jusqu'à 2 × 2 (`minWidth`/`minHeight` 110dp dans `app.json`). Après fusion : lancer « EAS Build (Android preview) » depuis main et installer le nouvel APK ; d'ici là, les APK runtime "4" ne reçoivent plus de mises à jour OTA.
- **APK définitif runtime "4"** (build n°15 depuis main, 13/11 17 h) : https://expo.dev/accounts/siquanes-team/projects/passerelle/builds/091eeef2-0fbe-4a5a-920e-e798ce39ba19 — remplace l'APK runtime "3" (`541514d0…`, périmé).
- **`runtimeVersion` "4"** avec la PR Premium (modules natifs : `react-native-purchases`, `expo-file-system`, `expo-sharing`). Après sa fusion : lancer « EAS Build (Android preview) » depuis main → **APK définitif**, à installer à la place de l'APK runtime "3".
- **À faire par l'utilisatrice dans Render** : `ANTHROPIC_API_KEY` (menus) et `LIFETIME_PREMIUM_EMAILS` (son adresse de compte, et celles de la famille, séparées par des virgules) → Premium à vie au redémarrage.
- RevenueCat / Play Console : pas configurés (sans clé `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, l'écran Premium affiche « bientôt »). Guide : `docs/achats-android.md`. Profil EAS `production` (.aab) prêt, sur le canal `preview`.
- L'autre session qui parlait de `claude/passerelle-continuation-9zzxuo` et du commit `11b892e` se trompait : ni l'une ni l'autre n'existent ; anniversaires et recettes sont dans main depuis longtemps.
- Sauvegarde hebdomadaire : **5 secrets GitHub encore à ajouter**. cron-job.org (`/health` toutes les 10 min) : à faire si pas fait.
- Règles : avant de pousser, `git fetch origin main` et fusionner main ; ne jamais redescendre `runtimeVersion` ; migrations datées **après** la dernière de main.

## Nettoyage et vitesse (19/11/2026)

- `useIsChildAccount()` (`src/state/authStore.ts`) remplace les tests de rôle répétés.
- Widgets : pas de rafraîchissement pendant « Espace de Jules » (sinon ils affichaient le budget de l'enfant).
- Recettes rafraîchies toutes les 5 min au lieu de 1 min (liste longue, change peu).
- Démarrage : un compte qui a rejoint une famille (ou un enfant) saute l'accueil sans interroger le serveur.
- Serveur : les rendez-vous de la semaine pour le placement et les dates de rendez-vous utilisent les jours de Paris (`lib/cervelle/days.ts`) au lieu de l'heure UTC de Render.

## Argent de poche automatique (19/11/2026)

- Modèles `PocketMoneyRule` (une par compte enfant : montant, `weekly` jour 0–6 ou `monthly` jour 1–28, `startDay`) et `PocketMoneyCredit` (`auto` ou `manual`, jour de Paris). Migration `20261119080000_pocket_money`. Logique : `server/src/lib/pocketMoney.ts`.
- **Pas de tâche programmée** : les versements dus sont créés à la lecture (`catchUpPocketMoney`, verrou `pg_advisory_xact_lock` contre les doublons, 60 au plus d'un coup). Une nouvelle règle commence le lendemain.
- Routes `/pocket-money` : `GET` (règle + prochain versement, 50 derniers versements, reçu / dépensé = toutes ses dépenses / reste), `PUT|DELETE /rule`, `POST /credits` (ponctuel), `DELETE /credits/:id`. Compte visé = `req.privateId` (l'enfant lui-même, ou un adulte avec `X-Child-Space`) ; seul un adulte écrit (garde enfant).
- Appli : carte « Mon argent de poche » / « Argent de poche de Jules » en haut du Budget (`PocketMoneyCard`), écran `app/pocket-money.tsx` (réglage semaine/mois + jour, versement ponctuel, historique, appui long pour retirer côté parent). Téléphone de l'enfant : notification locale à 9 h les 4 prochains jours de versement (`syncPocketMoneyNotifications`).

## Filtre du Planning par membre (22/11/2026)

- Sous la barre des jours : puces « Tous » + un prénom par membre (plusieurs au choix). Montre les tâches des membres choisis **et** celles sans « Pour qui » ; tout cocher revient à « Tous ». L'anneau du jour compte les tâches filtrées.
- 2e rangée : « Toutes » + les 5 catégories (École, Travail, Maison, Santé, Loisirs), combinée avec les prénoms (Jules + École = l'école de Jules). Gardée aussi sur le téléphone.
- Gardé sur le téléphone (`src/state/planningFilterStore.ts`, AsyncStorage) ; logique dans `src/lib/planningFilter.ts` (membres supprimés ignorés). JS seulement.

## Quota GitHub Actions (23/11/2026)

- En novembre 2026, les 2 000 minutes gratuites (dépôt privé) ont été épuisées : tous les jobs échouaient sans démarrer (« recent account payments have failed or your spending limit needs to be increased »). Le quota revient le 1er de chaque mois.
- Allègement : tests seulement sur les PR concernées, plus de passage sur `main`, APK seulement à la main. Replanifier exclut aussi les tâches cochées faites cette semaine (#85).

## École et Travail ne se cochent pas (23/11/2026)

- Sur le Planning, les tâches École et Travail (rendez-vous compris) n'ont plus de rond « fait » : un cartable ou une mallette à la couleur de la catégorie à la place. L'anneau du jour ne compte que les tâches à cocher et n'apparaît pas s'il n'y en a aucune.
- `isCheckable` dans `mobile/src/lib/planningFilter.ts` ; le serveur refuse `PUT /tasks/:id/done` pour ces catégories (400).
- Publication des mises à jour sans GitHub Actions : depuis une session Claude, jeton Expo en « Network secret » (api.expo.dev) de l'environnement « Passerelle et Cervelle », puis `eas update --channel preview --environment preview --platform android` (après `eas init --force` + `node scripts/configure-updates.js`, sans committer app.json).

## Audit du 25/11/2026 — lot 1 (sécurité serveur)

- Rapport : https://claude.ai/artifact/4wumq59boxiCt4mnuVrXRV
- L'« Espace de l'enfant » (en-tête `X-Child-Space`) est réservé aux comptes propriétaire et accès complet ; un accès « planning » reçoit 403 `child_space_forbidden`.
- `compression` 1.8.2 (faille de fuite mémoire corrigée).
- `/cervelle` : le corps de 40 Mo n'est lu que pour un appelant identifié (`middleware/cervelleBody.ts`), sinon 100 ko. Les erreurs de lecture du corps répondent 413/400 au lieu de 500.
- Ancien lien de partage « toute la famille » (`/share/public/:token`) supprimé ; `GET /share` ne renvoie plus que `sharedWith`. Restent les liens par membre (révocables).
- `/auth/refresh` : deux renouvellements simultanés → 200 et 401 (plus de 500). Codes à 6 chiffres : l'essai est compté avant la vérification.
- Migration `20261125090000_user_indexes` : index `userId` sur 8 tables.

## Un menu par semaine (25/11/2026)

- `Meal.week` (lundi « AAAA-MM-JJ ») : chaque semaine a son propre menu (unique `userId, week, weekday, type`). Migration `20261125170000_weekly_meals` : les menus existants deviennent ceux de la semaine en cours. Sans `week`, les routes prennent la semaine en cours (anciennes versions de l'appli).
- `POST /meals/generate` (avec `week`) envoie à Claude les plats des 2 semaines d'avant et d'après (`recent`, bloc `<menus_des_semaines_voisines>`) pour ne pas les reproposer ; seule exception, une recette de la famille si « utiliser mes recettes » = souvent.
- Appli : flèches ‹ › dans Repas → Menu (`src/state/menuWeekStore.ts`, composant `WeekNav` partagé avec le Planning). Semaine vide : bouton « Proposer les menus de la semaine ». La proposition, l'enregistrement et « Ajouter le menu … » aux courses suivent la semaine affichée.

## Audit — lot 2 (confort de l'appli, 25/11/2026)

- Textes d'aide passés de 11 à 12 dans les écrans (les composants compacts — carte de tâche, barre des jours, étiquettes, onglets — gardent 11).
- Lecteurs d'écran : champs date/heure nommés (« Date : 25 nov. »), fonds de fenêtres = « Fermer », contenus de fenêtres non annoncés comme bouton. Le `Pressable` de `Touchable.tsx` annonce déjà « bouton » par défaut.
- `src/api/client.ts` : délai max 1 min en lecture, 3 min en écriture (IA), puis message « hors connexion ».
- Rafraîchissement auto : planning, coches et courses chaque minute ; membres, menus, notes et comptes partagés toutes les 5 minutes.

## Audit — lot 3 (finitions, 25/11/2026)

- Accès aux agendas Google/Outlook chiffrés en base (`server/src/lib/secretBox.ts`, AES-256-GCM, clé dérivée de `JWT_ACCESS_SECRET` : changer ce secret oblige à reconnecter les agendas). Les anciennes clés en clair sont chiffrées à leur première utilisation.
- Connexion d'un agenda : l'appli demande un ticket à usage unique (`POST /calendar/:provider/ticket`, 2 min), plus de session dans l'adresse ; l'« état » OAuth est gardé en base 10 min (table `OAuthTicket`, migration `20261125180000_oauth_tickets`) et survit à un redémarrage. `?token=` reste accepté pour les anciennes versions.
- Suppression du compte : mot de passe **ou** code reçu par e-mail (`DELETE /auth/me` avec `emailCode`, code demandé par `POST /auth/email-code`) ; bouton « Pas de mot de passe ? Recevoir un code par e-mail » dans Confidentialité.

## Revue design et code (26/11/2026)

- Rapport : https://claude.ai/artifact/5RS6CDb1Ddtyen2Vt4XfXn · visuels Play Store (8 captures 1080×1920 + bannière 1024×500) dans `docs/play-store/`.
- Onglet **Budget** (plus « Comptes ») : sous-onglets « Mon budget » (`src/screens/MonthlyBudgetBody.tsx`, l'ancien écran du budget du mois avec Bilan, Épargne, Prélèvements, Import de relevé) et « Partagés » (groupes). `/budget?tab=partages` ouvre les groupes. « Comptes de la famille » devient « Accès à l'appli ».
- Accueil (`src/lib/today.ts`) : les plafonds ne comparent que les catégories plafonnées (« N plafond(s) dépassé(s) » / « Reste … ») ; le soir, « Plus rien de prévu · N à cocher » tant que tout n'est pas coché.
- Serveur : avances d'argent de poche réservées au propriétaire / accès complet ; lien public d'un groupe archivé en lecture seule ; remboursement d'avance sous verrou (cagnotte jamais négative) ; photo de ticket `photoPending` (montrée une fois arrivée dans le stockage, oubliée après 1 h, migration `20261126090000_split_photo_pending`) ; agenda illisible (secret changé) → connexion retirée.
- Appli : carte de tâche avec action TalkBack « Marquer comme faite », durée sur une ligne, avatars moins serrés, jours annoncés comme onglets, « Petit-déjeuner », « Ajouter les ingrédients du menu … ». Version web : widgets et notification d'ouverture seulement sur Android (sert aux captures).

## Fiche Play Store (27/11/2026)

- Textes, catégorie, sécurité des données, classification : `docs/play-store/fiche.md` et https://claude.ai/artifact/3jxzD5tbXzps7nUK6gHhUK ; visuels dans `docs/play-store/`.
- Politique de confidentialité : « Sorties & idées » (Claude, Open-Meteo) et section « Supprimer mon compte » (`#suppression`, lien web exigé par Google) ; republiée.
- Compte de démo pour les testeurs de Google créé sur le serveur de production : testeur.google@passerelle-demo.fr (mot de passe transmis à l'utilisatrice, pas dans le dépôt).
- L'environnement Claude « Passerelle et Cervelle » autorise appli-planning-familial-0lyd.onrender.com (Node : `NODE_USE_ENV_PROXY=1`).

## Textes et paramètres (27/11/2026)

- Relecture des textes : https://claude.ai/artifact/Am2TrHeE6aKX8pkU96S35M (tout appliqué). Plus aucun message en anglais : serveur traduit (« Not found » → « Introuvable… », jetons, achats…), zod en français (`z.config(z.locales.fr())` dans `server/src/index.ts`), et filet côté appli `isTechnical()` (`mobile/src/lib/errors.ts`) qui remplace tout message technique par le message habituel. Exception gardée : « Vous avez déjà un défi cette semaine. » (Cervelle, s'adresse aux deux amis).
- Premiers pas : accroche « Toute la famille organisée au même endroit », champ « Prénom », aide « Moins de 15 ans ? », « Me connecter » (code enfant), « Activer les notifications » / « Plus tard ». Le « + » propose « Dépense du mois » et « Dépense partagée ». « Google Agenda », « Calendrier du téléphone » sur Android.
- `mobile/app.json` : autorisations en tutoiement, micro bloqué (`microphonePermission: false`, `blockedPermissions` RECORD_AUDIO), **runtimeVersion 9** → nouvel APK nécessaire (les APK en runtime 8 ne reçoivent plus les mises à jour).
- CLAUDE.md complété (onglets, serveur, publication Expo depuis une session, Play Store, règles de textes) ; environnement Claude « Passerelle et Cervelle » : description à jour, script d'installation existant vérifié.
