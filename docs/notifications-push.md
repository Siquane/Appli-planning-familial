# Activer les alertes « quelqu'un a modifié le planning » (Android)

Le serveur et l'appli sont prêts. Il manque Firebase, le service de Google qui
fait arriver les notifications sur les téléphones Android. Sans lui, l'appli
fonctionne normalement mais ne reçoit pas ces alertes. Environ 15 minutes,
gratuit, à faire une seule fois.

## 1. Créer le projet Firebase

1. Aller sur https://console.firebase.google.com et se connecter avec un compte Google.
2. « Créer un projet » → nom : `Passerelle` → Google Analytics : **désactivé** → Créer.
3. Dans le projet, cliquer sur l'icône **Android** (« Ajouter une application »).
4. Nom du package Android : `app.passerelle.mobile` (le même que `android.package` dans `mobile/app.json`).
5. « Enregistrer l'application », puis **télécharger `google-services.json`**.
6. Passer les étapes suivantes (« Suivant », « Continuer vers la console »).

→ Envoyer le fichier `google-services.json` à Claude dans la session : il l'ajoute
à l'appli (`mobile/google-services.json`, `android.googleServicesFile` dans
`app.json`) et passe `runtimeVersion` à "7". Ce fichier n'est pas un secret
(il est inclus dans l'APK).

## 2. Donner à Expo la clé d'envoi

1. Dans Firebase : roue dentée ⚙ → **Paramètres du projet** → onglet **Comptes de service**.
2. « Générer une nouvelle clé privée » → un fichier `.json` se télécharge.
   **Celui-là est secret** : ne pas l'envoyer dans la conversation ni le mettre dans le dépôt.
3. Aller sur https://expo.dev/accounts/siquanes-team/projects/passerelle/credentials
4. Android → `app.passerelle.mobile` → **FCM V1 service account key** → « Add a service account key » → choisir le fichier.

## 3. Nouvel APK

Une fois la PR Firebase fusionnée : GitHub → Actions → « EAS Build (Android preview) »
→ Run workflow, puis installer l'APK. Chaque compte doit avoir autorisé les
notifications ; l'interrupteur se trouve dans Notifications → « Modifications
de la famille » (visible quand plusieurs comptes partagent la famille).
