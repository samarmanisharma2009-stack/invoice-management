// ==========================================================================
// firebase-config.js — Firebase initialization
//
// This file initializes the Firebase app, Firebase Authentication, and
// Cloud Firestore for use across the entire application.
//
// IMPORTANT:
// - The values below are the Firebase Web configuration values from the
//   Firebase Console (Project Settings > General > Your apps > Web app).
// - These values are safe to expose in frontend code. They identify your
//   Firebase project; they are NOT secret credentials.
// - Do NOT put Firebase service-account private keys, database admin
//   credentials, or any other server-side secrets in this file or anywhere
//   in frontend JavaScript.
// - Actual data security comes from Firebase Authentication (who you are)
//   and Firestore Security Rules (what you're allowed to do), not from
//   hiding this configuration.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Replace these placeholder values with the configuration values from
// your own Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyBLsqViNKWm9DgpKr2u9crAiNkDT9A_34E",
  authDomain: "cs50-69ec4.firebaseapp.com",
  projectId: "cs50-69ec4",
  storageBucket: "cs50-69ec4.firebasestorage.app",
  messagingSenderId: "1051363444911",
  appId: "1:1051363444911:web:71309a5d94617085196c5a"
};

// Initialize Firebase app, Authentication, and Firestore once, and export
// them so every other module can import the same instances.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
