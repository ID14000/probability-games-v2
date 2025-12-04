// Plinko Game v2 – triangular board + auto-drop + streaks + Pro Simulator

import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { recordPlinko } from "../../core/stats.js";
import { isProUser } from "../../core/settings.js";

// Canvas / board config
const BOARD = {
  width: 520,
  height: 620,
  topOffset: 60,
  binHeight: 100,
};

const SETTLE_VEL_THRESHOLD = 0.18;
const SETTLE_TIME_MS = 350;
const MAX_BALL_AGE_MS = 12000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- State -----
const state = {
  balance: 0,
  risk: "medium", // low | medium | high
  rows: 12,
  multipliers: [],
  // entries: { body, bet, profitResolved, removed, lastStillTime, spawnTime, removeTime }
  balls: [],
  totalDrops: 0,
  wins: 0,
  losses: 0,
  currentStreakType: null, // "win" | "loss" | null
  currentStreakLength: 0,
  bestWinStreak: 0,
  bestLossStreak: 0,
  autoRunning: false,
  autoStopRequested: false,
  simRunning: false,
};

// ----- DOM -----
const el = {
  balanceBox: document.getElementById("plinko-balance-box"),
  balance: document.getElementById("plinko-balance"),
  bet: document.getElementById("plinko-bet"),
  betMin: document.getElementById("plinko-bet-min"),
  allIn: document.getElementById("plinko-all-in"),
  dropBtn: document.getElementById("plinko-drop"),
  autoButtons: document.querySelectorAll(".plinko-auto-btn"),
  autoStop: document.getElementById("plinko-auto-stop"),
  message: document.getElementById("plinko-message"),
  historyList: document.getElementById("plinko-history-list"),
  historySummary: document.getElementById("plinko-history-summary"),
  multipliers: document.getElementById("plinko-multipliers"),
  canvas: document.getElementById("plinko-canvas"),
  riskButtons: document.querySelectorAll(".plinko-risk-btn"),
  rowsSelect: document.getElementById("plinko-rows"),
  dialog: document.getElementById("plinko-dialog"),
  dialogConfirm: document.getElementById("plinko-confirm-all-in"),
  dialogCancel: document.getElementById("plinko-cancel-all-in"),
  infoOpen: document.getElementById("plinko-info-open"),
  infoClose: document.getElementById("plinko-info-close"),
  infoPanel: document.getElementById("plinko-info-panel"),
  boardPanel: document.getElementById("plinko-board-panel"),
  boardSetup: document.getElementById("plinko-board-setup"),
  
  // PRO UI
  proPanel: document.getElementById("plinko-pro-panel"),
  simButtons: document.querySelectorAll(".plinko-sim-btn"),
  simResults: document.getElementById("plinko-sim-results"),
};

// ----- PRO Feature: Simulation -----
function setupProFeature() {
  if (isProUser()) {
    el.proPanel.style.opacity = 1;
    el.simButtons.forEach(btn => btn.disabled = false);
    
    // Attach listeners if not already done (simple check)
    if (!el.simButtons[0].hasAttribute("data-listening")) {
      el.simButtons.forEach(btn => {
        btn.setAttribute("data-listening", "true");
        btn.addEventListener("click", () => {
          const count = Number(btn.dataset.count);
          runSimulation(count);
        });
      });
    }
  } else {
    el.proPanel.style.opacity = 0.6;
    el.simButtons.forEach(btn => btn.disabled = true);
    el.simResults.textContent = "Upgrade to Pro to unlock simulations.";
  }
}

function runSimulation(count) {
  if (state.simRunning || state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;

  state.simRunning = true;
  el.simResults.textContent = `Simulating ${count.toLocaleString()} drops...`;

  setTimeout(() => {
    // Pure math simulation:
    // Plinko is a binomial distribution. 
    // Bin index = number of "right" turns.
    // For each ball, we simulate 'rows' coin flips. 
    // 0 = Left, 1 = Right. Sum = Bin Index.
    
    let simTotalProfit = 0;
    let simWins = 0;
    const hitsPerBin = new Array(state.multipliers.length).fill(0);
    const rows = state.rows;

    for (let i = 0; i < count; i++) {
      let rightTurns = 0;
      for (let r = 0; r < rows; r++) {
        if (Math.random() > 0.5) rightTurns++;
      }
      
      const multiplier = state.multipliers[rightTurns];
      hitsPerBin[rightTurns]++;
      
      const payout = bet * multiplier;
      simTotalProfit += (payout - bet);
      
      if (payout > bet) simWins++;
    }

    // Find most hit multiplier
    let maxHits = 0;
    let mostCommonMult = 0;
    hitsPerBin.forEach((hits, idx) => {
      if (hits > maxHits) {
        maxHits = hits;
        mostCommonMult = state.multipliers[idx];
      }
    });

    const netProfitStr = simTotalProfit >= 0 ? `+${formatCoins(simTotalProfit)}` : `−${formatCoins(Math.abs(simTotalProfit))}`;
    const color = simTotalProfit >= 0 ? "#4ade80" : "#f97373";
    const winRate = (simWins / count) * 100;

    el.simResults.innerHTML = `
      <ul style="list-style:none; padding:0; margin:0;">
        <li><strong>Net Profit:</strong> <span style="color:${color}">${netProfitStr} coins</span></li>
        <li><strong>Win Rate (>1x):</strong> ${winRate.toFixed(2)}%</li>
        <li><strong>Most Common Hit:</strong> ${mostCommonMult}x (${maxHits.toLocaleString()} times)</li>
      </ul>
    `;

    state.simRunning = false;
  }, 50);
}

// ----- UI helpers -----
function syncBalanceUI() {
  if (el.balance) {
    el.balance.textContent = formatCoins(state.balance);
  }
  if (el.bet) {
    el.bet.max = String(state.balance || 0);
  }
}

function setMessage(text, type) {
  if (!el.message) return;
  el.message.textContent = text;
  el.message.classList.remove("plinko-message--good", "plinko-message--bad");
  if (type === "good") el.message.classList.add("plinko-message--good");
  if (type === "bad") el.message.classList.add("plinko-message--bad");
}

function flashBalance(isWin) {
  if (!el.balanceBox) return;
  el.balanceBox.classList.remove(
    "plinko-balance-box--win",
    "plinko-balance-box--loss"
  );
  // force reflow
  void el.balanceBox.offsetWidth;
  el.balanceBox.classList.add(
    isWin ? "plinko-balance-box--win" : "plinko-balance-box--loss"
  );
  setTimeout(() => {
    el.balanceBox.classList.remove(
      "plinko-balance-box--win",
      "plinko-balance-box--loss"
    );
  }, 600);
}

function formatStreakText() {
  if (!state.currentStreakType || state.currentStreakLength === 0) {
    return "Streak: –";
  }
  const label = state.currentStreakType === "win" ? "win" : "loss";
  const plural = state.currentStreakLength === 1 ? "" : "s";
  return `Streak: ${state.currentStreakLength} ${label}${plural}`;
}

function setAutoControlsRunning(running) {
  if (el.dropBtn) {
    el.dropBtn.disabled = running;
    el.dropBtn.textContent = running ? "Auto running…" : "Drop ball";
  }
  el.autoButtons.forEach((btn) => {
    btn.disabled = running;
  });
  if (el.autoStop) {
    el.autoStop.disabled = !running;
  }
}

// ----- History & multipliers -----
function addHistoryEntry({ binIndex, multiplier, bet, profit }) {
  if (!el.historyList || !el.historySummary) return;

  const li = document.createElement("li");
  li.className = "plinko-history-item";
  if (profit > 0) li.classList.add("plinko-history-item--win");
  if (profit < 0) li.classList.add("plinko-history-item--loss");

  li.innerHTML = `
    <span>Bin: <strong>${binIndex + 1}</strong></span>
    <span>Mult: ${multiplier.toFixed(2)}x</span>
    <span>Bet: ${formatCoins(bet)}</span>
    <span>${profit >= 0 ? "+" : "−"}${formatCoins(Math.abs(profit))}</span>
  `;

  el.historyList.prepend(li);

  state.totalDrops += 1;
  if (profit > 0) state.wins += 1;
  if (profit < 0) state.losses += 1;

  // streaks
  let outcome = "push";
  if (profit > 0) outcome = "win";
  else if (profit < 0) outcome = "loss";

  if (outcome === "win" || outcome === "loss") {
    if (state.currentStreakType === outcome) {
      state.currentStreakLength += 1;
    } else {
      state.currentStreakType = outcome;
      state.currentStreakLength = 1;
    }
  } else {
    state.currentStreakType = null;
    state.currentStreakLength = 0;
  }

  if (state.currentStreakType === "win") {
    state.bestWinStreak = Math.max(
      state.bestWinStreak,
      state.currentStreakLength
    );
  } else if (state.currentStreakType === "loss") {
    state.bestLossStreak = Math.max(
      state.bestLossStreak,
      state.currentStreakLength
    );
  }

  const winRate =
    state.totalDrops === 0 ? 0 : (state.wins / state.totalDrops) * 100;
  const streakText = formatStreakText();

  el.historySummary.textContent = `Drops: ${state.totalDrops} • Win rate: ${winRate.toFixed(
    1
  )}% • ${streakText}`;
}

function getBinColor(index, count) {
  // centre ≈ yellow, edges ≈ red
  if (count <= 1) {
    return {
      background: "hsl(48, 90%, 55%)",
      border: "hsl(48, 85%, 45%)",
    };
  }
  const center = (count - 1) / 2;
  const dist = Math.abs(index - center) / center; // 0 centre -> 1 edge
  const hue = 48 - 48 * dist;
  const light = 55 - 8 * dist;
  return {
    background: `hsl(${hue}, 90%, ${light}%)`,
    border: `hsl(${hue}, 85%, ${light - 8}%)`,
  };
}

function renderMultiplierChips() {
  if (!el.multipliers) return;
  el.multipliers.innerHTML = "";

  const count = state.multipliers.length;
  if (!count) return;
  const lastIndex = count - 1;
  const width = 100 / count;

  state.multipliers.forEach((m, i) => {
    const chip = document.createElement("div");
    chip.className = "plinko-mult-chip";
    if (i === 0 || i === lastIndex || m >= 5) {
      chip.classList.add("plinko-mult-chip--big");
    }
    chip.textContent = `${m.toFixed(2)}x`;

    chip.style.flex = `0 0 ${width}%`;
    chip.style.maxWidth = `${width}%`;
    chip.style.width = `${width}%`;

    const colors = getBinColor(i, count);
    chip.style.backgroundColor = colors.background;
    chip.style.borderColor = colors.border;
    chip.style.color = "#020617";

    el.multipliers.appendChild(chip);
  });
}

function updateRiskButtonsUI() {
  el.riskButtons.forEach((btn) => {
    btn.classList.toggle(
      "plinko-risk-btn--active",
      btn.dataset.risk === state.risk
    );
  });
}

function syncBoardSetupLabel() {
  if (!el.boardSetup) return;
  const riskLabel = state.risk.charAt(0).toUpperCase() + state.risk.slice(1);
  el.boardSetup.textContent = `${riskLabel} risk • ${state.rows} rows`;
}

function syncBoardRiskClass() {
  if (!el.boardPanel) return;
  el.boardPanel.classList.remove(
    "plinko-board-panel--low",
    "plinko-board-panel--medium",
    "plinko-board-panel--high"
  );
  el.boardPanel.classList.add(`plinko-board-panel--${state.risk}`);
}

// ----- Multipliers (math side) -----
function generateMultipliers(risk, rows) {
  // Symmetric exponential from low centre to high edges
  const bins = rows + 1;
  const center = (bins - 1) / 2;

  let centerLow;
  let edgeHigh;
  if (risk === "low") {
    centerLow = 0.9;
    edgeHigh = 4;
  } else if (risk === "high") {
    centerLow = 0.2;
    edgeHigh = 30;
  } else {
    // medium
    centerLow = 0.5;
    edgeHigh = 12;
  }

  const alpha = Math.log(edgeHigh / centerLow) / center;
  const out = [];
  for (let i = 0; i < bins; i += 1) {
    const d = Math.abs(i - center);
    const m = centerLow * Math.exp(alpha * d);
    out.push(Number(m.toFixed(2)));
  }
  return out;
}

// ----- Dialog -----
function openDialog() {
  if (!el.dialog || state.balance <= 0) return;
  el.dialog.classList.add("plinko-dialog-backdrop--open");
}

function closeDialog() {
  if (!el.dialog) return;
  el.dialog.classList.remove("plinko-dialog-backdrop--open");
}

// ----- Physics setup -----
let engine;
let world;
let runner;
let renderRef;
let staticBodies = [];

function clearStaticBodies() {
  if (!world || !staticBodies.length) return;
  staticBodies.forEach((b) => Matter.World.remove(world, b));
  staticBodies = [];
}

function buildBoard() {
  if (!world) return;
  const { Bodies, World } = Matter;

  clearStaticBodies();

  const wallThickness = 40;
  const ground = Bodies.rectangle(
    BOARD.width / 2,
    BOARD.height + wallThickness / 2,
    BOARD.width,
    wallThickness,
    { isStatic: true, render: { fillStyle: "#020617" } }
  );
  const leftWall = Bodies.rectangle(
    -wallThickness / 2,
    BOARD.height / 2,
    wallThickness,
    BOARD.height * 2,
    { isStatic: true, render: { fillStyle: "#020617" } }
  );
  const rightWall = Bodies.rectangle(
    BOARD.width + wallThickness / 2,
    BOARD.height / 2,
    wallThickness,
    BOARD.height * 2,
    { isStatic: true, render: { fillStyle: "#020617" } }
  );

  World.add(world, [ground, leftWall, rightWall]);
  staticBodies.push(ground, leftWall, rightWall);

  const pegRows = state.rows;
  if (pegRows <= 0) return;

  const topY = BOARD.topOffset;
  const bottomY = BOARD.height - BOARD.binHeight - 32;
  const gapY = pegRows > 1 ? (bottomY - topY) / (pegRows - 1) : 0;

  const sideMargin = 55;
  const lastRowCount = pegRows;
  const gapX =
    lastRowCount > 1
      ? (BOARD.width - sideMargin * 2) / (lastRowCount - 1)
      : BOARD.width / 2;

  const pegRadius = pegRows > 12 ? 4 : 5;

  // Triangle of pegs: row 1 at top centre, last row = rows pegs
  for (let row = 0; row < pegRows; row += 1) {
    const count = row + 1;
    const rowWidth = (count - 1) * gapX;
    const startX = (BOARD.width - rowWidth) / 2;
    const y = topY + row * gapY;

    for (let i = 0; i < count; i += 1) {
      const x = startX + i * gapX;
      const peg = Bodies.circle(x, y, pegRadius, {
        isStatic: true,
        restitution: 0.35,
        friction: 0.1,
        render: { fillStyle: "#e5e7eb" },
      });
      World.add(world, peg);
      staticBodies.push(peg);
    }
  }

  // Bin dividers
  const binCount = pegRows + 1;
  const binWidth = BOARD.width / binCount;
  const dividerHeight = BOARD.binHeight + 40;

  for (let i = 0; i <= binCount; i += 1) {
    const x = i * binWidth;
    const divider = Bodies.rectangle(
      x,
      BOARD.height - BOARD.binHeight / 2,
      4,
      dividerHeight,
      {
        isStatic: true,
        render: { fillStyle: "#111827" },
      }
    );
    World.add(world, divider);
    staticBodies.push(divider);
  }
}

function initEngine() {
  if (!el.canvas) return;
  if (typeof Matter === "undefined") {
    console.error("Matter.js is not loaded – Plinko board will not render.");
    setMessage("Physics engine failed to load. Try refreshing the page.", "bad");
    return;
  }

  const { Engine, Render, Runner, Events } = Matter;

  engine = Engine.create({
    gravity: { x: 0, y: 1 },
  });
  world = engine.world;

  renderRef = Render.create({
    canvas: el.canvas,
    engine,
    options: {
      width: BOARD.width,
      height: BOARD.height,
      background: "#020617",
      wireframes: false,
      pixelRatio: window.devicePixelRatio || 1,
    },
  });

  Render.run(renderRef);
  runner = Runner.create();
  Runner.run(runner, engine);

  buildBoard();

  Events.on(engine, "afterUpdate", handlePhysicsTick);
}

// ----- Physics tick + resolution -----
function handlePhysicsTick() {
  if (!engine) return;
  const now = performance.now();
  const { World } = Matter;

  state.balls.forEach((entry) => {
    if (entry.removed) return;
    const body = entry.body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const y = body.position.y;

    if (!entry.profitResolved) {
      const inBinZone = y > BOARD.height - BOARD.binHeight;
      const slow = speed < SETTLE_VEL_THRESHOLD;

      if (inBinZone && slow) {
        if (entry.lastStillTime == null) {
          entry.lastStillTime = now;
        } else if (now - entry.lastStillTime >= SETTLE_TIME_MS) {
          resolveBall(entry);
        }
      } else {
        entry.lastStillTime = null;
      }

      if (now - entry.spawnTime > MAX_BALL_AGE_MS) {
        resolveBall(entry);
      }
    } else {
      if (!entry.removeTime) {
        entry.removeTime = now;
      } else if (now - entry.removeTime > 1500) {
        World.remove(world, body);
        entry.removed = true;
      }
    }
  });

  state.balls = state.balls.filter((b) => !b.removed);
}

function resolveBall(entry) {
  if (entry.profitResolved) return;
  entry.profitResolved = true;

  const { body, bet } = entry;

  // Map final x-position to a bin index
  const binCount = state.multipliers.length;
  const binWidth = BOARD.width / binCount;

  let x = body.position.x;
  // clamp to [0, BOARD.width)
  if (x < 0) x = 0;
  if (x >= BOARD.width) x = BOARD.width - 0.0001;

  const binIndex = Math.floor(x / binWidth);
  const multiplier = state.multipliers[binIndex];

  const amount = bet * multiplier;
  const profit = amount - bet;

  state.balance = changeBalance(amount);
  if (state.balance < 0) {
    state.balance = setBalance(0);
  }
  syncBalanceUI();

  if (profit > 0) {
    flashBalance(true);
    setMessage(
      `Hit ${multiplier.toFixed(2)}x on bin ${binIndex + 1}! Profit +${formatCoins(
        profit
      )}.`,
      "good"
    );
  } else if (profit < 0) {
    flashBalance(false);
    setMessage(
      `Landed on ${multiplier.toFixed(
        2
      )}x (bin ${binIndex + 1}). You lost −${formatCoins(
        Math.abs(profit)
      )}.`,
      "bad"
    );
  } else {
    setMessage(
      `Hit 1.00x on bin ${binIndex + 1}. Bet returned.`,
      null
    );
  }

  addHistoryEntry({ binIndex, multiplier, bet, profit });
  recordPlinko({ bet, profit });
}

// ----- Betting & drop -----
function validateBet() {
  if (!el.bet) return null;
  const bet = Number(el.bet.value);
  if (!Number.isFinite(bet) || bet <= 0) {
    alert("Bet must be at least 1 coin.");
    return null;
  }
  if (bet > state.balance) {
    alert("You cannot bet more than your balance.");
    return null;
  }
  return bet;
}

function handleBetMin() {
  if (!el.bet) return;
  el.bet.value = "1";
}

function handleAllIn() {
  if (state.balance <= 0) return;
  openDialog();
}

function handleDialogConfirm() {
  if (!el.bet) return;
  el.bet.value = String(state.balance);
  closeDialog();
}

function handleDialogCancel() {
  closeDialog();
}

function spawnBall(bet) {
  if (!engine || !world) return;
  const { Bodies, World } = Matter;

  // Deduct bet upfront
  state.balance = changeBalance(-bet);
  if (state.balance < 0) {
    state.balance = setBalance(0);
  }
  syncBalanceUI();
  flashBalance(false);

  // Drop from near the top centre, with a bit of random horizontal jitter.
  const spawnX =
    BOARD.width / 2 + (Math.random() - 0.5) * (BOARD.width * 0.12);
  const spawnY = BOARD.topOffset * 0.4;

  const radius = 8;
  const ball = Bodies.circle(spawnX, spawnY, radius, {
    restitution: 0.35,
    friction: 0.02,
    frictionAir: 0.001,
    render: { fillStyle: "#6366f1" },
  });

  World.add(world, ball);

  state.balls.push({
    body: ball,
    bet,
    profitResolved: false,
    removed: false,
    lastStillTime: null,
    spawnTime: performance.now(),
    removeTime: null,
  });

  setMessage("Ball dropped. Watch where it lands…", null);
}

function handleSingleDrop() {
  if (state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;
  if (bet > state.balance) {
    alert("You cannot bet more than your balance.");
    return;
  }
  spawnBall(bet);
}

async function handleAutoDrop(count) {
  if (state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;
  if (state.balance < bet) {
    alert("Not enough balance to start auto-drop.");
    return;
  }

  state.autoRunning = true;
  state.autoStopRequested = false;
  setAutoControlsRunning(true);

  setMessage(`Auto-dropping ${count} balls…`, null);

  for (let i = 0; i < count; i += 1) {
    if (state.autoStopRequested) {
      setMessage(`Auto-drop stopped after ${i} balls.`, "bad");
      break;
    }
    if (state.balance < bet) {
      setMessage(
        `Auto-drop stopped after ${i} balls (balance too low).`,
        "bad"
      );
      break;
    }
    spawnBall(bet);
    setMessage(`Auto-drop in progress… ${i + 1}/${count}`, null);
    await wait(260);
  }

  state.autoRunning = false;
  setAutoControlsRunning(false);

  setMessage("Auto-drop finished (balls may still be falling).", null);
}

function handleAutoStop() {
  if (!state.autoRunning) return;
  state.autoStopRequested = true;
  setMessage("Auto-drop will stop after the current ball.", null);
}

// ----- Controls: risk, rows, info -----
function updateMathAndBoard() {
  if (el.rowsSelect) {
    const rowsVal = Number(el.rowsSelect.value);
    if (Number.isFinite(rowsVal) && rowsVal > 0) {
      state.rows = rowsVal;
    }
  }
  state.multipliers = generateMultipliers(state.risk, state.rows);
  renderMultiplierChips();
  updateRiskButtonsUI();
  syncBoardSetupLabel();
  syncBoardRiskClass();
  buildBoard();
}

function handleRiskClick(evt) {
  const btn = evt.currentTarget;
  const risk = btn.dataset.risk;
  if (!risk) return;
  state.risk = risk;
  updateRiskButtonsUI();
  updateMathAndBoard();
}

function handleRowsChange() {
  updateMathAndBoard();
}

function openInfo() {
  if (!el.infoPanel) return;
  el.infoPanel.classList.add("game-info-panel--open");
}

function closeInfo() {
  if (!el.infoPanel) return;
  el.infoPanel.classList.remove("game-info-panel--open");
}

// ----- Init -----
function init() {
  state.balance = getBalance();
  syncBalanceUI();

  if (el.rowsSelect) {
    const rowsVal = Number(el.rowsSelect.value);
    if (Number.isFinite(rowsVal) && rowsVal > 0) {
      state.rows = rowsVal;
    }
  }

  setMessage(
    "Choose your bet, risk and rows, then drop as many balls as you like.",
    null
  );

  initEngine();
  updateMathAndBoard();
  setupProFeature(); // Init PRO simulator buttons

  // Betting
  if (el.betMin) el.betMin.addEventListener("click", handleBetMin);
  if (el.allIn) el.allIn.addEventListener("click", handleAllIn);
  if (el.dialogConfirm) {
    el.dialogConfirm.addEventListener("click", handleDialogConfirm);
  }
  if (el.dialogCancel) {
    el.dialogCancel.addEventListener("click", handleDialogCancel);
  }

  // Drop controls
  if (el.dropBtn) el.dropBtn.addEventListener("click", handleSingleDrop);
  el.autoButtons.forEach((btn) => {
    const count = Number(btn.dataset.count);
    if (!Number.isFinite(count) || count <= 0) return;
    btn.addEventListener("click", () => handleAutoDrop(count));
  });
  if (el.autoStop) {
    el.autoStop.addEventListener("click", handleAutoStop);
  }

  // Risk & rows
  el.riskButtons.forEach((btn) => {
    btn.addEventListener("click", handleRiskClick);
  });
  if (el.rowsSelect) {
    el.rowsSelect.addEventListener("change", handleRowsChange);
  }

  // Info panel
  if (el.infoOpen && el.infoClose && el.infoPanel) {
    el.infoOpen.addEventListener("click", openInfo);
    el.infoClose.addEventListener("click", closeInfo);
    el.infoPanel.addEventListener("click", (e) => {
      if (e.target === el.infoPanel) closeInfo();
    });
  }

  setAutoControlsRunning(false);
}

init();