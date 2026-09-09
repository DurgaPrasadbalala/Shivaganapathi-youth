// firebase-config.js
// ---------------------------------------------------------------------------
// Firebase configuration & initialization
// ---------------------------------------------------------------------------
// Uses Firestore (photo metadata + moderation status) and Firebase
// Authentication (admin login). Images are hosted on Cloudinary — see
// cloudinary-config.js — because Firebase Storage now requires the paid
// Blaze plan even for small amounts of data. Firestore and Authentication
// both remain free on the Spark plan.
//
// Replace the placeholder values below with your own project's values from:
//   Firebase Console → Project settings (gear icon) → General →
//   "Your apps" → Web app → SDK setup and configuration → "Config"
//
//   apiKey            -> "apiKey"
//   authDomain        -> "authDomain"
//   projectId         -> "projectId"
//   storageBucket     -> "storageBucket" (unused by this app, but keep it)
//   messagingSenderId -> "messagingSenderId"
//   appId             -> "appId"
//
// NEVER put a service-account key or Admin SDK credentials here — this file
// only ever holds the public, client-side config, which is safe to ship to
// the browser (security is enforced by Firestore rules + Auth, not secrecy
// of this file).
// ---------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQ4-If0RuqSNHwGp1LvBo3FS4qYKkIGyc",
  authDomain: "my-project-e26e0.firebaseapp.com",
  projectId: "my-project-e26e0",
  storageBucket: "my-project-e26e0.firebasestorage.app",
  messagingSenderId: "231636533543",
  appId: "1:231636533543:web:2c859e4bd5c4f72d76e902",
  measurementId: "G-6ZVVCYJEC0"
};
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
