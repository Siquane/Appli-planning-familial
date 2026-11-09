# Résumé de projet — Appli planning familial (Passerelle)

À lire en premier dans une nouvelle session. Ce fichier remplace l'historique des conversations précédentes.
Dernière mise à jour : 9 novembre 2026.

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
- **Serveur** : Render, service `appli-planning-familial`, dossier racine `server`, offre gratuite (mise en veille, premier appel lent). `https://appli-planning-familial.onrender.com/health` répond `{"ok":true}`.
- **R2** : configuré (5 variables `S3_*` dans Render).
- **Appli mobile** : Android uniquement. Compilation via GitHub Actions « EAS Build (Android preview) » (bouton Run workflow), secret `EXPO_TOKEN` ajouté. L'APK pointe vers l'URL Render (voir `mobile/eas.json`).

## En cours au moment de ce résumé

- Branche `claude/appli-planning-familial-setup-1cljht`, **pas encore fusionnée dans `main`** :
  - workflow EAS passé à Node 22 (eas-cli refuse Node 20) ;
  - guide de déploiement corrigé (`server` au lieu de `app/server`) ;
  - dépendances mises à jour (versions compatibles uniquement) ;
  - ce fichier.
  → Ouvrir une pull request vers `main` et la fusionner, sinon « Run workflow » depuis `main` échoue encore.
- Premier APK en cours de fabrication chez Expo (lancé depuis cette branche). Ensuite : installer sur les téléphones et tester (compte, budget, documents, pièces jointes de recette).

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
