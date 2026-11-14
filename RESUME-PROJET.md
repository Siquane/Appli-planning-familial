# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 13 novembre 2026 (soir, reprise de la branche Premium).

## ⚠️ Point de reprise (13/11/2026, soir) — à lire d'abord

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
- **Mises à jour majeures du serveur faites (13/11 soir)** : Prisma 7 (adaptateur `@prisma/adapter-pg`, URL de la base dans `server/prisma.config.ts`, plus dans le schéma ; `migrate diff --to-schema` + `SHADOW_DATABASE_URL` en CI), Express 5, express-rate-limit 8 (`ipKeyGenerator`), TypeScript 7 (`module`/`moduleResolution` = `nodenext`), dotenv 18, bcryptjs 3, nanoid 6, googleapis 190, pdfkit 0.20. `@types/node` gardé en 22 (Node 22 sur Render ; `engines.node >= 22.12`, exigé par Prisma 7). Prisma 7 refuse `db push --force-reset` lancé par une IA sans accord explicite : les tests locaux demandent la variable `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` (texte exact de l'accord de l'utilisatrice) ; la CI n'est pas concernée.
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

## Noms des offres (13/11/2026, soir)

- Les abonnements s'appellent **Repas+** (ex-pack Menus), **Budget+** (ex-pack Budget) et **Passerelle+** (les deux, ex-« Les 2 ») ; l'écran s'intitule « Passerelle+ ». Icônes : toque (`ToqueIcon`) pour Repas+, tirelire (`PiggyBankIcon`) pour Budget+. Les identifiants techniques ne changent pas (`budget`, `meals`, `both`, champs `budgetUntil`/`mealsUntil`).
- Politique de confidentialité : `docs/politique-confidentialite.html`, publiée sur https://claude.ai/artifact/6q5yK3yYE2SmCnZAMqDxmv (à rendre publique par l'utilisatrice, menu Partager). Responsable : Anaïs Guyon, contact Siquane.lab@gmail.com. Lien dans Profil → Confidentialité.

## Fonctionnement sans connexion

- **Lecture** : les dernières données restent sur le téléphone (cache React Query persisté, `src/lib/queryClient.ts`). Une coupure réseau ne déconnecte plus : si le serveur est injoignable pendant le renouvellement de session, la session est gardée (`UnreachableError`).
- **Écriture** : tâches, courses, repas et dépenses (création, modification, suppression) passent par `src/lib/offlineApi.ts` → `writeOrQueue` (`src/lib/outbox.ts`). Sans réponse du serveur, l'écran est mis à jour tout de suite (`offlinePatches.ts`), le changement est gardé dans une file sur le téléphone (`outboxStore`, `outboxQueue.ts`) et envoyé dans l'ordre au retour du réseau. Un élément créé hors connexion a un id temporaire `tmp_…` remplacé par le vrai id dès que le serveur répond ; créer puis supprimer hors connexion n'envoie rien.
- **Conflits** : le dernier changement arrivé l'emporte ; les ajouts sont tous gardés. Un changement que le serveur refuse (déjà supprimé ailleurs) est abandonné avec un message.
- **Réseau** : pas de module natif. Une requête sans réponse marque le téléphone hors connexion (`networkStore`) ; `startOutboxSync` revérifie au retour au premier plan et toutes les 15 s tant que quelque chose attend. Bandeau au-dessus de la barre d'onglets (`OfflineBanner`).
- **Besoin du réseau** (boutons grisés via `Button needsNetwork`) : menus générés, import de relevé, import de recette par lien, enregistrement de recettes et de documents, achats. Le reste (recettes, documents, famille, comptes…) se lit hors connexion mais ne s'écrit pas.

