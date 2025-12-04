import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { isProUser } from "../../core/settings.js";
// Note: We need to add recordCrash to stats.js in the next step
import { recordCrash } from "../../core/stats.js";

// ----- Game Constants -----
const HOUSE_EDGE = 0.04; // 4% chance to instant crash at 1.00x or early
const SPEED = 0.05; // Growth speed factor

// ----- State -----
const state = {
  balance: 0,
  bet: 10,
  autoEject: 0,
  gameActive: false,
  crashed: false,
  startTime: 0,
  currentMult: 1.00,
  crashPoint: 0,
  playerEjected: false,
  animationId: null,
};

// ----- DOM -----
const el = {
  balance: document.getElementById("crash-balance"),
  balanceBox: document.getElementById("crash-balance-box"),
  bet: document.getElementById("crash-bet"),
  betMin: document.getElementById("crash-bet-min"),
  allIn: document.getElementById("crash-all-in"),
  auto: document.getElementById("crash-auto"),
  btnPlay: document.getElementById("crash-play"),
  btnEject: document.getElementById("crash-eject"),
  status: document.getElementById("crash-status"),
  canvas: document.getElementById("crash-canvas"),
  overlayMult: document.getElementById("crash-current-mult"),
  overlayText: document.getElementById("crash-crashed-text"),
  history: document.getElementById("crash-history-list"),
  
  // Pro
  proPanel: document.getElementById("crash-pro-panel"),
  riskText: document.getElementById("crash-risk-text"),
  riskBar: document.getElementById("crash-risk-bar"),
  infoOpen: document.getElementById("crash-info-open"),
  infoClose: document.getElementById("crash-info-close"),
  infoPanel: document.getElementById("crash-info-panel"),
};

// Canvas Context
const ctx = el.canvas.getContext("2d");

// ----- Math Helper -----
function generateCrashPoint() {
  // E = 1 / (1 - p) formula inverted
  // We want a distribution where 1.00 is possible (instant loss)
  // Use Math.random() [0, 1)
  
  const r = Math.random();
  // 4% chance to crash immediately at 1.00x (House Edge)
  if (r < HOUSE_EDGE) return 1.00;
  
  // Otherwise, standard inverse distribution
  // 0.99 / (1 - r) scaled to ensure we start > 1.00
  // Simplified: 0.96 / (1 - r)
  // Example: r=0.5 -> 1.92x. r=0.9 -> 9.6x
  const crash = (1 - HOUSE_EDGE) / (1 - r);
  return Math.max(1.00, crash);
}

// ----- UI Helpers -----
function syncBalance() {
  state.balance = getBalance();
  el.balance.textContent = formatCoins(state.balance);
}

function setStatus(msg, color) {
  el.status.textContent = msg;
  el.status.style.color = color || "#e5e7eb";
}

function addHistory(mult) {
  const badge = document.createElement("span");
  badge.className = `crash-badge ${mult >= 2 ? "crash-badge--high" : "crash-badge--low"}`;
  badge.textContent = `${mult.toFixed(2)}x`;
  el.history.prepend(badge);
  if (el.history.children.length > 10) el.history.lastChild.remove();
}

// ----- Game Loop -----
function updateGraph() {
  const width = el.canvas.width;
  const height = el.canvas.height;
  
  // Clear
  ctx.clearRect(0, 0, width, height);
  
  // Calculate time elapsed
  const now = performance.now();
  const elapsed = (now - state.startTime) / 1000; // seconds
  
  // Growth function: M(t) = e^(k*t)
  // We want 1.00 at t=0
  state.currentMult = Math.pow(Math.E, SPEED * elapsed);
  
  // Update Overlay
  el.overlayMult.textContent = `${state.currentMult.toFixed(2)}x`;
  
  // Update Pro Risk Meter
  if (isProUser()) {
    // Probability of surviving until X is roughly 1/X
    // Risk of crashing NOW increases as we go
    const probCrash = (1 - (1 / state.currentMult)) * 100;
    el.riskBar.style.width = `${Math.min(100, probCrash)}%`;
    el.riskText.textContent = `Crash Probability: ${probCrash.toFixed(1)}%`;
  }

  // Draw Graph Line
  ctx.beginPath();
  ctx.moveTo(0, height);
  
  // Draw curve
  // We map time (x) to width and mult (y) to height
  // Scale so 10s = full width, 2x = 50% height initially?
  // Dynamic scaling is better: zoom out as we grow
  
  const timeScale = width / Math.max(10, elapsed * 1.5);
  const multScale = height / Math.max(2, state.currentMult * 1.2);
  
  for (let t = 0; t <= elapsed; t += 0.1) {
    const m = Math.pow(Math.E, SPEED * t);
    const x = t * timeScale;
    const y = height - (m - 1) * multScale; // Start at bottom (m=1 -> y=height)
    ctx.lineTo(x, y);
  }
  
  ctx.strokeStyle = state.currentMult >= 2 ? "#4ade80" : "#6366f1";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Auto Eject Check
  if (state.autoEject > 0 && state.currentMult >= state.autoEject && !state.playerEjected) {
    eject();
  }

  // Crash Check
  if (state.currentMult >= state.crashPoint) {
    crash();
  } else {
    state.animationId = requestAnimationFrame(updateGraph);
  }
}

function startGame() {
  if (state.gameActive) return;
  
  const bet = Number(el.bet.value);
  const auto = Number(el.auto.value);
  if (bet <= 0 || bet > state.balance) {
    alert("Invalid bet.");
    return;
  }

  // Dedicate Bet
  state.bet = bet;
  state.balance = changeBalance(-bet);
  state.autoEject = auto;
  state.gameActive = true;
  state.crashed = false;
  state.playerEjected = false;
  state.crashPoint = generateCrashPoint();
  state.startTime = performance.now();
  state.currentMult = 1.00;
  
  syncBalance();
  
  // UI Reset
  el.btnPlay.style.display = "none";
  el.btnEject.style.display = "inline-block";
  el.btnEject.disabled = false;
  el.btnEject.textContent = "EJECT";
  el.overlayText.style.display = "none";
  el.overlayMult.style.color = "#f5f5f5";
  setStatus("Multipler rising...", null);
  
  // Start Loop
  state.animationId = requestAnimationFrame(updateGraph);
}

function eject() {
  if (!state.gameActive || state.playerEjected || state.crashed) return;
  
  state.playerEjected = true;
  const payout = state.bet * state.currentMult;
  const profit = payout - state.bet;
  
  state.balance = changeBalance(payout);
  syncBalance();
  
  el.btnEject.disabled = true;
  el.btnEject.textContent = `Won ${formatCoins(profit)}`;
  setStatus(`Cashed out at ${state.currentMult.toFixed(2)}x! (+${formatCoins(profit)})`, "#4ade80");
  
  recordCrash({ bet: state.bet, profit: profit, outcome: "win", multiplier: state.currentMult });
}

function crash() {
  cancelAnimationFrame(state.animationId);
  state.gameActive = false;
  state.crashed = true;
  
  el.overlayMult.textContent = `${state.crashPoint.toFixed(2)}x`;
  el.overlayMult.style.color = "#f97373";
  el.overlayText.style.display = "block";
  el.overlayText.textContent = `CRASHED @ ${state.crashPoint.toFixed(2)}x`;
  
  el.btnPlay.style.display = "inline-block";
  el.btnEject.style.display = "none";
  
  if (state.playerEjected) {
    // Already won
  } else {
    // Loss
    setStatus(`Crashed! You lost ${formatCoins(state.bet)}`, "#f97373");
    recordCrash({ bet: state.bet, profit: -state.bet, outcome: "loss", multiplier: state.crashPoint });
  }
  
  addHistory(state.crashPoint);
}

// ----- Init -----
function init() {
  syncBalance();
  
  // Handle Pro UI
  if (isProUser()) {
    el.proPanel.style.opacity = 1;
    el.riskText.textContent = "Risk graph active.";
  } else {
    el.riskText.textContent = "Upgrade to Pro to see live risk.";
  }

  el.btnPlay.addEventListener("click", startGame);
  el.btnEject.addEventListener("click", eject);
  
  el.betMin.addEventListener("click", () => el.bet.value = 1);
  el.allIn.addEventListener("click", () => el.bet.value = state.balance);
  
  // Info panel
  if (el.infoOpen) el.infoOpen.addEventListener("click", () => el.infoPanel.classList.add("game-info-panel--open"));
  if (el.infoClose) el.infoClose.addEventListener("click", () => el.infoPanel.classList.remove("game-info-panel--open"));
}

init();