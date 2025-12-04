// Mines Game v2 – shared wallet + stats + info panel + Pro Probability

import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { recordMines } from "../../core/stats.js";
import { isProUser } from "../../core/settings.js";

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// ----- State -----
const state = {
  balance: 0,
  bet: 10,
  mines: 3,
  board: [],
  safeCellsLeft: TOTAL_CELLS - 3,
  multiplier: 1,
  roundActive: false,
};

// ----- DOM -----
const el = {
  balanceBox: document.getElementById("mines-balance-box"),
  balance: document.getElementById("mines-balance"),
  bet: document.getElementById("mines-bet"),
  betMin: document.getElementById("mines-bet-min"),
  allIn: document.getElementById("mines-all-in"),
  minesSlider: document.getElementById("mines-count"),
  minesValue: document.getElementById("mines-count-value"),
  safeLeft: document.getElementById("mines-safe-left"),
  multiplier: document.getElementById("mines-multiplier"),
  startBtn: document.getElementById("mines-start"),
  cashoutBtn: document.getElementById("mines-cashout"),
  board: document.getElementById("mines-board"),
  message: document.getElementById("mines-message"),
  dialog: document.getElementById("mines-dialog"),
  dialogConfirm: document.getElementById("mines-confirm-all-in"),
  dialogCancel: document.getElementById("mines-cancel-all-in"),
  infoOpen: document.getElementById("mines-info-open"),
  infoClose: document.getElementById("mines-info-close"),
  infoPanel: document.getElementById("mines-info-panel"),
  
  // PRO UI
  proPanel: document.getElementById("mines-pro-panel"),
  probText: document.getElementById("mines-prob-text"),
};

// ----- PRO Feature: Probability Calc -----
function updateProbabilityUI() {
  if (!el.probText) return;

  if (!isProUser()) {
    el.proPanel.style.opacity = 0.6;
    el.probText.textContent = "Upgrade to Pro to see the exact odds of your next move.";
    return;
  }

  el.proPanel.style.opacity = 1;

  if (!state.roundActive) {
    el.probText.textContent = "Start a round to see probabilities.";
    return;
  }

  // Calculate stats
  const revealedCount = state.board.filter(c => c.revealed).length;
  const unknownCount = TOTAL_CELLS - revealedCount;
  
  if (unknownCount === 0) {
    el.probText.textContent = "Round complete.";
    return;
  }

  const mineChance = (state.mines / unknownCount) * 100;
  const safeChance = 100 - mineChance;

  el.probText.innerHTML = `
    Next Tile Odds:<br>
    <span style="color:#4ade80">Safe: ${safeChance.toFixed(1)}%</span> &nbsp;|&nbsp; 
    <span style="color:#f97373">Mine: ${mineChance.toFixed(1)}%</span>
  `;
}

// ----- UI helpers -----
function syncBalanceUI() {
  el.balance.textContent = formatCoins(state.balance);
  el.bet.max = String(state.balance || 0);
}

function setMessage(text, type) {
  el.message.textContent = text;
  el.message.classList.remove("mines-message--good", "mines-message--bad");
  if (type === "good") el.message.classList.add("mines-message--good");
  if (type === "bad") el.message.classList.add("mines-message--bad");
}

function flashBalance(isWin) {
  el.balanceBox.classList.remove(
    "mines-balance-box--win",
    "mines-balance-box--loss"
  );
  void el.balanceBox.offsetWidth;
  el.balanceBox.classList.add(
    isWin ? "mines-balance-box--win" : "mines-balance-box--loss"
  );
  setTimeout(() => {
    el.balanceBox.classList.remove(
      "mines-balance-box--win",
      "mines-balance-box--loss"
    );
  }, 500);
}

function updateMinesSliderUI() {
  const mines = Number(el.minesSlider.value);
  state.mines = mines;
  state.safeCellsLeft = TOTAL_CELLS - mines;
  el.minesValue.textContent = mines;
  el.safeLeft.textContent = state.safeCellsLeft;
  el.multiplier.textContent = `${state.multiplier.toFixed(2)}x`;
  updateProbabilityUI(); // Update odds when slider changes (preview)
}

function updateMultiplierOnSafeReveal() {
  const mines = state.mines;
  // Simple linear-ish multiplier growth for demo purposes
  // Real math would be: current_mult * (unknown / (unknown - mines))
  // But we stick to the existing simple game logic to not break balance.
  const base = 1 + mines / 25; 
  state.multiplier *= base;
  el.multiplier.textContent = `${state.multiplier.toFixed(2)}x`;
}

// ----- Dialog -----
function openDialog() {
  if (!el.dialog || state.balance <= 0) return;
  el.dialog.classList.add("mines-dialog-backdrop--open");
}

function closeDialog() {
  if (!el.dialog) return;
  el.dialog.classList.remove("mines-dialog-backdrop--open");
}

// ----- Board helpers -----
function createEmptyBoard() {
  state.board = [];
  el.board.innerHTML = "";

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cellEl = document.createElement("button");
    cellEl.type = "button";
    cellEl.className = "mines-cell";

    const inner = document.createElement("span");
    inner.className = "mines-cell-inner";
    cellEl.appendChild(inner);

    el.board.appendChild(cellEl);

    const cell = {
      index: i,
      isMine: false,
      revealed: false,
      el: cellEl,
      innerEl: inner,
    };

    cellEl.addEventListener("click", () => handleCellClick(cell));
    state.board.push(cell);
  }
}

function placeMines() {
  const indices = [...Array(TOTAL_CELLS).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < state.mines; i++) {
    state.board[indices[i]].isMine = true;
  }
}

function revealAllMines(hitCell) {
  state.board.forEach((cell) => {
    if (cell.isMine) {
      if (cell === hitCell) {
        cell.el.classList.add("mines-cell--revealed-mine");
      } else {
        cell.el.classList.add("mines-cell--mine-revealed-late");
      }
      cell.innerEl.textContent = "💣";
    }
  });
}

// ----- Betting -----
function validateBet() {
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

// ----- Event handlers -----
function handleBetMin() {
  el.bet.value = "1";
}

function handleAllIn() {
  if (state.balance <= 0) return;
  openDialog();
}

function handleDialogConfirm() {
  el.bet.value = String(state.balance);
  closeDialog();
}

function handleDialogCancel() {
  closeDialog();
}

function handleStartRound() {
  const bet = validateBet();
  if (bet == null) return;
  if (state.roundActive) return;

  state.bet = bet;
  state.balance = changeBalance(-bet);
  if (state.balance < 0) {
    state.balance = setBalance(0);
  }
  syncBalanceUI();
  flashBalance(false);

  state.roundActive = true;
  state.multiplier = 1;
  state.safeCellsLeft = TOTAL_CELLS - state.mines;
  el.safeLeft.textContent = state.safeCellsLeft;
  el.multiplier.textContent = `${state.multiplier.toFixed(2)}x`;

  createEmptyBoard();
  placeMines();
  updateProbabilityUI(); // Initial probability

  el.startBtn.disabled = true;
  el.cashoutBtn.disabled = false;
  // Disable slider during game
  el.minesSlider.disabled = true;

  setMessage("Round started. Open safe cells or cash out.", null);
}

function handleCellClick(cell) {
  if (!state.roundActive || cell.revealed) return;

  cell.revealed = true;

  if (cell.isMine) {
    // LOSS
    cell.el.classList.add("mines-cell--revealed-mine");
    cell.innerEl.textContent = "💣";
    revealAllMines(cell);

    state.roundActive = false;
    el.cashoutBtn.disabled = true;
    el.startBtn.disabled = false;
    el.minesSlider.disabled = false;

    setMessage("Boom! You hit a mine and lost your bet.", "bad");
    flashBalance(false);
    updateProbabilityUI();

    recordMines({ bet: state.bet, profit: -state.bet, outcome: "bust" });
    return;
  }

  // SAFE
  cell.el.classList.add("mines-cell--revealed-safe");
  cell.innerEl.textContent = "✅";

  state.safeCellsLeft -= 1;
  el.safeLeft.textContent = state.safeCellsLeft;

  updateMultiplierOnSafeReveal();
  updateProbabilityUI(); // Update odds for NEXT click

  if (state.safeCellsLeft === 0) {
    handleCashout(true);
  } else {
    setMessage("Nice! Keep going or cash out while you are ahead.", "good");
  }
}

function handleCashout(auto = false) {
  if (!state.roundActive) return;

  const amount = state.bet * state.multiplier;
  const profit = amount - state.bet;

  state.balance = changeBalance(amount);
  syncBalanceUI();
  flashBalance(true);

  revealAllMines(null);
  state.roundActive = false;
  el.cashoutBtn.disabled = true;
  el.startBtn.disabled = false;
  el.minesSlider.disabled = false;

  setMessage(
    auto
      ? "All safe cells opened! Auto-cashed out your winnings."
      : "You cashed out successfully.",
    "good"
  );
  
  updateProbabilityUI();

  recordMines({
    bet: state.bet,
    profit,
    outcome: "cashout",
  });
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
  updateMinesSliderUI();
  createEmptyBoard();
  updateProbabilityUI();
  
  setMessage(
    "Choose your bet and number of mines, then start the round.",
    null
  );

  el.minesSlider.addEventListener("input", updateMinesSliderUI);

  el.betMin.addEventListener("click", handleBetMin);
  el.allIn.addEventListener("click", handleAllIn);
  el.dialogConfirm.addEventListener("click", handleDialogConfirm);
  el.dialogCancel.addEventListener("click", handleDialogCancel);

  el.startBtn.addEventListener("click", handleStartRound);
  el.cashoutBtn.addEventListener("click", () => handleCashout(false));

  if (el.infoOpen && el.infoClose && el.infoPanel) {
    el.infoOpen.addEventListener("click", openInfo);
    el.infoClose.addEventListener("click", closeInfo);
    el.infoPanel.addEventListener("click", (e) => {
      if (e.target === el.infoPanel) closeInfo();
    });
  }
}

init();