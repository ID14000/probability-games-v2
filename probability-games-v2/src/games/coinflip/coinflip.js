// Coin Flip – shared wallet, auto mode, streaks + Pro Variance Simulator

import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { isProUser } from "../../core/settings.js";

// Config: fair 50/50 coin with 2% house edge
const COIN_WIN_PROB = 0.5;
const HOUSE_EDGE = 0.02;
const COIN_MULTIPLIER = (1 / COIN_WIN_PROB) * (1 - HOUSE_EDGE); // 1.96
const EV_PER_BET = COIN_WIN_PROB * COIN_MULTIPLIER - 1; // -0.02

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- State -----
const state = {
  balance: 0,
  selectedSide: "heads",
  flips: 0,
  wins: 0,
  losses: 0,
  heads: 0,
  tails: 0,
  streakType: null, // "win" | "loss"
  streakLength: 0,
  bestWinStreak: 0,
  bestLossStreak: 0,
  autoRunning: false,
  autoStopRequested: false,
  simRunning: false,
};

// ----- DOM -----
const el = {
  balanceBox: document.getElementById("coin-balance-box"),
  balance: document.getElementById("coin-balance"),
  bet: document.getElementById("coin-bet"),
  betMin: document.getElementById("coin-bet-min"),
  allIn: document.getElementById("coin-all-in"),
  sideButtons: document.querySelectorAll(".coin-side-btn"),
  flipBtn: document.getElementById("coin-flip"),
  autoButtons: document.querySelectorAll(".coin-auto-btn"),
  autoStop: document.getElementById("coin-auto-stop"),
  message: document.getElementById("coin-message"),
  circle: document.getElementById("coin-circle"),
  statsSummary: document.getElementById("coin-stats-summary"),
  historyList: document.getElementById("coin-history-list"),
  dialog: document.getElementById("coin-dialog"),
  dialogConfirm: document.getElementById("coin-confirm-all-in"),
  dialogCancel: document.getElementById("coin-cancel-all-in"),
  infoOpen: document.getElementById("coin-info-open"),
  infoClose: document.getElementById("coin-info-close"),
  infoPanel: document.getElementById("coin-info-panel"),
  multiplier: document.getElementById("coin-multiplier"),
  edge: document.getElementById("coin-edge"),
  evText: document.getElementById("coin-ev-text"),
  
  // PRO UI
  proPanel: document.getElementById("coin-pro-panel"),
  simButtons: document.querySelectorAll(".coin-sim-btn"),
  simResults: document.getElementById("coin-sim-results"),
};

// ----- PRO Feature: Simulation -----
function setupProFeature() {
  if (isProUser()) {
    el.proPanel.style.opacity = 1;
    el.simButtons.forEach(btn => btn.disabled = false);
    
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
    el.simResults.textContent = "Upgrade to Pro to unlock variance simulations.";
  }
}

function runSimulation(count) {
  if (state.simRunning || state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;

  state.simRunning = true;
  el.simResults.textContent = `Simulating ${count.toLocaleString()} flips...`;

  setTimeout(() => {
    let simTotalProfit = 0;
    let simWins = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    
    let currentStreakVal = 0; // +ve for win streak, -ve for loss streak
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (let i = 0; i < count; i++) {
      const isWin = Math.random() < COIN_WIN_PROB;
      
      let profit = 0;
      if (isWin) {
        simWins++;
        profit = bet * (COIN_MULTIPLIER - 1);
        
        // Streak logic
        if (currentStreakVal > 0) currentStreakVal++;
        else currentStreakVal = 1;
        if (currentStreakVal > longestWinStreak) longestWinStreak = currentStreakVal;

      } else {
        profit = -bet;
        
        // Streak logic
        if (currentStreakVal < 0) currentStreakVal--;
        else currentStreakVal = -1;
        if (Math.abs(currentStreakVal) > longestLossStreak) longestLossStreak = Math.abs(currentStreakVal);
      }

      simTotalProfit += profit;
      
      // Drawdown logic (tracking lowest point relative to start)
      if (simTotalProfit < currentDrawdown) {
        currentDrawdown = simTotalProfit;
      }
      if (currentDrawdown < maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    const netProfitStr = simTotalProfit >= 0 ? `+${formatCoins(simTotalProfit)}` : `−${formatCoins(Math.abs(simTotalProfit))}`;
    const color = simTotalProfit >= 0 ? "#4ade80" : "#f97373";
    const winRate = (simWins / count) * 100;

    el.simResults.innerHTML = `
      <ul style="list-style:none; padding:0; margin:0;">
        <li><strong>Net Profit:</strong> <span style="color:${color}">${netProfitStr} coins</span></li>
        <li><strong>Max Drawdown:</strong> <span style="color:#f97373">−${formatCoins(Math.abs(maxDrawdown))} coins</span> (Worst point)</li>
        <li><strong>Longest Win Streak:</strong> ${longestWinStreak} wins</li>
        <li><strong>Longest Loss Streak:</strong> ${longestLossStreak} losses</li>
      </ul>
    `;

    state.simRunning = false;
  }, 50);
}

// ----- UI helpers -----
function syncBalanceUI() {
  state.balance = getBalance();
  if (el.balance) el.balance.textContent = formatCoins(state.balance);
  if (el.bet) el.bet.max = String(state.balance || 0);
}

function setMessage(text, type) {
  if (!el.message) return;
  el.message.textContent = text;
  el.message.classList.remove("coin-message--good", "coin-message--bad");
  if (type === "good") el.message.classList.add("coin-message--good");
  if (type === "bad") el.message.classList.add("coin-message--bad");
}

function flashBalance(isWin) {
  if (!el.balanceBox) return;
  el.balanceBox.classList.remove(
    "coin-balance-box--win",
    "coin-balance-box--loss"
  );
  void el.balanceBox.offsetWidth; // reflow
  el.balanceBox.classList.add(
    isWin ? "coin-balance-box--win" : "coin-balance-box--loss"
  );
  setTimeout(() => {
    el.balanceBox.classList.remove(
      "coin-balance-box--win",
      "coin-balance-box--loss"
    );
  }, 600);
}

function updateSideUI() {
  el.sideButtons.forEach((btn) => {
    btn.classList.toggle(
      "coin-side-btn--active",
      btn.dataset.side === state.selectedSide
    );
  });
}

function formatStreak() {
  if (!state.streakType || state.streakLength === 0) return "Streak: –";
  const label = state.streakType === "win" ? "win" : "loss";
  const plural = state.streakLength === 1 ? "" : "s";
  return `Streak: ${state.streakLength} ${label}${plural}`;
}

function updateStatsSummary() {
  const flips = state.flips;
  const winRate = flips === 0 ? 0 : (state.wins / flips) * 100;
  const text =
    `Flips: ${flips} • ` +
    `Win rate: ${winRate.toFixed(1)}% • ` +
    `Heads: ${state.heads} • Tails: ${state.tails} • ` +
    formatStreak();
  if (el.statsSummary) el.statsSummary.textContent = text;
}

function addHistoryEntry({ outcome, pick, bet, profit }) {
  if (!el.historyList) return;

  const li = document.createElement("li");
  li.className = "coin-history-item";
  if (profit > 0) li.classList.add("coin-history-item--win");
  if (profit < 0) li.classList.add("coin-history-item--loss");

  const prettyOutcome = outcome === "heads" ? "Heads" : "Tails";
  const prettyPick = pick === "heads" ? "Heads" : "Tails";

  li.innerHTML = `
    <span>Result: <strong>${prettyOutcome}</strong></span>
    <span>Pick: ${prettyPick}</span>
    <span>Bet: ${formatCoins(bet)}</span>
    <span>${profit >= 0 ? "+" : "−"}${formatCoins(Math.abs(profit))}</span>
  `;

  el.historyList.prepend(li);
}

function setAutoControlsRunning(running) {
  if (el.flipBtn) {
    el.flipBtn.disabled = running;
    el.flipBtn.textContent = running ? "Auto flipping…" : "Flip coin";
  }
  el.autoButtons.forEach((btn) => {
    btn.disabled = running;
  });
  if (el.autoStop) el.autoStop.disabled = !running;
}

function animateCoin(outcome) {
  if (!el.circle) return;
  const char = outcome === "heads" ? "H" : "T";
  el.circle.textContent = char;
  el.circle.classList.remove("coin-circle--animating");
  void el.circle.offsetWidth; // restart animation
  el.circle.classList.add("coin-circle--animating");
}

// ----- Dialog -----
function openDialog() {
  if (!el.dialog || state.balance <= 0) return;
  el.dialog.classList.add("coin-dialog-backdrop--open");
}

function closeDialog() {
  if (!el.dialog) return;
  el.dialog.classList.remove("coin-dialog-backdrop--open");
}

function handleDialogConfirm() {
  if (!el.bet) return;
  el.bet.value = String(state.balance);
  closeDialog();
}

function handleDialogCancel() {
  closeDialog();
}

// ----- Validation -----
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

// ----- Core flip logic -----
function updateStreak(outcomeType) {
  if (outcomeType === "win" || outcomeType === "loss") {
    if (state.streakType === outcomeType) {
      state.streakLength += 1;
    } else {
      state.streakType = outcomeType;
      state.streakLength = 1;
    }
  } else {
    state.streakType = null;
    state.streakLength = 0;
  }

  if (state.streakType === "win") {
    state.bestWinStreak = Math.max(
      state.bestWinStreak,
      state.streakLength
    );
  } else if (state.streakType === "loss") {
    state.bestLossStreak = Math.max(
      state.bestLossStreak,
      state.streakLength
    );
  }
}

async function runSingleFlip(bet) {
  const pick = state.selectedSide;

  // Determine outcome: fair 50/50
  const outcome = Math.random() < COIN_WIN_PROB ? "heads" : "tails";

  // Update basic counts
  state.flips += 1;
  if (outcome === "heads") state.heads += 1;
  else state.tails += 1;

  const win = outcome === pick;
  let profit = 0;

  if (win) {
    // profit is (multiplier - 1) * bet, we never subtract the bet itself
    profit = bet * (COIN_MULTIPLIER - 1);
  } else {
    profit = -bet;
  }

  state.balance = changeBalance(profit);
  if (state.balance < 0) {
    state.balance = setBalance(0);
  }
  syncBalanceUI();

  if (win) {
    flashBalance(true);
    setMessage(
      `Coin landed on ${outcome === "heads" ? "Heads" : "Tails"}. You won +${formatCoins(
        profit
      )}.`,
      "good"
    );
    state.wins += 1;
    updateStreak("win");
  } else {
    flashBalance(false);
    setMessage(
      `Coin landed on ${outcome === "heads" ? "Heads" : "Tails"}. You lost −${formatCoins(
        -profit
      )}.`,
      "bad"
    );
    state.losses += 1;
    updateStreak("loss");
  }

  addHistoryEntry({ outcome, pick, bet, profit });
  updateStatsSummary();
  animateCoin(outcome);

  await wait(430);
}

function handleManualFlip() {
  if (state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;
  runSingleFlip(bet);
}

// ----- Auto mode -----
async function handleAutoFlip(count) {
  if (state.autoRunning) return;
  const bet = validateBet();
  if (bet == null) return;
  if (state.balance < bet) {
    alert("Not enough balance to start auto flips.");
    return;
  }

  state.autoRunning = true;
  state.autoStopRequested = false;
  setAutoControlsRunning(true);
  setMessage(`Auto-flipping ${count} times…`, null);

  for (let i = 0; i < count; i += 1) {
    if (state.autoStopRequested) {
      setMessage(`Auto-flip stopped after ${i} flips.`, "bad");
      break;
    }
    if (state.balance < bet) {
      setMessage(
        `Auto-flip stopped after ${i} flips (balance too low).`,
        "bad"
      );
      break;
    }

    await runSingleFlip(bet);
    setMessage(`Auto-flip in progress… ${i + 1}/${count}`, null);
  }

  state.autoRunning = false;
  setAutoControlsRunning(false);
  setMessage("Auto-flip finished (streaks may still evolve).", null);
}

function handleAutoStop() {
  if (!state.autoRunning) return;
  state.autoStopRequested = true;
  setMessage("Auto-flip will stop after the current flip.", null);
}

// ----- Info panel -----
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

  // Set house edge numbers
  if (el.multiplier) {
    el.multiplier.textContent = `${COIN_MULTIPLIER.toFixed(2)}x`;
  }
  if (el.edge) {
    el.edge.textContent = `${(HOUSE_EDGE * 100).toFixed(1)}%`;
  }
  if (el.evText) {
    const evPct = EV_PER_BET * 100;
    el.evText.textContent =
      (evPct > 0 ? "+" : "") + evPct.toFixed(1) + "%";
  }

  setMessage("Pick a side, set your bet, then flip.", null);
  if (el.circle) el.circle.textContent = "H";
  updateSideUI();
  updateStatsSummary();
  setupProFeature(); // Init PRO buttons

  // Side buttons
  el.sideButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const side = btn.dataset.side;
      if (!side) return;
      state.selectedSide = side;
      updateSideUI();
    });
  });

  // Betting controls
  if (el.betMin) el.betMin.addEventListener("click", handleBetMin);
  if (el.allIn) el.allIn.addEventListener("click", handleAllIn);

  if (el.dialogConfirm) {
    el.dialogConfirm.addEventListener("click", handleDialogConfirm);
  }
  if (el.dialogCancel) {
    el.dialogCancel.addEventListener("click", handleDialogCancel);
  }

  // Flip buttons
  if (el.flipBtn) el.flipBtn.addEventListener("click", handleManualFlip);
  el.autoButtons.forEach((btn) => {
    const count = Number(btn.dataset.count);
    if (!Number.isFinite(count) || count <= 0) return;
    btn.addEventListener("click", () => handleAutoFlip(count));
  });
  if (el.autoStop) el.autoStop.addEventListener("click", handleAutoStop);

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