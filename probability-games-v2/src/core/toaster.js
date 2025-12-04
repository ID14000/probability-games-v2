// src/core/toaster.js
// A simple, dependency-free toast notification system

export function showToast(title, message, type = "default") {
  // Create container if it doesn't exist
  let container = document.getElementById("pg-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "pg-toast-container";
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `pg-toast pg-toast--${type}`;
  
  const icon = type === "achievement" ? "🏆" : type === "error" ? "⚠️" : "ℹ️";

  toast.innerHTML = `
    <div class="pg-toast-icon">${icon}</div>
    <div class="pg-toast-content">
      <div class="pg-toast-title">${title}</div>
      <div class="pg-toast-message">${message}</div>
    </div>
  `;

  // Add to DOM
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("pg-toast--visible");
  });

  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove("pg-toast--visible");
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, 4000);
}