# Mettre en place les abonnements sur Android

L'appli vend 3 abonnements (pack Budget, pack Menus, Les 2) via **Google Play**, gérés par **RevenueCat**.
Le code est prêt : il reste à créer les produits et à brancher les clés. Compter une à deux heures, plus les délais de Google.

À faire dans cet ordre.

---

## 1. Google Play Console : l'appli et le test fermé

1. Play Console → **Créer une application** (nom, langue français, appli, gratuite).
2. Construire l'appli pour le Play Store :
   ```bash
   cd mobile
   eas build --platform android --profile production
   ```
   (profil `production` de `eas.json` : fichier `.aab`, numéro de version incrémenté automatiquement).
3. Play Console → **Tests → Test fermé** → créer une piste, importer le `.aab`, ajouter tes testeurs (adresses Gmail).
   - Compte développeur personnel récent : Google demande **au moins 12 testeurs pendant 14 jours** avant de pouvoir publier en production. Lance-le tôt.
4. **Monétisation → Profil de paiement** : le compléter (obligatoire pour vendre).

> Les abonnements ne peuvent être créés qu'une fois qu'une version contenant la facturation (le module RevenueCat) a été importée. C'est le cas de ce build.

## 2. Play Console : les 6 abonnements

**Monétiser → Produits → Abonnements**, créer :

| ID du produit (à respecter) | Forfait de base | Prix proposé |
|---|---|---|
| `budget_monthly` | mensuel, renouvelable | 1,99 € |
| `budget_annual` | annuel, renouvelable | 14,99 € |
| `meals_monthly` | mensuel, renouvelable | 2,99 € |
| `meals_annual` | annuel, renouvelable | 19,99 € |
| `both_monthly` | mensuel, renouvelable | 3,99 € |
| `both_annual` | annuel, renouvelable | 29,99 € |

Les IDs peuvent être différents, mais ils ne sont plus modifiables ensuite : garder une logique claire. Activer chaque forfait de base.

## 3. Relier Google Play à RevenueCat

1. Créer un compte sur [revenuecat.com](https://www.revenuecat.com) (gratuit jusqu'à 2 500 $ de revenus/mois) → **nouveau projet**.
2. **Ajouter une appli Google Play**, nom du package : `app.passerelle.mobile`.
3. Suivre leur guide « Service Account credentials » : créer un compte de service Google Cloud, lui donner l'accès dans la Play Console (**Utilisateurs et autorisations**), téléverser le fichier JSON dans RevenueCat. La validation peut prendre jusqu'à 36 h côté Google.

## 4. RevenueCat : droits, produits, offres

**Product catalog** :

1. **Entitlements** (droits) : créer exactement `budget` et `meals`.
2. **Products** : importer les 6 abonnements depuis Google Play, puis les rattacher :
   - `budget_monthly`, `budget_annual` → droit `budget`
   - `meals_monthly`, `meals_annual` → droit `meals`
   - `both_monthly`, `both_annual` → droits `budget` **et** `meals`
3. **Offerings** (offres) : créer exactement `budget`, `meals` et `both`. Dans chacune, ajouter un package **Monthly** et un package **Annual** avec les produits correspondants.

Les noms `budget`, `meals`, `both` (droits et offres) sont utilisés par le code : ne pas les changer.

## 5. Les clés

**RevenueCat → API keys** :

- **Clé publique Android** (commence par `goog_`) → dans `mobile/eas.json`, ajouter dans `env` des profils `preview` et `production` :
  ```json
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "goog_xxxxxxxx"
  ```
  Elle n'est pas secrète (elle est dans l'appli). Sans elle, l'écran Premium affiche « L'abonnement arrive bientôt ».
- **Clé secrète** (commence par `sk_`) → sur **Render**, variable `REVENUECAT_SECRET_KEY`. Elle est secrète : jamais dans le code.

**RevenueCat → Integrations → Webhooks** :

- URL : `https://<ton-service>.onrender.com/billing/revenuecat`
- **Authorization header** : une valeur au hasard, par exemple `Bearer ` suivi de `openssl rand -hex 24`
- Sur Render, `REVENUECAT_WEBHOOK_AUTH` = **exactement** la même valeur (avec `Bearer `).

Puis refaire un build (`eas build --platform android --profile production`) et l'importer dans le test fermé.

## 6. Tester sans payer

- Play Console → **Paramètres → Test des licences** : ajouter ton adresse Gmail. Tes achats seront fictifs, et les abonnements se renouvellent toutes les quelques minutes pour tester.
- Installer l'appli **depuis le lien du test fermé** (pas depuis un APK) : la facturation Google ne fonctionne qu'avec une appli installée par le Play Store.
- Vérifier : acheter un pack → il s'active tout de suite (l'appli prévient le serveur) ; dans RevenueCat, le client apparaît avec l'id du compte ; « Restaurer mes achats » fonctionne après réinstallation.

## Comment ça marche

- L'appli identifie le client RevenueCat avec l'id du compte. Après un achat ou une restauration, elle appelle `POST /billing/sync` : le serveur lit les droits chez RevenueCat et met à jour `budgetUntil` / `mealsUntil`.
- À chaque événement (renouvellement, résiliation, expiration, remboursement…), RevenueCat appelle le webhook et le serveur relit les droits. C'est RevenueCat qui fait foi : un pack qu'il n'accorde plus est retiré, y compris une date posée à la main avec `npm run premium`.
- Passer d'un pack à « Les 2 », ou de mensuel à annuel, **remplace** l'abonnement Google Play au lieu d'en ajouter un deuxième. Prendre l'autre pack seul **s'ajoute**.
- Pour offrir un pack à un testeur une fois RevenueCat en place, utiliser **« Grant entitlement »** dans RevenueCat plutôt que `npm run premium`.

## Plus tard : iPhone

Créer les mêmes abonnements dans App Store Connect, les relier dans RevenueCat aux mêmes droits et offres, puis ajouter `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (clé `appl_…`) dans `eas.json`. Le code de l'appli est déjà prévu pour.
