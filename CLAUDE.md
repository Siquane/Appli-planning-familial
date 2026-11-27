# Passerelle — contexte pour Claude

## Business context

- **Website:** aucun pour l'instant (projet Expo : https://expo.dev/accounts/siquanes-team/projects/passerelle)
- **Brand colors:** fond bleu nuit (#070912), dégradé néon cyan (#22E5FF) → bleu (#3FB8FF) → violet (#9B5CFF), texte blanc bleuté (#E8F4FF) ; cartes #0F1426, filets #1E2740 ; polices Space Grotesk (titres) et Inter (texte)
- **Logo:** assets/brand/logo-passerelle.png (arche à 4 points en dégradé cyan → violet, nom « PASSERELLE » en capitales)
- **Output preference:** visual artifacts

## Projet

- Deux applis Expo (SDK 58, expo-router), un seul serveur :
  - **Passerelle** (`mobile/`) : planning familial, parents et ados.
  - **Cervelle** (dépôt `Siquane/Cervelle`) : révisions des enfants. Ses routes
    serveur sont ici : `server/src/routes/cervelle*.ts`, `server/src/lib/cervelle/`.
- Serveur `server/` : Express + Prisma (Postgres Neon), déployé sur Render à
  chaque fusion dans `main`. IA : Anthropic, modèle `claude-opus-5-5`.
- Mises à jour des applis par EAS Update à la fusion ; APK par le workflow
  `eas-build.yml` (entrée `kind: apk`). Ne jamais redescendre
  `runtimeVersion` (`mobile/app.json`) ; l'augmenter si `package.json` ou
  `app.json` change.
- Le dépôt est **public** : aucun secret dans le code (`.env`, clés, comptes de
  service). Les clés vont dans Render, expo.dev ou les secrets GitHub.
- Historique et état du projet : `RESUME-PROJET.md`.

## Vérifications avant de pousser

- Serveur (dans `server/`) : `service postgresql start`, puis
  `npx prisma generate`, `npm run typecheck` et `npx vitest run`. Les tests
  remettent eux-mêmes à zéro la base locale `passerelle_test`
  (utilisateur et mot de passe : `passerelle`).
- Migrations : avec `DATABASE_URL` sur cette base, `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
  Garder seulement les lignes de ton changement.
- Appli : dans `mobile/`, lancer `npx tsc --noEmit` puis `npx jest`.
- Après un aperçu web (`CI=1 npx expo start --web`), remettre `tsconfig.json`
  avec `git checkout -- tsconfig.json`.

## Façon de travailler

- Réponses en français, tutoiement.
- Avant chaque nouveauté : poser des questions à choix cliquables.
- Fusion automatique dès que les vérifications GitHub sont vertes : d'abord le
  serveur (ce dépôt), puis Cervelle. Méthode « merge ».
- Les enfants (Jules, Edouard) testent avant toute publication sur les stores.
- Effets de mouvement : `mobile/src/components/motion.tsx`, avec l'Animated de
  React Native seulement ; respecter « réduire les animations ».
