import { getBalance, changeBalance, formatCoins } from "../../core/wallet.js";
import { recordMarket } from "../../core/stats.js";
import { isProUser } from "../../core/settings.js";

// ----- Config -----
const TICK_RATE = 100; // ms
const VOLATILITY = 0.2; // Price movement scale
const MAX_HISTORY = 200; // Chart width

// ----- State -----
const state = {
  price: 100.00,
  history: [], // {price, time}
  position: null, // { type: 'long'|'short', entry: 100, margin: 10, leverage: 10, size: 100, liq: 90 }
  interval: null,
  proEnabled: false
};

// ----- DOM -----
const el = {
  balance: document.getElementById("market-balance"),
  price: document.getElementById("market-current-price"),
  canvas: document.getElementById("market-canvas"),
  
  // Controls
  margin: document.getElementById("market-margin"),
  leverage: document.getElementById("market-leverage"),
  levVal: document.getElementById("market-lev-val"),
  btnLong: document.getElementById("market-long"),
  btnShort: document.getElementById("market-short"),
  
  // Position UI
  posPanel: document.getElementById("market-position-panel"),
  controlsPanel: document.getElementById("market-controls"),
  posType: document.getElementById("market-pos-type"),
  pnl: document.getElementById("market-pnl"),
  entry: document.getElementById("market-entry"),
  liq: document.getElementById("market-liq"),
  btnClose: document.getElementById("market-close"),
  
  // Helpers
  btnMin: document.getElementById("market-margin-min"),
  btnAll: document.getElementById("market-margin-all"),
  msg: document.getElementById("market-message"),
  
  // Pro
  proPanel: document.getElementById("market-pro-panel"),
  proText: document.getElementById("market-pro-text"),
  chkFast: document.getElementById("market-sma-fast"),
  chkSlow: document.getElementById("market-sma-slow"),
  
  infoOpen: document.getElementById("market-info-open"),
  infoClose: document.getElementById("market-info-close"),
  infoPanel: document.getElementById("market-info-panel"),
};

const ctx = el.canvas.getContext("2d");

// ----- Math Engine -----
function nextPrice() {
  // Geometric Brownian Motion (simplified)
  // New Price = Old Price * e^(drift + volatility * random)
  // We assume 0 drift for a "fair" random walk
  const change = (Math.random() - 0.5) * VOLATILITY;
  state.price = state.price * (1 + change / 100);
  if (state.price < 0.01) state.price = 0.01;
}

function updateChart() {
  const w = el.canvas.width;
  const h = el.canvas.height;
  
  // Shift history
  state.history.push(state.price);
  if (state.history.length > MAX_HISTORY) state.history.shift();
  
  // Clear
  ctx.clearRect(0, 0, w, h);
  
  // Scale logic
  const minP = Math.min(...state.history) * 0.99;
  const maxP = Math.max(...state.history) * 1.01;
  const range = maxP - minP || 1;
  
  function getY(p) {
    return h - ((p - minP) / range) * h;
  }
  
  // Draw Grid
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, getY(state.position?.entry || -1)); // Entry line placeholder if needed
  ctx.stroke();

  // --- DRAW PRO INDICATORS (SMA) ---
  if (isProUser()) {
    if (el.chkFast.checked) drawSMA(10, "#3b82f6"); // Blue
    if (el.chkSlow.checked) drawSMA(50, "#eab308"); // Yellow
  }

  // Draw Price Line
  ctx.beginPath();
  ctx.strokeStyle = state.history[state.history.length-1] >= state.history[0] ? "#4ade80" : "#f97373";
  ctx.lineWidth = 3;
  
  const stepX = w / (MAX_HISTORY - 1);
  state.history.forEach((p, i) => {
    const x = i * stepX;
    const y = getY(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Draw Entry Line & Liq Line if in position
  if (state.position) {
    // Entry (Blue Dashed)
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#60a5fa";
    ctx.moveTo(0, getY(state.position.entry));
    ctx.lineTo(w, getY(state.position.entry));
    ctx.stroke();
    
    // Liq (Red Dashed)
    ctx.beginPath();
    ctx.strokeStyle = "#f87171";
    ctx.moveTo(0, getY(state.position.liq));
    ctx.lineTo(w, getY(state.position.liq));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSMA(period, color) {
  if (state.history.length < period) return;
  const w = el.canvas.width;
  const h = el.canvas.height;
  const minP = Math.min(...state.history) * 0.99;
  const maxP = Math.max(...state.history) * 1.01;
  const range = maxP - minP;
  const stepX = w / (MAX_HISTORY - 1);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  for (let i = period - 1; i < state.history.length; i++) {
    const slice = state.history.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const x = i * stepX;
    const y = h - ((avg - minP) / range) * h;
    if (i === period - 1) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ----- Trading Logic -----
function calcPnL() {
  if (!state.position) return 0;
  const { type, entry, size } = state.position;
  const current = state.price;
  
  // Long: (Current - Entry) / Entry * Size
  // Short: (Entry - Current) / Entry * Size
  const pctChange = (current - entry) / entry;
  const pnl = type === "long" ? pctChange * size : -pctChange * size;
  return pnl;
}

function checkLiquidation() {
  if (!state.position) return;
  const pnl = calcPnL();
  // Liquidated if loss >= margin
  if (pnl <= -state.position.margin) {
    closePosition(true);
  } else {
    updatePosUI(pnl);
  }
}

function openPosition(type) {
  const margin = Number(el.margin.value);
  const leverage = Number(el.leverage.value);
  const balance = getBalance();
  
  if (margin <= 0 || margin > balance) {
    alert("Invalid margin.");
    return;
  }
  
  changeBalance(-margin);
  syncUI();
  
  const size = margin * leverage;
  const entry = state.price;
  
  // Calc Liq Price
  // Long: Price drops by 1/Lev. Ex: 10x lev, 10% drop kills it.
  // Liq = Entry * (1 - 1/Lev)
  // Short: Liq = Entry * (1 + 1/Lev)
  let liq;
  if (type === "long") liq = entry * (1 - 1/leverage);
  else liq = entry * (1 + 1/leverage);
  
  state.position = { type, entry, margin, leverage, size, liq };
  
  el.controlsPanel.style.display = "none";
  el.posPanel.style.display = "block";
  el.msg.textContent = "Position Open. Monitoring price...";
}

function closePosition(isLiq = false) {
  if (!state.position) return;
  
  const pnl = calcPnL();
  const margin = state.position.margin;
  
  if (isLiq) {
    el.msg.textContent = "LIQUIDATED! Position wiped out.";
    el.msg.style.color = "#f97373";
    recordMarket({ bet: margin, profit: -margin, outcome: "loss" });
  } else {
    const totalReturn = margin + pnl;
    changeBalance(totalReturn);
    const outcome = pnl > 0 ? "win" : "loss";
    el.msg.textContent = `Closed. PnL: ${formatCoins(pnl)}`;
    el.msg.style.color = pnl >= 0 ? "#4ade80" : "#f97373";
    recordMarket({ bet: margin, profit: pnl, outcome });
  }
  
  state.position = null;
  syncUI();
  el.controlsPanel.style.display = "block";
  el.posPanel.style.display = "none";
}

function updatePosUI(pnl) {
  el.pnl.textContent = (pnl >= 0 ? "+" : "") + formatCoins(pnl);
  el.pnl.className = "market-pnl " + (pnl >= 0 ? "win" : "loss");
  el.marketPosType = document.getElementById("market-pos-type");
  el.marketPosType.textContent = `${state.position.type.toUpperCase()} ${state.position.leverage}x`;
  el.entry.textContent = state.position.entry.toFixed(2);
  el.liq.textContent = state.position.liq.toFixed(2);
}

// ----- Main Loop -----
function tick() {
  nextPrice();
  el.price.textContent = state.price.toFixed(2);
  
  updateChart();
  
  if (state.position) checkLiquidation();
  
  setTimeout(() => requestAnimationFrame(tick), TICK_RATE);
}

function syncUI() {
  el.balance.textContent = formatCoins(getBalance());
}

function init() {
  syncUI();
  
  // Fill initial history
  for(let i=0; i<MAX_HISTORY; i++) state.history.push(100.00);
  
  // Pro check
  if (isProUser()) {
    el.proPanel.style.opacity = 1;
    el.proText.textContent = "SMA Indicators Unlocked.";
    el.chkFast.disabled = false;
    el.chkSlow.disabled = false;
  }

  // Events
  el.leverage.addEventListener("input", (e) => el.levVal.textContent = e.target.value + "x");
  el.btnLong.addEventListener("click", () => openPosition("long"));
  el.btnShort.addEventListener("click", () => openPosition("short"));
  el.btnClose.addEventListener("click", () => closePosition(false));
  
  el.btnMin.addEventListener("click", () => el.margin.value = 10);
  el.btnAll.addEventListener("click", () => el.margin.value = getBalance());

  if(el.infoOpen) {
    el.infoOpen.addEventListener("click", () => el.infoPanel.classList.add("game-info-panel--open"));
    el.infoClose.addEventListener("click", () => el.infoPanel.classList.remove("game-info-panel--open"));
  }

  tick();
}

init();