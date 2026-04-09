/* ============================================================
   CONFIGURATION MOZART CAFÉ
   ✅ NE MODIFIER QUE CE FICHIER pour connecter Firebase
   ============================================================

   Instructions :
   1. Créer un projet Firebase sur https://console.firebase.google.com
   2. Copier les valeurs de configuration ici
   3. Sauvegarder — c'est tout !
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID",
  databaseURL:       "https://VOTRE_PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app"
};

/* Clé VAPID pour les notifications push
   Firebase Console → Project Settings → Cloud Messaging → Web Push certificates */
const VAPID_KEY = "VOTRE_VAPID_KEY";
