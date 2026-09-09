// firebase-config.js
// ---------------------------------------------------------------------------
// Firebase configuration & initialization
// ---------------------------------------------------------------------------
// This app only uses Firestore now (for photo metadata). Image files are
// uploaded to Cloudinary instead of Firebase Storage — see
// cloudinary-config.js — because Cloudinary's free tier requires no billing
// account, while Firebase Storage now requires the Blaze (pay-as-you-go)
// plan even for small amounts of data.
//
// Firestore itself remains free on Firebase's Spark plan (no card required):
// 1 GiB storage, 50K reads/day, 20K writes/day, 20K deletes/day.
//
// Replace the placeholder values below with the values from your own
// Firebase project. You can find them in:
//
//   Firebase Console → Project settings (gear icon) → General tab →
//   "Your apps" → Web app → SDK setup and configuration → "Config"
//
// Field-by-field guide:
//   apiKey            -> "apiKey" in the same config object
//   authDomain        -> "authDomain" (usually YOUR_PROJECT_ID.firebaseapp.com)
//   projectId         -> "projectId" (your Firebase project ID)
//   storageBucket     -> "storageBucket" (not used by this app, but Firebase
//                        still expects the field to be present)
//   messagingSenderId -> "messagingSenderId"
//   appId             -> "appId"
//
// NEVER put a service-account key or Admin SDK credentials here. This file
// only ever contains the public, client-side Firebase config, which is safe
// to ship to the browser (security is enforced by Firestore rules, not by
// hiding this file).
// ---------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_PnlcdGBfSu1HxDVp8ghXuhRrMlVgpvw",
  authDomain: "webdeveloping-cf083.firebaseapp.com",
  projectId: "webdeveloping-cf083",
  storageBucket: "webdeveloping-cf083.firebasestorage.app",
  messagingSenderId: "1018565415369",
  appId: "1:1018565415369:web:a226426f236c5e2aed9818",
  measurementId: "G-YBTYXJYJWV"
};

const app = initializeApp(firebaseConfig);

// Export a ready-to-use Firestore instance for script.js to consume.
export const db = getFirestore(app);