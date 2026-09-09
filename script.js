// script.js
// ---------------------------------------------------------------------------
// Photo Manager — application logic
// Images are uploaded to Cloudinary (unsigned upload, no backend needed).
// Metadata (name, url, size, etc.) is stored in Firestore.
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const COLLECTION_NAME = "photos";

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const photoNameInput = $("photoName");
const dropZone = $("dropZone");
const fileInput = $("fileInput");
const chooseBtn = $("chooseBtn");
const changeBtn = $("changeBtn");
const dropZoneEmpty = $("dropZoneEmpty");
const previewWrap = $("previewWrap");
const previewImg = $("previewImg");
const previewName = $("previewName");
const previewSize = $("previewSize");

const progressWrap = $("progressWrap");
const progressBar = $("progressBar");
const progressLabel = $("progressLabel");

const statusMsg = $("statusMsg");
const uploadBtn = $("uploadBtn");
const uploadBtnText = $("uploadBtnText");
const uploadSpinner = $("uploadSpinner");
const resetBtn = $("resetBtn");

const totalCount = $("totalCount");
const searchInput = $("searchInput");
const clearSearchBtn = $("clearSearchBtn");
const resultCount = $("resultCount");

const galleryLoading = $("galleryLoading");
const galleryEmpty = $("galleryEmpty");
const galleryNoResults = $("galleryNoResults");
const galleryGrid = $("galleryGrid");

const previewModal = $("previewModal");
const modalBackdrop = $("modalBackdrop");
const modalCloseBtn = $("modalCloseBtn");
const modalImg = $("modalImg");
const modalName = $("modalName");
const modalMeta = $("modalMeta");
const modalDownload = $("modalDownload");

const editModal = $("editModal");
const editBackdrop = $("editBackdrop");
const editCloseBtn = $("editCloseBtn");
const editCancelBtn = $("editCancelBtn");
const editSaveBtn = $("editSaveBtn");
const editSaveText = $("editSaveText");
const editSpinner = $("editSpinner");
const editNameInput = $("editNameInput");
const editStatusMsg = $("editStatusMsg");

const deleteModal = $("deleteModal");
const deleteBackdrop = $("deleteBackdrop");
const deleteCancelBtn = $("deleteCancelBtn");
const deleteConfirmBtn = $("deleteConfirmBtn");
const deleteConfirmText = $("deleteConfirmText");
const deleteSpinner = $("deleteSpinner");
const deleteTargetName = $("deleteTargetName");
const deleteStatusMsg = $("deleteStatusMsg");

const toastContainer = $("toastContainer");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let selectedFile = null;
let isUploading = false;
let allPhotos = [];           // full list from Firestore, kept in sync live
let currentSearchTerm = "";
let editTargetId = null;
let deleteTargetPhoto = null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function setStatus(el, message, type) {
  el.textContent = message;
  el.className = "status-msg";
  if (type) el.classList.add(type);
  if (message) {
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

/** Maps a Cloudinary/Firestore error to a friendly, specific message. */
function friendlyError(error) {
  console.error("Error:", error);

  const message = (error?.message || "").toLowerCase();

  if (error?.code?.includes?.("permission-denied")) {
    return "Firestore permission denied. Check your Firestore security rules.";
  }
  if (message.includes("upload preset") || message.includes("unsigned")) {
    return "Cloudinary upload preset is missing or not set to Unsigned. Check cloudinary-config.js and your Cloudinary dashboard.";
  }
  if (message.includes("cloud_name") || message.includes("cloud name")) {
    return "Cloudinary cloud name is invalid. Check cloudinary-config.js.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check your internet connection and try again.";
  }
  return error?.message || "Something went wrong. See console for details.";
}

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Invalid file type. Please choose a JPG, PNG, WEBP, or GIF image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Upload panel: file selection (drag & drop + choose button + validation)
// ---------------------------------------------------------------------------

function handleFileSelected(file) {
  const error = validateFile(file);
  if (error) {
    setStatus(statusMsg, error, "error");
    return;
  }

  selectedFile = file;
  setStatus(statusMsg, "", null);

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewName.textContent = file.name;
    previewSize.textContent = formatBytes(file.size);
    dropZoneEmpty.classList.add("hidden");
    previewWrap.classList.remove("hidden");
  };
  reader.onerror = () => {
    setStatus(statusMsg, "Could not read the selected file.", "error");
  };
  reader.readAsDataURL(file);

  if (!photoNameInput.value.trim()) {
    photoNameInput.value = file.name.replace(/\.[^/.]+$/, "");
  }
}

chooseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener("click", (e) => {
  if (e.target === chooseBtn || e.target === changeBtn) return;
  if (!selectedFile) fileInput.click();
});

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

changeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files[0]) {
    handleFileSelected(fileInput.files[0]);
  }
});

["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFileSelected(file);
});

function resetUploadForm() {
  selectedFile = null;
  fileInput.value = "";
  photoNameInput.value = "";
  previewImg.src = "";
  dropZoneEmpty.classList.remove("hidden");
  previewWrap.classList.add("hidden");
  progressWrap.classList.add("hidden");
  progressBar.style.width = "0%";
  progressLabel.textContent = "0%";
  setStatus(statusMsg, "", null);
}

resetBtn.addEventListener("click", resetUploadForm);

// ---------------------------------------------------------------------------
// Upload panel: performing the actual upload (Cloudinary + Firestore)
// ---------------------------------------------------------------------------

function setUploadingUI(active) {
  isUploading = active;
  uploadBtn.disabled = active;
  resetBtn.disabled = active;
  uploadBtnText.textContent = active ? "Uploading…" : "Upload";
  uploadSpinner.classList.toggle("hidden", !active);
}

/**
 * Uploads a file to Cloudinary using an unsigned upload preset, with
 * progress reporting via XMLHttpRequest (fetch doesn't expose upload
 * progress). Resolves with Cloudinary's JSON response.
 */
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
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
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

async function handleUpload() {
  if (isUploading) return;

  if (!selectedFile) {
    setStatus(statusMsg, "Please choose a photo first.", "error");
    return;
  }

  const name = photoNameInput.value.trim();
  if (!name) {
    setStatus(statusMsg, "Please enter a photo name.", "error");
    return;
  }

  const validationError = validateFile(selectedFile);
  if (validationError) {
    setStatus(statusMsg, validationError, "error");
    return;
  }

  setUploadingUI(true);
  progressWrap.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressLabel.textContent = "0%";
  setStatus(statusMsg, "Uploading…", "info");

  try {
    const cloudinaryResult = await uploadToCloudinary(selectedFile, (pct) => {
      progressBar.style.width = `${pct}%`;
      progressLabel.textContent = `${pct}%`;
    });

    await addDoc(collection(db, COLLECTION_NAME), {
      name,
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      fileName: selectedFile.name,
      fileSize: cloudinaryResult.bytes ?? selectedFile.size,
      fileType: selectedFile.type,
      createdAt: serverTimestamp(),
    });

    setStatus(statusMsg, "Upload successful.", "success");
    showToast("Photo uploaded", "success");
    resetUploadForm();
  } catch (error) {
    setStatus(statusMsg, friendlyError(error), "error");
  } finally {
    setUploadingUI(false);
    progressWrap.classList.add("hidden");
  }
}

uploadBtn.addEventListener("click", handleUpload);

// ---------------------------------------------------------------------------
// Gallery: live Firestore subscription
// ---------------------------------------------------------------------------

function subscribeToPhotos() {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));

  onSnapshot(
    q,
    (snapshot) => {
      allPhotos = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      galleryLoading.classList.add("hidden");
      renderGallery();
    },
    (error) => {
      galleryLoading.classList.add("hidden");
      showToast(friendlyError(error), "error");
    }
  );
}

function getFilteredPhotos() {
  if (!currentSearchTerm) return allPhotos;
  const term = currentSearchTerm.toLowerCase();
  return allPhotos.filter((p) => (p.name || "").toLowerCase().includes(term));
}

function renderGallery() {
  const filtered = getFilteredPhotos();

  totalCount.textContent = `${allPhotos.length} photo${allPhotos.length === 1 ? "" : "s"}`;
  resultCount.textContent = currentSearchTerm
    ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}`
    : `${filtered.length} photo${filtered.length === 1 ? "" : "s"}`;

  galleryGrid.innerHTML = "";

  if (allPhotos.length === 0) {
    galleryEmpty.classList.remove("hidden");
    galleryNoResults.classList.add("hidden");
    return;
  }
  galleryEmpty.classList.add("hidden");

  if (filtered.length === 0) {
    galleryNoResults.classList.remove("hidden");
    return;
  }
  galleryNoResults.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  filtered.forEach((photo) => fragment.appendChild(buildPhotoCard(photo)));
  galleryGrid.appendChild(fragment);
}

function buildPhotoCard(photo) {
  const card = document.createElement("div");
  card.className = "photo-card";
  card.innerHTML = `
    <div class="photo-card-thumb" data-action="preview">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy" />
    </div>
    <div class="photo-card-body">
      <div class="photo-card-name" title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</div>
      <div class="photo-card-sub">
        <span>${formatDate(photo.createdAt)}</span>
        <span>${formatBytes(photo.fileSize)}</span>
      </div>
      <div class="photo-card-actions">
        <button type="button" class="icon-btn" data-action="preview">Preview</button>
        <button type="button" class="icon-btn" data-action="edit">Edit</button>
        <button type="button" class="icon-btn danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;

  const img = card.querySelector("img");
  img.addEventListener("error", () => {
    const thumb = card.querySelector(".photo-card-thumb");
    thumb.classList.add("thumb-error");
    thumb.innerHTML = "🖼";
  });

  card.querySelectorAll('[data-action="preview"]').forEach((el) => {
    el.addEventListener("click", () => openPreviewModal(photo));
  });
  card.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(photo));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => openDeleteModal(photo));

  return card;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

searchInput.addEventListener("input", () => {
  currentSearchTerm = searchInput.value.trim();
  clearSearchBtn.classList.toggle("hidden", !currentSearchTerm);
  renderGallery();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  currentSearchTerm = "";
  clearSearchBtn.classList.add("hidden");
  renderGallery();
});

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

function openPreviewModal(photo) {
  modalImg.src = photo.url;
  modalImg.alt = photo.name || "";
  modalName.textContent = photo.name || "";
  modalMeta.textContent = `${formatDate(photo.createdAt)} · ${formatBytes(photo.fileSize)}`;
  modalDownload.href = photo.url;
  previewModal.classList.remove("hidden");
}

function closePreviewModal() {
  previewModal.classList.add("hidden");
  modalImg.src = "";
}

modalCloseBtn.addEventListener("click", closePreviewModal);
modalBackdrop.addEventListener("click", closePreviewModal);

// ---------------------------------------------------------------------------
// Edit (rename) modal
// ---------------------------------------------------------------------------

function openEditModal(photo) {
  editTargetId = photo.id;
  editNameInput.value = photo.name || "";
  setStatus(editStatusMsg, "", null);
  editModal.classList.remove("hidden");
  setTimeout(() => editNameInput.focus(), 50);
}

function closeEditModal() {
  editModal.classList.add("hidden");
  editTargetId = null;
}

editCloseBtn.addEventListener("click", closeEditModal);
editCancelBtn.addEventListener("click", closeEditModal);
editBackdrop.addEventListener("click", closeEditModal);

async function handleEditSave() {
  if (!editTargetId) return;
  const newName = editNameInput.value.trim();
  if (!newName) {
    setStatus(editStatusMsg, "Photo name cannot be empty.", "error");
    return;
  }

  editSaveBtn.disabled = true;
  editSaveText.textContent = "Saving…";
  editSpinner.classList.remove("hidden");

  try {
    await updateDoc(doc(db, COLLECTION_NAME, editTargetId), { name: newName });
    showToast("Photo renamed", "success");
    closeEditModal();
  } catch (error) {
    setStatus(editStatusMsg, friendlyError(error), "error");
  } finally {
    editSaveBtn.disabled = false;
    editSaveText.textContent = "Save";
    editSpinner.classList.add("hidden");
  }
}

editSaveBtn.addEventListener("click", handleEditSave);

// ---------------------------------------------------------------------------
// Delete modal
// ---------------------------------------------------------------------------
// Note: Cloudinary unsigned uploads cannot be deleted from the browser
// (deleting requires a signed request with your API secret, which must
// never be exposed client-side). This removes the photo from the app's
// gallery and Firestore; the underlying file remains in your Cloudinary
// media library until you remove it there, or add a small serverless
// function later to handle signed deletes.
// ---------------------------------------------------------------------------

function openDeleteModal(photo) {
  deleteTargetPhoto = photo;
  deleteTargetName.textContent = photo.name || "this photo";
  setStatus(deleteStatusMsg, "", null);
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  deleteModal.classList.add("hidden");
  deleteTargetPhoto = null;
}

deleteCancelBtn.addEventListener("click", closeDeleteModal);
deleteBackdrop.addEventListener("click", closeDeleteModal);

async function handleDeleteConfirm() {
  if (!deleteTargetPhoto) return;
  const photo = deleteTargetPhoto;

  deleteConfirmBtn.disabled = true;
  deleteConfirmText.textContent = "Deleting…";
  deleteSpinner.classList.remove("hidden");

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, photo.id));
    showToast("Photo deleted", "success");
    closeDeleteModal();
  } catch (error) {
    setStatus(deleteStatusMsg, friendlyError(error), "error");
  } finally {
    deleteConfirmBtn.disabled = false;
    deleteConfirmText.textContent = "Delete";
    deleteSpinner.classList.add("hidden");
  }
}

deleteConfirmBtn.addEventListener("click", handleDeleteConfirm);

// ---------------------------------------------------------------------------
// Global keyboard handling (Escape closes any open modal)
// ---------------------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!previewModal.classList.contains("hidden")) closePreviewModal();
  if (!editModal.classList.contains("hidden")) closeEditModal();
  if (!deleteModal.classList.contains("hidden")) closeDeleteModal();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

subscribeToPhotos();