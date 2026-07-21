/* HabitFlow popup — talks to the same REST API the web/mobile apps use. */

const STORAGE_KEY = "habitflow_api_url";
const COLORS = ["color-blue", "color-pink", "color-yellow", "color-green"];

const el = {
  content: document.getElementById("content"),
  hero: document.getElementById("hero"),
  heroLabel: document.getElementById("hero-label"),
  heroNumber: document.getElementById("hero-number"),
  heroIcon: document.getElementById("hero-icon"),
  settingsBtn: document.getElementById("settings-btn"),
  settingsPanel: document.getElementById("settings-panel"),
  apiUrlInput: document.getElementById("api-url-input"),
  saveSettings: document.getElementById("save-settings"),
  cancelSettings: document.getElementById("cancel-settings"),
};

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getStoredBaseUrl() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve((result[STORAGE_KEY] || "").trim());
      });
    } else {
      resolve((localStorage.getItem(STORAGE_KEY) || "").trim());
    }
  });
}

function setStoredBaseUrl(url) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: url }, () => resolve());
    } else {
      localStorage.setItem(STORAGE_KEY, url);
      resolve();
    }
  });
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  let trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  trimmed = trimmed.replace(/\/api$/i, "");
  return trimmed;
}

async function api(path, options = {}) {
  const base = normalizeBaseUrl(await getStoredBaseUrl());
  if (!base) throw new Error("API URL is not configured");
  const url = `${base}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function checkSvg() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function flameSvg() {
  return `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
}

function awardSvg() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88"/></svg>`;
}

function renderHero(habits) {
  const total = habits.length;
  const completed = habits.filter((h) => h.completedToday).length;
  const allDone = total > 0 && completed === total;
  el.heroLabel.textContent = allDone ? "ALL DONE!" : "PROGRESS";
  el.heroNumber.textContent = `${completed}/${total}`;
  el.hero.classList.toggle("all-done", allDone);
  el.heroIcon.innerHTML = allDone ? awardSvg() : el.heroIcon.innerHTML;
}

function renderHabits(habits) {
  el.content.innerHTML = "";
  if (habits.length === 0) {
    el.content.innerHTML = `
      <div class="empty">
        <div class="empty-title">No habits yet</div>
        <div class="empty-desc">Add habits in the HabitFlow web app to see them here.</div>
      </div>`;
    return;
  }

  habits.forEach((habit, idx) => {
    const card = document.createElement("button");
    card.className = `habit-card ${
      habit.completedToday ? "completed" : COLORS[idx % COLORS.length]
    }`;
    card.dataset.habitId = String(habit.id);
    card.dataset.completed = habit.completedToday ? "1" : "0";
    card.setAttribute("aria-label", habit.name);
    card.innerHTML = `
      <div class="checkbox">${habit.completedToday ? checkSvg() : ""}</div>
      <div class="habit-text">
        <div class="habit-name">${escapeHtml(habit.name)}</div>
        ${
          habit.description
            ? `<div class="habit-desc">${escapeHtml(habit.description)}</div>`
            : ""
        }
      </div>
      ${
        habit.currentStreak > 0
          ? `<div class="streak-pill">${flameSvg()}${habit.currentStreak}</div>`
          : ""
      }
    `;
    card.addEventListener("click", () => toggleHabit(card, habit));
    el.content.appendChild(card);
  });
}

function renderError(message) {
  el.content.innerHTML = `
    <div class="error-state">
      <div class="error-title">Couldn't load habits</div>
      <div class="error-desc">${escapeHtml(message)}</div>
      <div style="margin-top: 14px;">
        <button class="btn btn-ghost" id="open-settings-from-error">SETTINGS</button>
      </div>
    </div>`;
  document
    .getElementById("open-settings-from-error")
    ?.addEventListener("click", openSettings);
}

let isToggling = false;
async function toggleHabit(cardEl, habit) {
  if (isToggling) return;
  isToggling = true;
  const wasCompleted = cardEl.dataset.completed === "1";
  // Optimistic UI
  cardEl.classList.toggle("completed", !wasCompleted);
  cardEl.dataset.completed = wasCompleted ? "0" : "1";
  cardEl.querySelector(".checkbox").innerHTML = wasCompleted ? "" : checkSvg();

  try {
    if (wasCompleted) {
      await api(`/habits/${habit.id}/complete`, {
        method: "DELETE",
        body: JSON.stringify({ date: todayString() }),
      });
    } else {
      await api(`/habits/${habit.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ date: todayString() }),
      });
    }
    await loadHabits();
  } catch (err) {
    // Revert
    cardEl.classList.toggle("completed", wasCompleted);
    cardEl.dataset.completed = wasCompleted ? "1" : "0";
    cardEl.querySelector(".checkbox").innerHTML = wasCompleted ? checkSvg() : "";
    renderError(err instanceof Error ? err.message : String(err));
  } finally {
    isToggling = false;
  }
}

async function loadHabits() {
  const base = await getStoredBaseUrl();
  if (!base) {
    openSettings(true);
    return;
  }
  el.content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const habits = await api("/habits");
    renderHero(habits);
    renderHabits(habits);
  } catch (err) {
    renderError(err instanceof Error ? err.message : String(err));
  }
}

async function openSettings(initial = false) {
  el.apiUrlInput.value = await getStoredBaseUrl();
  el.settingsPanel.classList.remove("hidden");
  if (!initial) el.apiUrlInput.focus();
}

function closeSettings() {
  el.settingsPanel.classList.add("hidden");
}

el.settingsBtn.addEventListener("click", () => openSettings(false));
el.cancelSettings.addEventListener("click", closeSettings);
el.saveSettings.addEventListener("click", async () => {
  const value = normalizeBaseUrl(el.apiUrlInput.value);
  await setStoredBaseUrl(value);
  closeSettings();
  loadHabits();
});
el.apiUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.saveSettings.click();
});

loadHabits();
