# Passerelle

Appli de planning familial (Android) : tâches et rendez-vous de la semaine, repas et courses, budget, documents, notes, étoiles des enfants. Une famille partage les mêmes données entre plusieurs comptes ; les enfants de 8 à 14 ans ont un accès créé par un parent.

- `mobile/` : appli Expo SDK 58 / React Native 0.88 (expo-router), widgets Android, mises à jour sans APK par EAS Update.
- `server/` : API Express 5 + Prisma 7 (Postgres Neon), hébergée sur Render.
- `docs/` : politique de confidentialité, guides (notifications push, achats Android), programmes scolaires de Cervelle.
- `project/` et `chats/` : maquettes HTML d'origine (Claude Design, « Rythmo App ») et la conversation de conception, gardées comme référence visuelle.
- `assets/brand/` : logo Passerelle.

**À lire en premier : [`RESUME-PROJET.md`](RESUME-PROJET.md)** (état actuel, décisions, conventions, historique).

## Développement

```bash
# Serveur (Postgres local requis)
cd server && npm install && npm run typecheck && npm test

# Appli
cd mobile && npm install --legacy-peer-deps && npx tsc --noEmit && npx jest
```

- Toute modification passe par une PR vers `main`. À la fusion : tests GitHub, déploiement Render, publication EAS Update (canal `preview`).
- Changement natif (module, widget, `app.json`) : augmenter `runtimeVersion` dans `mobile/app.json` et compiler un APK avec le workflow « APK sur GitHub ».
