// cloudinary-config.js
// ---------------------------------------------------------------------------
// Cloudinary configuration
// ---------------------------------------------------------------------------
// Cloudinary's free tier does not require a credit card, and supports
// unsigned uploads directly from the browser — no backend/server needed.
//
// Where to get these two values:
//
//   1. Sign up at https://cloudinary.com (free plan).
//   2. CLOUD_NAME  -> Dashboard home page, top-left "Cloud name" field.
//   3. UPLOAD_PRESET -> Settings (gear icon) → Upload → scroll to
//      "Upload presets" → "Add upload preset":
//        - Signing Mode: UNSIGNED   (required — this is what allows the
//          browser to upload directly without exposing your API secret)
//        - Folder: photos           (optional, keeps things tidy)
//        - Save, then copy the preset's name below.
//
// NEVER put your Cloudinary API Secret in frontend code. Unsigned upload
// presets exist specifically so you never need it here.
// ---------------------------------------------------------------------------

export const CLOUDINARY_CONFIG = {
  cloudName: "nnnwcbl6",
  uploadPreset: "Temp01",
};