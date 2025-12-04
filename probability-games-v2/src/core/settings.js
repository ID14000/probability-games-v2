// Global settings system for Probability Games v2
// Applies theme/density/motion/card-style and info visibility via body classes.

const STORAGE_KEY = "pgv2_settings";

const DEFAULT_SETTINGS = {
  theme: "default", // default | dim | high-contrast
  density: "comfortable", // comfortable | compact
  motion: "full", // full | reduced
  cardStyle: "glow", // glow | flat
  showEV: true,
  showStreaks: true,
  showHints: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function applySettings(settings) {
  const body = document.body;
  if (!body) return;

  // Theme
  body.classList.remove(
    "pg-theme-default",
    "pg-theme-dim",
    "pg-theme-high-contrast"
  );
  body.classList.add(
    settings.theme === "dim"
      ? "pg-theme-dim"
      : settings.theme === "high-contrast"
      ? "pg-theme-high-contrast"
      : "pg-theme-default"
  );

  // Density
  body.classList.remove("pg-density-comfortable", "pg-density-compact");
  body.classList.add(
    settings.density === "compact"
      ? "pg-density-compact"
      : "pg-density-comfortable"
  );

  // Motion
  body.classList.remove("pg-motion-full", "pg-motion-reduced");
  body.classList.add(
    settings.motion === "reduced" ? "pg-motion-reduced" : "pg-motion-full"
  );

  // Card style
  body.classList.remove("pg-card-glow", "pg-card-flat");
  body.classList.add(
    settings.cardStyle === "flat" ? "pg-card-flat" : "pg-card-glow"
  );

  // Info toggles
  body.classList.toggle("pg-hide-ev", !settings.showEV);
  body.classList.toggle("pg-hide-streaks", !settings.showStreaks);
  body.classList.toggle("pg-hide-hints", !settings.showHints);
}

function syncControls(settings) {
  // radios
  const themeInputs = document.querySelectorAll('input[name="pg-theme"]');
  const densityInputs = document.querySelectorAll('input[name="pg-density"]');
  const motionInputs = document.querySelectorAll('input[name="pg-motion"]');
  const cardInputs = document.querySelectorAll('input[name="pg-card-style"]');

  themeInputs.forEach((input) => {
    input.checked = input.value === settings.theme;
  });
  densityInputs.forEach((input) => {
    input.checked = input.value === settings.density;
  });
  motionInputs.forEach((input) => {
    input.checked = input.value === settings.motion;
  });
  cardInputs.forEach((input) => {
    input.checked = input.value === settings.cardStyle;
  });

  // checkboxes
  const ev = document.getElementById("pg-show-ev");
  const streaks = document.getElementById("pg-show-streaks");
  const hints = document.getElementById("pg-show-hints");
  if (ev) ev.checked = settings.showEV;
  if (streaks) streaks.checked = settings.showStreaks;
  if (hints) hints.checked = settings.showHints;
}

function wirePanel(settings) {
  const toggleBtn = document.getElementById("pg-settings-toggle");
  const backdrop = document.getElementById("pg-settings-backdrop");
  const closeBtn = document.getElementById("pg-settings-close");
  const resetBtn = document.getElementById("pg-settings-reset");

  if (!toggleBtn || !backdrop) return; // no settings on this page

  const openPanel = () => {
    backdrop.classList.add("pg-settings-backdrop--open");
  };
  const closePanel = () => {
    backdrop.classList.remove("pg-settings-backdrop--open");
  };

  toggleBtn.addEventListener("click", openPanel);
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closePanel();
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const fresh = { ...DEFAULT_SETTINGS };
      saveSettings(fresh);
      applySettings(fresh);
      syncControls(fresh);
    });
  }

  // handle option changes
  const onChange = () => {
    const next = { ...settings };

    const themeInput = document.querySelector(
      'input[name="pg-theme"]:checked'
    );
    const densityInput = document.querySelector(
      'input[name="pg-density"]:checked'
    );
    const motionInput = document.querySelector(
      'input[name="pg-motion"]:checked'
    );
    const cardInput = document.querySelector(
      'input[name="pg-card-style"]:checked'
    );

    if (themeInput) next.theme = themeInput.value;
    if (densityInput) next.density = densityInput.value;
    if (motionInput) next.motion = motionInput.value;
    if (cardInput) next.cardStyle = cardInput.value;

    const ev = document.getElementById("pg-show-ev");
    const streaks = document.getElementById("pg-show-streaks");
    const hints = document.getElementById("pg-show-hints");

    if (ev) next.showEV = ev.checked;
    if (streaks) next.showStreaks = streaks.checked;
    if (hints) next.showHints = hints.checked;

    settings.theme = next.theme;
    settings.density = next.density;
    settings.motion = next.motion;
    settings.cardStyle = next.cardStyle;
    settings.showEV = next.showEV;
    settings.showStreaks = next.showStreaks;
    settings.showHints = next.showHints;

    saveSettings(settings);
    applySettings(settings);
  };

  document
    .querySelectorAll(
      'input[name="pg-theme"], input[name="pg-density"], input[name="pg-motion"], input[name="pg-card-style"]'
    )
    .forEach((el) => {
      el.addEventListener("change", onChange);
    });

  ["pg-show-ev", "pg-show-streaks", "pg-show-hints"].forEach((id) => {
    const cb = document.getElementById(id);
    if (cb) cb.addEventListener("change", onChange);
  });
}

function init() {
  const settings = loadSettings();
  applySettings(settings);
  syncControls(settings);
  wirePanel(settings);
}

init();
