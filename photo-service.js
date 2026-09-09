// photo-service.js
// ---------------------------------------------------------------------------
// Shared data layer used by home.js, gallery.js, and admin.js.
// Keeps Firestore + Cloudinary logic in one place so all three pages stay
// in sync automatically.
// ---------------------------------------------------------------------------

import { db } from "./firebase-config.js";
import { CLOUDINARY_CONFIG } from "./cloudinary-config.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
export const COLLECTION_NAME = "photos";

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

// ---------------------------------------------------------------------------
// Formatting / validation helpers
// ---------------------------------------------------------------------------

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Invalid file type. Please choose a JPG, PNG, WEBP, or GIF image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`;
  }
  return null;
}

export function friendlyError(error) {
  console.error("Error:", error);
  const message = (error?.message || "").toLowerCase();
  const code = error?.code || "";

  if (code.includes("permission-denied")) {
    return "Permission denied. Check your Firestore security rules.";
  }
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
    return "Incorrect email or password.";
  }
  if (code.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("upload preset") || message.includes("unsigned")) {
    return "Cloudinary upload preset is missing or not set to Unsigned. Check cloudinary-config.js.";
  }
  if (message.includes("cloud_name") || message.includes("cloud name")) {
    return "Cloudinary cloud name is invalid. Check cloudinary-config.js.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check your internet connection and try again.";
  }
  return error?.message || "Something went wrong. See console for details.";
}

// ---------------------------------------------------------------------------
// Cloudinary upload
// ---------------------------------------------------------------------------

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (
      !CLOUDINARY_CONFIG.cloudName ||
      CLOUDINARY_CONFIG.cloudName === "YOUR_CLOUD_NAME" ||
      !CLOUDINARY_CONFIG.uploadPreset ||
      CLOUDINARY_CONFIG.uploadPreset === "YOUR_UNSIGNED_UPLOAD_PRESET"
    ) {
      reject(new Error("Cloudinary is not configured. Set cloudName and uploadPreset in cloudinary-config.js."));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_UPLOAD_URL, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Unexpected response from Cloudinary."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.error?.message || `Cloudinary upload failed (status ${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading to Cloudinary."));
    xhr.send(formData);
  });
}

/**
 * Uploads a file to Cloudinary, then creates a Firestore document for it
 * with status "pending" — it will not appear on the public Home/Gallery
 * pages until an admin approves it.
 */
export async function submitPhoto({ name, file, onProgress }) {
  const result = await uploadToCloudinary(file, onProgress);

  await addDoc(collection(db, COLLECTION_NAME), {
    name,
    url: result.secure_url,
    publicId: result.public_id,
    fileName: file.name,
    fileSize: result.bytes ?? file.size,
    fileType: file.type,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Firestore subscriptions
// ---------------------------------------------------------------------------

/**
 * Public Home/Gallery pages: only approved photos, newest first.
 * Deliberately has no orderBy() alongside the where() filter — combining
 * the two would require a Firestore composite index. Sorting client-side
 * instead avoids that setup step entirely.
 */
export function subscribeApprovedPhotos(onData, onError) {
  const q = query(collection(db, COLLECTION_NAME), where("status", "==", "approved"));
  return onSnapshot(
    q,
    (snap) => {
      const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      photos.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      onData(photos);
    },
    onError
  );
}

/** Admin dashboard: every photo regardless of status, newest first. */
export function subscribeAllPhotos(onData, onError) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export async function approvePhoto(photoId) {
  await updateDoc(doc(db, COLLECTION_NAME, photoId), { status: "approved" });
}

/**
 * Removes the Firestore document (and therefore the photo from the app).
 * Note: this does NOT delete the underlying file from Cloudinary — unsigned
 * uploads can only be deleted with a signed, server-side request using your
 * Cloudinary API secret, which must never be exposed in frontend code. See
 * SETUP_GUIDE.md for details and options.
 */
export async function deletePhoto(photoId) {
  await deleteDoc(doc(db, COLLECTION_NAME, photoId));
}
