// ui-utils.js
// ---------------------------------------------------------------------------
// Tiny shared UI helpers used by home.js, gallery.js, and admin.js.
// ---------------------------------------------------------------------------

export function showToast(container, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

export function setStatus(el, message, type) {
  el.textContent = message;
  el.className = "status-msg";
  if (type) el.classList.add(type);
  el.classList.toggle("hidden", !message);
}
