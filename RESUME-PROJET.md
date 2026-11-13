# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 13 novembre 2026 (fin d'après-midi, PR #11 fusionnée).

## ⚠️ Point de reprise (13/11/2026, fin de session) — à lire d'abord

- **PR #11 fusionnée dans `main`** le 13/11 à la demande de l'utilisatrice (branche `claude/appli-planning-familial-setup-1cljht`) : Expo SDK 58, 4 widgets Android, Sentry, aperçus/exemples de widgets, liens widget → bon écran, Planning aéré, nom modifiable dans le profil (`PATCH /auth/me`), dépendances à jour. `main` (PR #12, #13, #14, #15) y avait été fusionné avant ; tests verts (serveur 103, appli 96).
- **`runtimeVersion` "3"** sur `main` désormais : les mises à jour publiées ne visent plus que les APK "3".
- **APK de test de la PR #11** (runtime "3", compilé depuis la branche, sans les tout derniers changements JS qui arriveront par mise à jour après fusion) : https://expo.dev/accounts/siquanes-team/projects/passerelle/builds/541514d0-0b8f-4289-b02a-c78da8d7119e
- **À faire, dans l'ordre** :
  1. L'utilisatrice teste cet APK (widgets : aperçu, exemple quand vide, appui → bon écran ; Planning ; Profil → nom). Si « Application non installée » : désinstaller l'ancienne appli d'abord (voir « APK actuel et installation »).
  2. Corriger ce qu'elle signale (par PR, petites mises à jour JS sans nouvel APK).
  3. Lancer « EAS Build (Android preview) » **depuis main** pour l'APK définitif runtime "3" ; vérifier que « EAS Update » a publié ; Render redéploie le serveur (route `PATCH /auth/me`).
  4. Ensuite (PR séparée) : mises à jour majeures du serveur (Prisma 7, Express 5…), voir « État des dépendances ».
- **Attention aux sessions parallèles** : plusieurs sessions ont fusionné dans main pendant que la #11 était ouverte (conflits sur `package-lock.json`, `app.json`/`runtimeVersion`, `CustomTabBar`). Avant de pousser : `git fetch origin main` et fusionner main ; ne jamais redescendre `runtimeVersion`.
- Sentry actif (DSN dans `mobile/src/lib/sentry.ts`, organisation `siquanelab`, serveurs UE).
- Sauvegarde hebdomadaire : workflow prêt, **5 secrets GitHub encore à ajouter** par l'utilisatrice (voir « Améliorations sans nouvel APK »).
- cron-job.org (garder Render éveillé, `/health` toutes les 10 min) : à faire par l'utilisatrice si ce n'est pas déjà fait.

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

Ensuite, à part : mises à jour majeures du serveur (Prisma 7, Express 5).

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

## APK actuel et installation (13/11/2026)

- **APK à installer** (runtime "3" : Expo SDK 58, widgets, Sentry, style Passerelle) : https://expo.dev/accounts/siquanes-team/projects/passerelle/builds/541514d0-0b8f-4289-b02a-c78da8d7119e
- Liens périmés, à ne plus utiliser : `5a8ba245…` (runtime "1") et `c5add826…` (runtime "2", sessions parallèles du 13/11). Ils ne reçoivent plus de mises à jour.
- Problème rencontré : « Application non installée » en installant par-dessus une ancienne version (signature différente probable). Solution : **désinstaller l'ancienne appli d'abord**, puis installer. Les données sont sur le serveur ; il faut se reconnecter et réactiver les notifications.
- Ce qui a été ajouté après la compilation de cet APK (bol de l'onglet Repas, nom modifiable dans le profil, dépendances) arrive par EAS Update **une fois la PR #11 fusionnée** (les mises à jour ne sont publiées que depuis main) : fermer puis rouvrir l'appli une fois.
- À confirmer : l'installation a-t-elle réussi ? Le halo des onglets rend-il bien sur le téléphone (jamais vu sur un vrai appareil) ?
- Éviter les sessions en parallèle sur l'appli : le 13/11, trois sessions ont produit des APK et des résumés contradictoires.

## Idées notées pour plus tard

Comptes séparés pour chaque membre de la famille, synchronisation Google Agenda, statistiques du budget sur 12 mois, étoiles pour les tâches des enfants, idées cadeaux d'anniversaire, liste de courses en temps réel, thème clair, version iPhone (99 €/an).

## Dépendances et mises à jour (12–13/11/2026)

- **Faites** : zod 3 → 4, vitest 2 → 5 (+ vite 8), googleapis 189, msal-node 7 (PR #7) ; mises à jour sûres serveur et app (PR #13) ; Expo SDK 58 (PR #11), qui corrige aussi les alertes « high » d'`expo-router`. `engines.node >= 22` dans `server/package.json`.
- **Règle zod 4** : ne jamais écrire `schema.partial()` pour une route PATCH (les `.default()` s'appliquent quand même et réinitialisaient les champs absents). Utiliser `patchSchema(schema)` (`server/src/lib/validation.ts`), déjà en place sur toutes les routes PATCH ; test de non-régression dans `tests/routes/members.test.ts`.

- Serveur : à jour dans les versions actuelles (`npm update`), `npm audit` : 0 faille. Déjà faits : zod 4, vitest 5.
- Appli : alignée sur la liste Expo SDK 58 (sauf async-storage gardé en v3, qui fonctionne). `npm audit fix` appliqué ; il reste des alertes faibles/moyennes uniquement dans les outils de test (chaîne jest-expo / jest 29), qui ne partent pas dans l'APK. Elles disparaîtront avec jest 30 quand jest-expo le prendra en charge.
- Mises à jour majeures encore à faire (demandent du code, PR dédiée) : Prisma 5 → 7, Express 4 → 5 (+ `@types/express` 5, express-rate-limit 8), TypeScript 5 → 7 (serveur) et 6 → 7 (appli), dotenv 18, bcryptjs 3, nanoid 6, `@types/node` 26.
- Appli, à suivre au prochain APK : `@sentry/react-native` 8.35 (la liste SDK 58 indique 8.28), gesture-handler 3.5. Ne pas les monter sans nouveau `runtimeVersion` (modules natifs).

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
