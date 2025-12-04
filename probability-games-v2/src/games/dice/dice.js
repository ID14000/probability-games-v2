// Dice Game v2 – shared wallet + stats + info panel + custom risk curve

import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { recordDice } from "../../core/stats.js";
import { isProUser } from "../../core/settings.js";

// ----- State -----
const state = {
  balance: 0,
  lastRoll: null,
  totalRolls: 0,
  wins: 0,
  losses: 0,
  currentStreakType: null, // "win" | "loss"
  currentStreakLength: 0,
  bestWinStreak: 0,
  bestLossStreak: 0,
  simRunning: false,
};

// ----- DOM -----
const el = {
  balanceBox: document.getElementById("dice-balance-box"),
  balance: document.getElementById("dice-balance"),
  bet: document.getElementById("dice-bet"),
  betMin: document.getElementById("dice-bet-min"),
  allIn: document.getElementById("dice-all-in"),
  risk: document.getElementById("dice-risk"),
  riskValue: document.getElementById("dice-risk-value"),
  winProb: document.getElementById("dice-win-prob"),
  multiplier: document.getElementById("dice-multiplier"),
  ev: document.getElementById("dice-ev"),
  rollBtn: document.getElementById("dice-roll"),
  result: document.getElementById("dice-result"),
  display: document.getElementById("dice-display"),
  historyList: document.getElementById("dice-history-list"),
  historySummary: document.getElementById("dice-history-summary"),
  dialog: document.getElementById("dice-dialog"),
  dialogConfirm: document.getElementById("dice-confirm-all-in"),
  dialogCancel: document.getElementById("dice-cancel-all-in"),
  infoOpen: document.getElementById("dice-info-open"),
  infoClose: document.getElementById("dice-info-close"),
  infoPanel: document.getElementById("dice-info-panel"),
  // New PRO elements
  proPanel: document.getElementById("dice-pro-panel"),
  simButtons: document.querySelectorAll(".dice-sim-btn"),
  simStatus: document.getElementById("dice-sim-status"),
  simResults: document.getElementById("dice-sim-results"),
};

// ----- UI helpers -----
function syncBalanceUI() {
  state.balance = getBalance();
  el.balance.textContent = formatCoins(state.balance);
  el.bet.max = String(state.balance || 0);
}

function setResult(text, type) {
  el.result.textContent = text;
  el.result.classList.remove("dice-result--win", "dice-result--loss");
  if (type === "win") el.result.classList.add("dice-result--win");
  if (type === "loss") el.result.classList.add("dice-result--loss");
}

function flashBalance(isWin) {
  el.balanceBox.classList.remove(
    "dice-balance-box--win",
    "dice-balance-box--loss"
  );
  // force reflow to restart animation
  void el.balanceBox.offsetWidth;
  el.balanceBox.classList.add(
    isWin ? "dice-balance-box--win" : "dice-balance-box--loss"
  );
  setTimeout(() => {
    el.balanceBox.classList.remove(
      "dice-balance-box--win",
      "dice-balance-box--loss"
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

function updateHistorySummary() {
  const winRate =
    state.totalRolls === 0 ? 0 : (state.wins / state.totalRolls) * 100;
  const streak = formatStreakText();
  el.historySummary.textContent = `Rolls: ${state.totalRolls} • Win rate: ${winRate.toFixed(
    1
  )}% • ${streak}`;
}

// risk = % chance to lose
// We keep risk as literal "chance to lose", but multipliers include a house edge
// that grows slightly with risk. EV per 1 coin is simply -houseEdge.
function calculateMultiplier(risk) {
  const loseP = risk / 100;
  const winP = 1 - loseP;
  if (winP <= 0) return 0;

  // House edge from 2% (very safe) up to 12% (degenerate risk)
  const houseEdge = 0.02 + 0.10 * loseP; // between 0.02 and 0.12
  const fairMult = 1 / winP; // no edge
  const mult = fairMult * (1 - houseEdge);

  return mult;
}

function updateRiskUI() {
  const risk = Number(el.risk.value);
  if (!Number.isFinite(risk)) return;

  el.riskValue.textContent = `${risk}%`;

  const loseP = risk / 100;
  const winP = 1 - loseP;
  const mult = calculateMultiplier(risk);

  el.winProb.textContent = `${Math.round(winP * 100)}%`;
  el.multiplier.textContent = `${mult.toFixed(2)}x`;

  if (el.ev) {
    const ev = winP * mult - 1; // expected profit per 1 coin
    const evPct = ev * 100;
    const sign = evPct > 0 ? "+" : "−";
    el.ev.textContent = `${sign}${Math.abs(evPct).toFixed(1)}%`;
  }

  // position slider value bubble (original logic retained)
  const sliderRect = el.risk.getBoundingClientRect();
  const valueRect = el.riskValue.getBoundingClientRect();
  if (sliderRect.width === 0) return;

  const rel =
    (risk - Number(el.risk.min)) /
    (Number(el.risk.max) - Number(el.risk.min));
  const x =
    sliderRect.left +
    rel * sliderRect.width -
    valueRect.width / 2 -
    sliderRect.left;
  const clamped = Math.max(
    0,
    Math.min(sliderRect.width - valueRect.width, x)
  );

  el.riskValue.style.left = `${clamped}px`;
}

// ----- Dialog -----
function openDialog() {
  if (!el.dialog || state.balance <= 0) return;
  el.dialog.classList.add("dice-dialog-backdrop--open");
}

function closeDialog() {
  if (!el.dialog) return;
  el.dialog.classList.remove("dice-dialog-backdrop--open");
}

function handleDialogConfirm() {
  el.bet.value = String(state.balance);
  closeDialog();
}

function handleDialogCancel() {
  closeDialog();
}

// ----- History -----
function addHistoryEntry({ roll, bet, risk, profit }) {
  const li = document.createElement("li");
  li.className = "dice-history-item";
  if (profit > 0) li.classList.add("dice-history-item--win");
  if (profit < 0) li.classList.add("dice-history-item--loss");

  li.innerHTML = `
    <span>Roll: <strong>${roll}</strong></span>
    <span>Risk: ${risk}%</span>
    <span>Bet: ${formatCoins(bet)}</span>
    <span>${profit >= 0 ? "+" : "−"}${formatCoins(Math.abs(profit))}</span>
  `;

  // Limit visible history to 10 entries for performance/focus
  if (el.historyList.children.length >= 10) {
      el.historyList.removeChild(el.historyList.lastChild);
  }
  el.historyList.prepend(li);

  state.totalRolls += 1;
  if (profit > 0) state.wins += 1;
  if (profit < 0) state.losses += 1;

  // streak logic
  let outcome = "push"; // Technically always win/loss in dice, but for consistency
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

  updateHistorySummary();
}

// ----- Betting validation -----
function validateInputs() {
  const bet = Number(el.bet.value);
  const risk = Number(el.risk.value);

  if (!Number.isFinite(bet) || bet <= 0) {
    alert("Bet must be at least 1 coin.");
    return null;
  }
  if (bet > state.balance) {
    alert("You cannot bet more than your balance.");
    return null;
  }
  if (!Number.isFinite(risk) || risk < 1 || risk > 99) {
    alert("Risk must be between 1% and 99%.");
    return null;
  }

  return { bet, risk };
}

function handleBetMin() {
  el.bet.value = "1";
}

function handleAllIn() {
  if (state.balance <= 0) return;
  openDialog();
}

// ----- Roll animation -----
function animateRollDisplay(roll) {
  el.display.classList.add("dice-display--rolling");
  el.display.textContent = "·";
  setTimeout(() => {
    el.display.classList.remove("dice-display--rolling");
    el.display.textContent = String(roll);
  }, 260);
}

// ----- Main roll logic -----
function handleRoll() {
  if (state.simRunning) return; // Prevent manual roll during sim
  const validated = validateInputs();
  if (!validated) return;

  const { bet, risk } = validated;
  const roll = Math.floor(Math.random() * 100) + 1;
  state.lastRoll = roll;

  const mult = calculateMultiplier(risk);
  const winProfit = bet * (mult - 1);

  el.rollBtn.disabled = true;
  animateRollDisplay(roll);

  let profit;
  if (roll <= risk) {
    // lose
    state.balance = changeBalance(-bet);
    profit = -bet;
    setResult(`You lost −${formatCoins(bet)} coins`, "loss");
    flashBalance(false);
  } else {
    // win
    state.balance = changeBalance(winProfit);
    profit = winProfit;
    setResult(`You won +${formatCoins(winProfit)} coins`, "win");
    flashBalance(true);
  }

  syncBalanceUI();
  addHistoryEntry({ roll, bet, risk, profit });
  recordDice({ bet, profit });

  setTimeout(() => {
    el.rollBtn.disabled = false;
  }, 260);
}

// ----- MONTE CARLO SIMULATION LOGIC (PRO FEATURE) -----

function runMonteCarlo(count, bet, risk) {
    const loseP = risk / 100;
    const mult = calculateMultiplier(risk);

    let simWins = 0;
    let simLosses = 0;
    let simTotalProfit = 0;

    for (let i = 0; i < count; i++) {
        // We don't use Math.random() * 100 + 1 for speed, just a simple win/loss check
        const rollWin = Math.random() > loseP;

        if (rollWin) {
            simWins++;
            simTotalProfit += bet * (mult - 1);
        } else {
            simLosses++;
            simTotalProfit -= bet;
        }
    }

    const netProfitPerBet = simTotalProfit / count;
    const winRate = (simWins / count) * 100;
    const evDiff = netProfitPerBet * 100; // Expected value difference vs 0

    return { simWins, simLosses, simTotalProfit, netProfitPerBet, winRate, evDiff };
}

function handleMonteCarlo(count) {
    if (state.simRunning) return;

    const risk = Number(el.risk.value);
    const bet = Number(el.bet.value);

    // Disable controls and update state
    state.simRunning = true;
    el.rollBtn.disabled = true;
    el.simButtons.forEach(btn => btn.disabled = true);
    el.simStatus.textContent = `Running ${count.toLocaleString()} rolls... (may take a moment)`;

    // Run simulation in a timeout to prevent freezing the UI (even though it's fast)
    setTimeout(() => {
        const startTime = performance.now();
        const results = runMonteCarlo(count, bet, risk);
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        // Update UI
        el.simStatus.textContent = `Simulation complete in ${duration}ms.`;
        el.simStatus.classList.remove("dice-result--win", "dice-result--loss");

        const sign = results.simTotalProfit >= 0 ? "+" : "−";
        el.simResults.innerHTML = `
            <p class="dice-meta" style="margin-top:0.5rem; color:#d1d5db;">
                **Simulated Results (${count.toLocaleString()} Rolls)**
            </p>
            <ul style="list-style:none; padding:0; margin-top:0.5rem;">
                <li style="font-size:0.85rem; padding:0.15rem 0;">Win Rate: <strong style="color:#4ade80">${results.winRate.toFixed(3)}%</strong> (Expected: ${Math.round((1 - risk / 100) * 100)}%)</li>
                <li style="font-size:0.85rem; padding:0.15rem 0;">Net Profit: <strong style="color:${results.simTotalProfit >= 0 ? '#4ade80' : '#f97373'}">${sign}${formatCoins(Math.abs(results.simTotalProfit))} coins</strong></li>
                <li style="font-size:0.85rem; padding:0.15rem 0;">EV per Bet: <strong style="color:${results.netProfitPerBet >= 0 ? '#4ade80' : '#f97373'}">${results.evDiff >= 0 ? '+' : '−'}${Math.abs(results.evDiff).toFixed(3)}%</strong></li>
            </ul>
        `;

        // Re-enable controls
        state.simRunning = false;
        el.rollBtn.disabled = false;
        if (isProUser()) {
          el.simButtons.forEach(btn => btn.disabled = false);
        }
    }, 10); // Deferred execution
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

function setupProFeature() {
  if (isProUser()) {
    // Pro User: Enable buttons
    el.simButtons.forEach(btn => btn.disabled = false);
    el.proPanel.style.opacity = 1;
    el.simStatus.textContent = `Ready to simulate ${Number(el.risk.value)}% risk.`;

    el.simButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const count = Number(btn.dataset.count);
            handleMonteCarlo(count);
        });
    });
  } else {
    // Free User: Disable buttons and visually grey out the panel
    el.simButtons.forEach(btn => btn.disabled = true);
    if (el.proPanel) {
        el.proPanel.style.opacity = 0.5;
        el.proPanel.style.pointerEvents = 'none';
        el.simStatus.textContent = "Upgrade to Pro to unlock Monte Carlo simulation.";
    }
  }
}

// ----- Init -----
function init() {
  state.balance = getBalance();
  syncBalanceUI();
  updateHistorySummary();

  setResult("Set your bet and risk, then roll.", null);
  el.display.textContent = "–";

  // initial risk display
  updateRiskUI();
  setupProFeature();

  // controls
  el.risk.addEventListener("input", updateRiskUI);
  window.addEventListener("resize", updateRiskUI);

  el.betMin.addEventListener("click", handleBetMin);
  el.allIn.addEventListener("click", handleAllIn);

  if (el.dialog) {
    el.dialogConfirm.addEventListener("click", handleDialogConfirm);
    el.dialogCancel.addEventListener("click", handleDialogCancel);
  }

  el.rollBtn.addEventListener("click", handleRoll);

  if (el.infoOpen && el.infoClose && el.infoPanel) {
    el.infoOpen.addEventListener("click", openInfo);
    el.infoClose.addEventListener("click", closeInfo);
    el.infoPanel.addEventListener("click", (e) => {
      if (e.target === el.infoPanel) closeInfo();
    });
  }
}

init();