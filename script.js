const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy");
    if (!value) return;

    try {
      await copyText(value);
      const label = button.querySelector(".copy-label");
      const original = label ? label.textContent : "";

      button.classList.add("copied");
      if (label) label.textContent = "Copied!";

      const isIp = value.includes("DangerVSMP");
      showToast(isIp ? `Copied IP: ${value}` : `Copied: ${value}`);

      setTimeout(() => {
        button.classList.remove("copied");
        if (label) label.textContent = original;
      }, 1800);
    } catch {
      showToast("Could not copy automatically — please copy manually.");
    }
  });
});

// Persist pre-flight checklist in localStorage
const STORAGE_KEY = "dangervsmp_setup_checklist";
const savedChecks = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
})();

document.querySelectorAll("[data-check]").forEach((checkbox) => {
  const key = checkbox.getAttribute("data-check");
  if (!key) return;
  checkbox.checked = Boolean(savedChecks[key]);

  checkbox.addEventListener("change", () => {
    savedChecks[key] = checkbox.checked;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedChecks));
    } catch {
      // Ignore storage errors in restricted environments
    }
  });
});

// Launcher type tabs (Normal vs Cracked) in Step 1
document.querySelectorAll(".launcher-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-launcher");
    if (!target) return;

    document.querySelectorAll(".launcher-tab").forEach((btn) => {
      const isActive = btn === tab;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".launcher-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.getAttribute("data-panel") === target);
    });
  });
});

