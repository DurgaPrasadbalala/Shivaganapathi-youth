// cloudinary-config.js
// ---------------------------------------------------------------------------
// Cloudinary configuration
// ---------------------------------------------------------------------------
// Cloudinary's free tier does not require a credit card, and supports
// unsigned uploads directly from the browser — no backend/server needed.
//
// Where to get these two values:
//   1. Sign up at https://cloudinary.com (free plan).
//   2. CLOUD_NAME     -> Dashboard home page, top-left "Cloud name" field.
//   3. UPLOAD_PRESET  -> Settings (gear icon) → Upload → "Upload presets" →
//      "Add upload preset":
//        - Signing Mode: UNSIGNED (required)
//        - Folder: photos (optional, keeps things tidy)
//        - Save, then copy the preset's name below.
//
// NEVER put your Cloudinary API Secret in frontend code.
// ---------------------------------------------------------------------------

export const CLOUDINARY_CONFIG = {
  cloudName: "yguobvaw",
  uploadPreset: "Preset 1",
};
