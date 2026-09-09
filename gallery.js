// gallery.js — dedicated searchable public gallery (approved photos only)
import {
  subscribeApprovedPhotos,
  formatBytes,
  formatDate,
  escapeHtml,
  friendlyError,
} from "./photo-service.js";
import { showToast } from "./ui-utils.js";

const $ = (id) => document.getElementById(id);

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

const toastContainer = $("toastContainer");

let allPhotos = [];
let currentSearchTerm = "";

function getFilteredPhotos() {
  if (!currentSearchTerm) return allPhotos;
  const term = currentSearchTerm.toLowerCase();
  return allPhotos.filter((p) => (p.name || "").toLowerCase().includes(term));
}

function renderGallery() {
  const filtered = getFilteredPhotos();
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
