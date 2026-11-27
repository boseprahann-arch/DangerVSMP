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
      const isIp = value.includes("DangerVSMP") && value.includes("aternos");
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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
})();

document.querySelectorAll("[data-check]").forEach((checkbox) => {
  const key = checkbox.getAttribute("data-check");
  if (!key) return;
  checkbox.checked = Boolean(savedChecks[key]);
  checkbox.addEventListener("change", () => {
    savedChecks[key] = checkbox.checked;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedChecks)); }
    catch {}
  });
});

// Launcher type tabs (Normal vs Cracked)
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

// ─── Server Status & Player Tracking ───────────────────────────────────────

const SERVER_HOST = "DangerVSMP.aternos.me";
const SERVER_PORT = 30776;
const API_URL = `https://api.mcstatus.io/v2/status/java/${SERVER_HOST}:${SERVER_PORT}`;
const PLAYERS_KEY = "dangervsmp_ever_seen_players";

// Load persisted player list (name → { name, firstSeen, lastSeen })
function loadKnownPlayers() {
  try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || "{}"); }
  catch { return {}; }
}

function saveKnownPlayers(players) {
  try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(players)); }
  catch {}
}

// Update the small status badge in the IP card hero
function setHeroStatus(online, playerCount) {
  const badge = document.getElementById("server-status-badge");
  const dot   = document.getElementById("status-dot");
  const label = document.getElementById("status-label");
  if (!badge || !dot || !label) return;
  badge.className = "server-status-badge " + (online ? "online" : "offline");
  label.textContent = online
    ? `Online • ${playerCount} player${playerCount !== 1 ? "s" : ""}`
    : "Offline";
}

// Update the large status badge in the Players section
function setPlayersStatus(online, playerCount) {
  const badge = document.getElementById("players-status-badge");
  const dot   = document.getElementById("players-status-dot");
  const label = document.getElementById("players-status-label");
  const count = document.getElementById("players-count-label");
  if (!badge || !label) return;
  badge.className = "server-status-badge large " + (online ? "online" : "offline");
  label.textContent = online
    ? `Server Online — ${playerCount} player${playerCount !== 1 ? "s" : ""} in-game`
    : "Server Offline";
  if (count) {
    const known = loadKnownPlayers();
    const total = Object.keys(known).length;
    count.textContent = total > 0 ? `${total} player${total !== 1 ? "s" : ""} ever played` : "";
  }
}

// Render the player grid from the persisted list + currently online names
function renderPlayerGrid(onlineNames) {
  const grid = document.getElementById("player-grid");
  if (!grid) return;

  const known = loadKnownPlayers();
  const entries = Object.values(known);

  // Sort: online first, then alphabetical
  entries.sort((a, b) => {
    const aOnline = onlineNames.includes(a.name);
    const bOnline = onlineNames.includes(b.name);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  grid.innerHTML = "";

  if (entries.length === 0) {
    grid.innerHTML = `<div class="player-empty">
      No players recorded yet — they will appear here once someone plays while this page is open.
    </div>`;
    return;
  }

  entries.forEach(({ name }) => {
    const isOnline = onlineNames.includes(name);
    const card = document.createElement("div");
    card.className = "player-card" + (isOnline ? " is-online" : "");
    card.innerHTML = `
      <img
        class="player-avatar"
        src="https://mc-heads.net/avatar/${encodeURIComponent(name)}/40"
        alt="${name}'s Minecraft head"
        onerror="this.src='https://mc-heads.net/avatar/Steve/40'"
        loading="lazy"
      />
      <div class="player-info">
        <div class="player-name">${name}</div>
        <div class="player-status ${isOnline ? "online" : "offline"}">
          <span class="player-status-dot"></span>
          ${isOnline ? "Online" : "Offline"}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Main fetch function
async function fetchServerStatus() {
  const grid    = document.getElementById("player-grid");
  const loading = document.getElementById("player-loading");

  try {
    const res  = await fetch(API_URL, { cache: "no-store" });
    const data = await res.json();

    const online      = data.online === true;
    const onlineNames = (online && data.players && Array.isArray(data.players.list))
      ? data.players.list
          .map((p) => (typeof p === "string" ? p : (p.name_clean || p.name_raw || p.name || "")))
          .filter(Boolean)
      : [];
    const playerCount = (online && data.players) ? (data.players.online ?? onlineNames.length) : 0;

    // Persist any newly seen players
    if (onlineNames.length > 0) {
      const known = loadKnownPlayers();
      const now = new Date().toISOString();
      let changed = false;
      onlineNames.forEach((name) => {
        if (!known[name]) {
          known[name] = { name, firstSeen: now, lastSeen: now };
          changed = true;
        } else {
          known[name].lastSeen = now;
        }
      });
      if (changed) saveKnownPlayers(known);
    }

    if (loading) loading.style.display = "none";
    setHeroStatus(online, playerCount);
    setPlayersStatus(online, playerCount);
    renderPlayerGrid(onlineNames);

  } catch {
    if (loading) loading.style.display = "none";
    setHeroStatus(false, 0);
    setPlayersStatus(false, 0);
    renderPlayerGrid([]);
  }
}

// Initial fetch + poll every 60 seconds
fetchServerStatus();
setInterval(fetchServerStatus, 60_000);


