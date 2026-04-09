# Guide de Déploiement — Mozart Café

## Vue d'ensemble
Ce projet est une copie du système Menu Café Demo, renommée et adaptée pour **Mozart Café**.
Il utilise les mêmes technologies :
- **Firebase** (Realtime Database + Cloud Messaging)
- **Vercel** (hébergement + fonctions serverless)
- **PWA** (Progressive Web App installable sur Android)

---

## Étape 1 — Créer les comptes (tous gratuits)

| Service | URL | Usage |
|---------|-----|-------|
| Gmail | gmail.com | Compte de base pour tout |
| GitHub | github.com | Héberger le code |
| Firebase | console.firebase.google.com | Base de données + notifications |
| Vercel | vercel.com | Héberger le site web |

---

## Étape 2 — Firebase

1. Aller sur https://console.firebase.google.com
2. **Créer un nouveau projet** (ex: `mozart-cafe`)
3. Dans **Project Settings** (icône roue dentée) → onglet **General** :
   - Cliquer **Add app** → choisir **Web** (`</>`)
   - Donner un nom (ex: `Mozart Café Menu`)
   - **Copier la config** qui ressemble à :
   ```js
   apiKey: "AIza...",
   authDomain: "mozart-cafe-xxxxx.firebaseapp.com",
   projectId: "mozart-cafe-xxxxx",
   storageBucket: "mozart-cafe-xxxxx.firebasestorage.app",
   messagingSenderId: "123456789",
   appId: "1:123456789:web:abcdef"
   ```

4. Dans **Project Settings** → onglet **Cloud Messaging** :
   - Section **Web Push certificates** → cliquer **Generate key pair**
   - **Copier** la clé VAPID (commence par `B...`)

5. Dans **Build** → **Realtime Database** :
   - Cliquer **Create Database**
   - Choisir région **europe-west1**
   - Commencer en **test mode** (règles permissives pour débuter)
   - **Copier** l'URL : `https://mozart-cafe-xxxxx-default-rtdb.europe-west1.firebasedatabase.app`

6. Dans **Project Settings** → onglet **Service accounts** :
   - Cliquer **Generate new private key**
   - Sauvegarder le fichier JSON (sera utilisé à l'étape Vercel)

---

## Étape 3 — Remplacer les placeholders dans le code

Remplacer `YOUR_FIREBASE_API_KEY`, `YOUR_PROJECT_ID`, etc. dans **tous ces fichiers** :

| Fichier | Ce qu'il faut remplacer |
|---------|------------------------|
| `index.html` | Firebase config (lignes ~738-747) |
| `app.html` | Firebase config + VAPID_KEY (lignes ~182-194) |
| `admin.html` | Firebase config (lignes ~405-414) |
| `firebase-messaging-sw.js` | Firebase config (lignes ~14-21) |
| `manifest.json` | `gcm_sender_id` = votre `messagingSenderId` |

**Valeurs à remplacer :**
```
YOUR_FIREBASE_API_KEY        → votre apiKey
YOUR_PROJECT_ID              → votre projectId (ex: mozart-cafe-xxxxx)
YOUR_MESSAGING_SENDER_ID     → votre messagingSenderId
YOUR_FIREBASE_APP_ID         → votre appId
YOUR_VAPID_KEY               → la clé VAPID de Cloud Messaging
```

---

## Étape 4 — GitHub

1. Aller sur https://github.com → **New repository**
2. Nom : `mozart-cafe-menu` (public ou privé)
3. Uploader tous les fichiers du dossier `Menu Mozart Café`

---

## Étape 5 — Vercel

1. Aller sur https://vercel.com → **New Project**
2. **Importer** le repository GitHub
3. **Variables d'environnement** → Ajouter :
   - Name : `FIREBASE_SERVICE_ACCOUNT`
   - Value : **coller tout le contenu** du fichier JSON de compte de service (étape 2.6)
4. Cliquer **Deploy**

---

## Étape 6 — Personnaliser le contenu

### Mot de passe admin
Dans `admin.html`, ligne ~518 :
```js
const ADMIN_PASSWORD = 'mozart2026';  // ← Changer ici
```

### Adresse et horaires
Dans `index.html`, chercher `YOUR_STREET_ADDRESS` et `VOTRE_ADRESSE` et remplacer par vos vraies informations.

### WiFi
Dans `index.html`, chercher `MozartCafe_Guest · Mozart2026` et remplacer.

---

## Étape 7 — Installer l'app sur les téléphones du personnel

1. Ouvrir `https://votre-site.vercel.app/app.html` sur Chrome Android
2. Menu Chrome → **Ajouter à l'écran d'accueil**
3. Accepter les **notifications** quand demandé
4. L'app reçoit les notifications même quand elle est fermée

---

## Fichiers du projet

```
Menu Mozart Café/
├── index.html          ← Menu digital (vue clients)
├── app.html            ← App serveur (notifications)
├── admin.html          ← Panneau d'administration
├── firebase-messaging-sw.js  ← Service Worker FCM
├── service-worker.js   ← Service Worker cache offline
├── manifest.json       ← Config PWA
├── icon.svg            ← Icône note de musique
├── icon-maskable.svg   ← Icône maskable (Android)
├── vercel.json         ← Config routing Vercel
└── api/
    └── notify.js       ← Fonction serverless (envoi FCM)
```

---

## Notes importantes

- Le **mot de passe admin** par défaut est `mozart2026` — **à changer immédiatement**
- Les **clés Firebase** dans le code frontend sont publiques (normal pour Firebase)
- La **clé de compte de service** (JSON) ne doit JAMAIS être dans le code — elle est uniquement dans les variables Vercel
- Pour générer un APK Android : https://www.pwabuilder.com (entrer l'URL Vercel)
