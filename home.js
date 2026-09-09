// home.js — Home page: submission form + approved-photos gallery
import {
  validateFile,
  submitPhoto,
  subscribeApprovedPhotos,
  formatBytes,
  formatDate,
  escapeHtml,
  friendlyError,
} from "./photo-service.js";
import { showToast, setStatus } from "./ui-utils.js";

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

const resultCount = $("resultCount");
const galleryLoading = $("galleryLoading");
const galleryEmpty = $("galleryEmpty");
const galleryGrid = $("galleryGrid");

const previewModal = $("previewModal");
const modalBackdrop = $("modalBackdrop");
const modalCloseBtn = $("modalCloseBtn");
const modalImg = $("modalImg");
const modalName = $("modalName");
const modalMeta = $("modalMeta");
const modalDownload = $("modalDownload");

const toastContainer = $("toastContainer");

let selectedFile = null;
let isUploading = false;

// ---------------------------------------------------------------------------
// File selection
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
  reader.onerror = () => setStatus(statusMsg, "Could not read the selected file.", "error");
  reader.readAsDataURL(file);

  if (!photoNameInput.value.trim()) {
    photoNameInput.value = file.name.replace(/\.[^/.]+$/, "");
  }
}

chooseBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", (e) => {
  if (e.target === chooseBtn || e.target === changeBtn) return;
  if (!selectedFile) fileInput.click();
});
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
changeBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) handleFileSelected(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add("drag-over"); });
});
["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove("drag-over"); });
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
// Submission
// ---------------------------------------------------------------------------

function setUploadingUI(active) {
  isUploading = active;
  uploadBtn.disabled = active;
  resetBtn.disabled = active;
  uploadBtnText.textContent = active ? "Submitting…" : "Submit";
  uploadSpinner.classList.toggle("hidden", !active);
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
    await submitPhoto({
      name,
      file: selectedFile,
      onProgress: (pct) => {
        progressBar.style.width = `${pct}%`;
        progressLabel.textContent = `${pct}%`;
      },
    });
    setStatus(statusMsg, "Submitted! Your photo is awaiting admin approval before it appears in the gallery.", "success");
    showToast(toastContainer, "Photo submitted for approval", "success");
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
// Approved gallery
// ---------------------------------------------------------------------------

let allPhotos = [];

function renderGallery() {
  resultCount.textContent = `${allPhotos.length} photo${allPhotos.length === 1 ? "" : "s"}`;
  galleryGrid.innerHTML = "";

  if (allPhotos.length === 0) {
    galleryEmpty.classList.remove("hidden");
    return;
  }
  galleryEmpty.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  allPhotos.forEach((photo) => fragment.appendChild(buildPhotoCard(photo)));
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
    </div>
  `;
  const img = card.querySelector("img");
  img.addEventListener("error", () => {
    const thumb = card.querySelector(".photo-card-thumb");
    thumb.classList.add("thumb-error");
    thumb.innerHTML = "🖼";
  });
  card.querySelector('[data-action="preview"]').addEventListener("click", () => openPreviewModal(photo));
  return card;
}

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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) closePreviewModal();
});

subscribeApprovedPhotos(
  (photos) => {
    allPhotos = photos;
    galleryLoading.classList.add("hidden");
    renderGallery();
  },
  (error) => {
    galleryLoading.classList.add("hidden");
    showToast(toastContainer, friendlyError(error), "error");
  }
);
