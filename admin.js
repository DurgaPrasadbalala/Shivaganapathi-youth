// admin.js — Firebase Auth login gate + moderation dashboard
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  subscribeAllPhotos,
  approvePhoto,
  deletePhoto,
  formatBytes,
  formatDate,
  escapeHtml,
  friendlyError,
} from "./photo-service.js";
import { showToast, setStatus } from "./ui-utils.js";

const $ = (id) => document.getElementById(id);

// Login view
const loginView = $("loginView");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginBtn = $("loginBtn");
const loginBtnText = $("loginBtnText");
const loginSpinner = $("loginSpinner");
const loginStatusMsg = $("loginStatusMsg");

// Dashboard view
const dashboardView = $("dashboardView");
const adminEmail = $("adminEmail");
const logoutBtn = $("logoutBtn");
const statusTabs = $("statusTabs");
const searchInput = $("searchInput");
const clearSearchBtn = $("clearSearchBtn");
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

const deleteModal = $("deleteModal");
const deleteBackdrop = $("deleteBackdrop");
const deleteCancelBtn = $("deleteCancelBtn");
const deleteConfirmBtn = $("deleteConfirmBtn");
const deleteConfirmText = $("deleteConfirmText");
const deleteSpinner = $("deleteSpinner");
const deleteTargetName = $("deleteTargetName");
const deleteStatusMsg = $("deleteStatusMsg");

const toastContainer = $("toastContainer");

let allPhotos = [];
let currentFilter = "all";
let currentSearchTerm = "";
let deleteTargetPhoto = null;
let unsubscribePhotos = null;

// ---------------------------------------------------------------------------
// Auth: login / logout / session gate
// ---------------------------------------------------------------------------

function setLoginLoading(active) {
  loginBtn.disabled = active;
  loginBtnText.textContent = active ? "Signing in…" : "Sign in";
  loginSpinner.classList.toggle("hidden", !active);
}

async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    setStatus(loginStatusMsg, "Please enter both email and password.", "error");
    return;
  }

  setLoginLoading(true);
  setStatus(loginStatusMsg, "", null);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginPassword.value = "";
    // onAuthStateChanged below handles switching to the dashboard view.
  } catch (error) {
    setStatus(loginStatusMsg, friendlyError(error), "error");
  } finally {
    setLoginLoading(false);
  }
}

loginBtn.addEventListener("click", handleLogin);
[loginEmail, loginPassword].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).catch((error) => showToast(toastContainer, friendlyError(error), "error"));
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    adminEmail.textContent = user.email || "";
    if (!unsubscribePhotos) {
      unsubscribePhotos = subscribeAllPhotos(
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
    }
  } else {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    if (unsubscribePhotos) {
      unsubscribePhotos();
      unsubscribePhotos = null;
    }
    allPhotos = [];
  }
});

// ---------------------------------------------------------------------------
// Filtering (tabs + search)
// ---------------------------------------------------------------------------

statusTabs.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    statusTabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderGallery();
  });
});

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

function getFilteredPhotos() {
  let list = allPhotos;
  if (currentFilter !== "all") {
    list = list.filter((p) => p.status === currentFilter);
  }
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    list = list.filter((p) => (p.name || "").toLowerCase().includes(term));
  }
  return list;
}

// ---------------------------------------------------------------------------
// Gallery rendering
// ---------------------------------------------------------------------------

function renderGallery() {
  const filtered = getFilteredPhotos();
  resultCount.textContent = `${filtered.length} photo${filtered.length === 1 ? "" : "s"}`;
  galleryGrid.innerHTML = "";

  if (filtered.length === 0) {
    galleryEmpty.classList.remove("hidden");
    return;
  }
  galleryEmpty.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  filtered.forEach((photo) => fragment.appendChild(buildPhotoCard(photo)));
  galleryGrid.appendChild(fragment);
}

function buildPhotoCard(photo) {
  const isPending = photo.status === "pending";
  const card = document.createElement("div");
  card.className = "photo-card";
  card.innerHTML = `
    <div class="photo-card-thumb" data-action="preview">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy" />
      <span class="status-badge ${isPending ? "pending" : "approved"}">${isPending ? "Pending" : "Approved"}</span>
    </div>
    <div class="photo-card-body">
      <div class="photo-card-name" title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</div>
      <div class="photo-card-sub">
        <span>${formatDate(photo.createdAt)}</span>
        <span>${formatBytes(photo.fileSize)}</span>
      </div>
      <div class="photo-card-actions">
        ${isPending ? '<button type="button" class="icon-btn approve" data-action="approve">Approve</button>' : ""}
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

  card.querySelector('[data-action="preview"]').addEventListener("click", () => openPreviewModal(photo));
  const approveBtn = card.querySelector('[data-action="approve"]');
  if (approveBtn) approveBtn.addEventListener("click", () => handleApprove(photo, approveBtn));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => openDeleteModal(photo));

  return card;
}

async function handleApprove(photo, btn) {
  btn.disabled = true;
  btn.textContent = "Approving…";
  try {
    await approvePhoto(photo.id);
    showToast(toastContainer, "Photo approved", "success");
  } catch (error) {
    showToast(toastContainer, friendlyError(error), "error");
    btn.disabled = false;
    btn.textContent = "Approve";
  }
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

function openPreviewModal(photo) {
  modalImg.src = photo.url;
  modalImg.alt = photo.name || "";
  modalName.textContent = photo.name || "";
  modalMeta.textContent = `${formatDate(photo.createdAt)} · ${formatBytes(photo.fileSize)} · ${photo.status}`;
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
// Delete modal
// ---------------------------------------------------------------------------
// Note: deletes the Firestore document only. Cloudinary unsigned uploads
// cannot be deleted from the browser (that requires a signed request with
// your API secret) — see SETUP_GUIDE.md.
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
    await deletePhoto(photo.id);
    showToast(toastContainer, "Photo deleted", "success");
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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!previewModal.classList.contains("hidden")) closePreviewModal();
  if (!deleteModal.classList.contains("hidden")) closeDeleteModal();
});
