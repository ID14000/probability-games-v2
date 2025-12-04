// Blackjack Game – shared wallet + stats + info panel + Skins

import {
  getBalance,
  setBalance,
  changeBalance,
  formatCoins,
} from "../../core/wallet.js";
import { recordBlackjack } from "../../core/stats.js";
import { isProUser } from "../../core/settings.js";
import { getActiveSkin } from "../../core/shop.js";

// Small helper for sequential animations
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- State -----
const state = {
  balance: 0,
  deck: [],
  playerHand: [],
  dealerHand: [],
  bet: 10,
  roundActive: false,
  dealerRevealed: false,
  dealerJustRevealed: false,
  totalHands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
};

// ----- DOM -----
const el = {
  balanceBox: document.getElementById("bj-balance-box"),
  balance: document.getElementById("bj-balance"),

  betInput: document.getElementById("bj-bet"),
  betMin: document.getElementById("bj-bet-min"),
  allIn: document.getElementById("bj-all-in"),

  dealBtn: document.getElementById("bj-deal"),
  hitBtn: document.getElementById("bj-hit"),
  standBtn: document.getElementById("bj-stand"),
  doubleBtn: document.getElementById("bj-double"),

  // Hint Badges
  hintHit: document.getElementById("hint-hit"),
  hintStand: document.getElementById("hint-stand"),
  hintDouble: document.getElementById("hint-double"),
  
  // Pro Panel
  proPanel: document.getElementById("bj-pro-panel"),
  strategyText: document.getElementById("bj-strategy-text"),

  status: document.getElementById("bj-status"),

  dealerCards: document.getElementById("bj-dealer-cards"),
  playerCards: document.getElementById("bj-player-cards"),
  dealerTotal: document.getElementById("bj-dealer-total"),
  playerTotal: document.getElementById("bj-player-total"),

  historyList: document.getElementById("bj-history-list"),
  historySummary: document.getElementById("bj-history-summary"),

  dialog: document.getElementById("bj-dialog"),
  dialogConfirm: document.getElementById("bj-confirm-all-in"),
  dialogCancel: document.getElementById("bj-cancel-all-in"),

  infoOpen: document.getElementById("bj-info-open"),
  infoClose: document.getElementById("bj-info-close"),
  infoPanel: document.getElementById("bj-info-panel"),

  dealerHandBox: document.querySelector(".bj-hand:not(.bj-hand--player)"),
  playerHandBox: document.querySelector(".bj-hand.bj-hand--player"),
};

// ----- Helpers: deck & values -----
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function ensureDeck() {
  if (state.deck.length < 15) {
    state.deck = buildDeck();
    shuffle(state.deck);
  }
}

function drawCard() {
  ensureDeck();
  return state.deck.pop();
}

function cardValue(rank) {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isSoft(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces += 1;
  }
  return aces > 0 && total <= 21; 
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

// ----- STRATEGY HELPER LOGIC (Basic Strategy) -----
function getBasicStrategyMove() {
  // Safeguard: Need cards to calculate
  if (!state.playerHand.length || !state.dealerHand.length) return "";

  const playerTotal = handValue(state.playerHand);
  const dealerUpCardVal = cardValue(state.dealerHand[0].rank); // Visible card
  const isSoftHand = isSoft(state.playerHand);
  const canDouble = state.playerHand.length === 2;

  // Simplified Basic Strategy
  // H = Hit, S = Stand, D = Double (otherwise Hit)

  if (isSoftHand) {
    if (playerTotal >= 19) return "S"; // Soft 19+ -> Stand
    if (playerTotal === 18) {
      // Soft 18: Double vs 3-6, Stand vs 2,7,8, Hit vs 9,10,A
      if (canDouble && [3,4,5,6].includes(dealerUpCardVal)) return "D";
      if ([2,7,8].includes(dealerUpCardVal)) return "S";
      return "H";
    }
    // Soft 17 or lower: Double vs small cards, else Hit
    if (canDouble && playerTotal >= 13 && playerTotal <= 17 && [3,4,5,6].includes(dealerUpCardVal)) return "D";
    return "H";
  }

  // Hard Hands
  if (playerTotal >= 17) return "S";
  if (playerTotal >= 13 && playerTotal <= 16) {
    // Stand vs 2-6, Hit vs 7-A
    if (dealerUpCardVal >= 2 && dealerUpCardVal <= 6) return "S";
    return "H";
  }
  if (playerTotal === 12) {
    // Stand vs 4-6, Hit otherwise
    if (dealerUpCardVal >= 4 && dealerUpCardVal <= 6) return "S";
    return "H";
  }
  if (playerTotal === 11) {
    return canDouble ? "D" : "H";
  }
  if (playerTotal === 10) {
    return canDouble && dealerUpCardVal < 10 ? "D" : "H";
  }
  if (playerTotal === 9) {
    return canDouble && (dealerUpCardVal >= 3 && dealerUpCardVal <= 6) ? "D" : "H";
  }
  
  return "H"; // 8 or less
}

function updateStrategyUI() {
  if (!el.hintHit) return; // Guard if DOM not ready

  // Clear hints
  el.hintHit.textContent = "";
  el.hintStand.textContent = "";
  el.hintDouble.textContent = "";
  
  if (!isProUser()) {
    if(el.proPanel) el.proPanel.style.opacity = 0.6;
    if(el.strategyText) el.strategyText.textContent = "Upgrade to Pro to see the mathematically optimal move.";
    return;
  }

  if(el.proPanel) el.proPanel.style.opacity = 1;

  if (!state.roundActive || state.dealerRevealed || state.playerHand.length < 2) {
    if(el.strategyText) el.strategyText.textContent = "Waiting for deal...";
    return;
  }

  const bestMove = getBasicStrategyMove();
  let suggestion = "";

  if (bestMove === "H") {
    suggestion = "Hit";
    el.hintHit.textContent = "👍";
  } else if (bestMove === "S") {
    suggestion = "Stand";
    el.hintStand.textContent = "👍";
  } else if (bestMove === "D") {
    suggestion = "Double";
    el.hintDouble.textContent = "👍";
  }

  if(el.strategyText) el.strategyText.innerHTML = `Optimal Move: <strong style="color:#4ade80">${suggestion}</strong> (Basic Strategy)`;
}

// ----- UI helpers -----
function syncBalanceUI() {
  if (el.balance) el.balance.textContent = formatCoins(state.balance);
  if (el.betInput) el.betInput.max = String(state.balance || 0);
}

function setStatus(text, type) {
  if (!el.status) return;
  el.status.textContent = text;
  el.status.classList.remove("bj-status--good", "bj-status--bad");
  if (type === "good") el.status.classList.add("bj-status--good");
  if (type === "bad") el.status.classList.add("bj-status--bad");
}

function flashBalance(isWin) {
  if (!el.balanceBox) return;
  el.balanceBox.classList.remove("bj-balance-box--win", "bj-balance-box--loss");
  void el.balanceBox.offsetWidth;
  el.balanceBox.classList.add(
    isWin ? "bj-balance-box--win" : "bj-balance-box--loss",
  );
  setTimeout(() => {
    el.balanceBox.classList.remove("bj-balance-box--win", "bj-balance-box--loss");
  }, 600);
}

function createCardElement(card, hidden, animate) {
  const div = document.createElement("div");
  div.className = "bj-card";
  
  // SKIN CHECK
  if (getActiveSkin("blackjack") === "bj_cyberpunk") {
    div.classList.add("bj-card--cyberpunk");
  }

  if (animate) div.classList.add("bj-card--enter");

  const isRed = card.suit === "♥" || card.suit === "♦";
  if (!hidden && isRed) {
    div.classList.add("bj-card--red");
  }

  if (hidden) {
    div.classList.add("bj-card--hidden");
    div.innerHTML = `<span class="bj-card-back">?</span>`;
    return div;
  }

  const rankEl = document.createElement("span");
  rankEl.className = "bj-card-rank";
  rankEl.textContent = card.rank;

  const suitEl = document.createElement("span");
  suitEl.className = "bj-card-suit";
  suitEl.textContent = card.suit;

  div.appendChild(rankEl);
  div.appendChild(suitEl);
  return div;
}

function renderHands() {
  if (!el.dealerCards || !el.playerCards) return;

  // Dealer
  el.dealerCards.innerHTML = "";
  state.dealerHand.forEach((card, index) => {
    const hidden = !state.dealerRevealed && index === 1;
    const isLast = index === state.dealerHand.length - 1;
    const shouldAnimate =
      (!hidden && state.dealerRevealed && isLast) || (!state.dealerRevealed && isLast);
    const cardEl = createCardElement(card, hidden, shouldAnimate);

    if (!hidden && state.dealerRevealed && state.dealerJustRevealed && index === 1) {
      cardEl.classList.add("bj-card--flip");
    }

    el.dealerCards.appendChild(cardEl);
  });

  if (state.dealerHand.length === 0) {
    el.dealerTotal.textContent = "Total: –";
  } else if (!state.dealerRevealed) {
    // Only show value of first card
    if (state.dealerHand.length > 0) {
       el.dealerTotal.textContent = `Total: ${cardValue(state.dealerHand[0].rank)} + ?`;
    } else {
       el.dealerTotal.textContent = "Total: ?";
    }
  } else {
    el.dealerTotal.textContent = `Total: ${handValue(state.dealerHand)}`;
  }

  // Player
  el.playerCards.innerHTML = "";
  state.playerHand.forEach((card, index) => {
    const isLast = index === state.playerHand.length - 1;
    const cardEl = createCardElement(card, false, isLast);
    el.playerCards.appendChild(cardEl);
  });

  if (state.playerHand.length === 0) {
    el.playerTotal.textContent = "Total: –";
  } else {
    el.playerTotal.textContent = `Total: ${handValue(state.playerHand)}`;
  }

  if (state.dealerJustRevealed) {
    state.dealerJustRevealed = false;
  }
}

function updateButtons() {
  const canAct = state.roundActive;

  if (el.hitBtn) el.hitBtn.disabled = !canAct;
  if (el.standBtn) el.standBtn.disabled = !canAct;

  const canDouble =
    state.roundActive &&
    state.playerHand.length === 2 &&
    state.bet * 2 <= state.balance &&
    !state.dealerRevealed;
  if (el.doubleBtn) el.doubleBtn.disabled = !canDouble;

  if (el.dealBtn) el.dealBtn.disabled = state.roundActive;
  
  updateStrategyUI();
}

// ----- History -----
function addHistoryEntry({ outcome, bet, profit }) {
  if (!el.historyList || !el.historySummary) return;

  const li = document.createElement("li");
  li.className = "bj-history-item";
  if (profit > 0) li.classList.add("bj-history-item--win");
  if (profit < 0) li.classList.add("bj-history-item--loss");

  let label;
  if (outcome === "blackjack") label = "Blackjack";
  else if (outcome === "win") label = "Win";
  else if (outcome === "loss") label = "Loss";
  else label = "Push";

  const playerTotal = handValue(state.playerHand);
  const dealerTotal = handValue(state.dealerHand);

  li.innerHTML = `
    <span>${label}</span>
    <span>Bet: ${formatCoins(bet)}</span>
    <span>${playerTotal} vs ${dealerTotal}</span>
    <span>${profit >= 0 ? "+" : "−"}${formatCoins(Math.abs(profit))}</span>
  `;

  el.historyList.prepend(li);

  const winRate =
    state.totalHands === 0 ? 0 : (state.wins / state.totalHands) * 100;
  el.historySummary.textContent = `Hands: ${state.totalHands} • Win rate: ${winRate.toFixed(
    1,
  )}%`;
}

// ----- Dialog -----
function openDialog() {
  if (!el.dialog || state.balance <= 0) return;
  el.dialog.classList.add("bj-dialog-backdrop--open");
}

function closeDialog() {
  if (!el.dialog) return;
  el.dialog.classList.remove("bj-dialog-backdrop--open");
}

// ----- Betting -----
function validateBet() {
  const raw = el.betInput ? Number(el.betInput.value) : NaN;
  const bet = Number(raw);

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

// ----- Dealer reveal -----
async function revealDealer() {
  if (state.dealerRevealed) return;
  state.dealerRevealed = true;
  state.dealerJustRevealed = true;
  renderHands();
  await wait(420);
}

// ----- Round flow -----
async function startRound() {
  if (state.roundActive) return;

  const bet = validateBet();
  if (bet == null) return;

  state.bet = bet;
  state.playerHand = [];
  state.dealerHand = [];
  state.dealerRevealed = false;
  state.dealerJustRevealed = false;
  state.roundActive = true;

  ensureDeck();

  // Deduct bet immediately
  state.balance = changeBalance(-state.bet);
  if (state.balance < 0) state.balance = setBalance(0);
  syncBalanceUI();

  // Deal initial cards: Player, Dealer, Player, Dealer (Hidden)
  state.playerHand.push(drawCard());
  renderHands();
  await wait(300);

  state.dealerHand.push(drawCard());
  renderHands();
  await wait(300);

  state.playerHand.push(drawCard());
  renderHands();
  await wait(300);

  state.dealerHand.push(drawCard());
  renderHands();
  
  // Check for Blackjacks immediately
  const playerBJ = isBlackjack(state.playerHand);
  const dealerBJ = isBlackjack(state.dealerHand);

  if (playerBJ || dealerBJ) {
    await wait(500);
    await revealDealer();

    if (playerBJ && !dealerBJ) {
      finishRound("blackjack");
    } else if (playerBJ && dealerBJ) {
      finishRound("push");
    } else if (!playerBJ && dealerBJ) {
      finishRound("loss");
    }
    return;
  }

  updateButtons();
  setStatus("Your move: Hit, Stand or Double.", null);
}

async function playerHit() {
  if (!state.roundActive) return;

  state.playerHand.push(drawCard());
  renderHands();
  
  const total = handValue(state.playerHand);
  if (total > 21) {
    // Bust
    await wait(400);
    await revealDealer();
    finishRound("loss", { playerBust: true });
    return;
  }
  
  updateButtons();
  setStatus("You drew a card. Hit again or Stand.", null);
}

async function playerStand() {
  if (!state.roundActive) return;
  // Disable buttons while dealer plays
  el.hitBtn.disabled = true;
  el.standBtn.disabled = true;
  el.doubleBtn.disabled = true;

  await revealDealer();
  await playDealer();
}

async function playerDouble() {
  if (!state.roundActive) return;
  if (state.playerHand.length !== 2) return;

  const extraBet = state.bet;
  if (extraBet > state.balance) {
    alert("You don't have enough balance to double this hand.");
    return;
  }
  
  // Deduct extra bet
  state.balance = changeBalance(-extraBet);
  state.bet += extraBet;
  syncBalanceUI();

  state.playerHand.push(drawCard());
  renderHands();
  
  const total = handValue(state.playerHand);
  if (total > 21) {
    await wait(400);
    await revealDealer();
    finishRound("loss", { playerBust: true });
    return;
  }

  await wait(400);
  await revealDealer();
  await playDealer();
}

async function playDealer() {
  // Dealer hits until 17+ (including soft 17)
  let dealerTotal = handValue(state.dealerHand);
  await wait(400);

  while (dealerTotal < 17) {
    state.dealerHand.push(drawCard());
    renderHands();
    await wait(500);
    dealerTotal = handValue(state.dealerHand);
  }

  // Final comparison
  const playerTotal = handValue(state.playerHand);
  const dealerFinal = handValue(state.dealerHand);

  if (dealerFinal > 21) {
    finishRound("win", { dealerBust: true });
  } else if (dealerFinal > playerTotal) {
    finishRound("loss");
  } else if (dealerFinal < playerTotal) {
    finishRound("win");
  } else {
    finishRound("push");
  }
}

function applyHandEffects(outcome, opts) {
  if (!el.playerHandBox || !el.dealerHandBox) return;

  const { playerBust = false, dealerBust = false } = opts;

  el.playerHandBox.classList.remove(
    "bj-hand--flash-win",
    "bj-hand--flash-loss",
    "bj-hand--flash-bust",
  );
  el.dealerHandBox.classList.remove(
    "bj-hand--flash-win",
    "bj-hand--flash-loss",
    "bj-hand--flash-bust",
  );

  if (playerBust) {
    el.playerHandBox.classList.add("bj-hand--flash-bust");
  } else if (outcome === "win" || outcome === "blackjack") {
    el.playerHandBox.classList.add("bj-hand--flash-win");
    if (dealerBust) {
      el.dealerHandBox.classList.add("bj-hand--flash-bust");
    }
  } else if (outcome === "loss") {
    el.playerHandBox.classList.add("bj-hand--flash-loss");
  } else if (outcome === "push") {
    // optional: a tiny neutral highlight – for now we leave it subtle
  }

  setTimeout(() => {
    el.playerHandBox.classList.remove(
      "bj-hand--flash-win",
      "bj-hand--flash-loss",
      "bj-hand--flash-bust",
    );
    el.dealerHandBox.classList.remove(
      "bj-hand--flash-win",
      "bj-hand--flash-loss",
      "bj-hand--flash-bust",
    );
  }, 800);
}

function finishRound(outcome, opts = {}) {
  if (!state.roundActive) return;
  state.roundActive = false;

  const bet = state.bet;
  let payout = 0; // Amount returned to player
  let profit = 0;
  let statusType = null;
  let statusText = "";

  const playerTotal = handValue(state.playerHand);
  const dealerTotal = handValue(state.dealerHand);
  const playerBJ = isBlackjack(state.playerHand);

  if (outcome === "loss") {
    profit = -bet; // Bet already deducted
    payout = 0;
    statusType = "bad";
    statusText = `You lost −${formatCoins(bet)} coins (${playerTotal} vs ${dealerTotal}).`;
    state.losses += 1;
    flashBalance(false);
  } else if (outcome === "win" || outcome === "blackjack") {
    const mult = outcome === "blackjack" ? 1.5 : 1;
    profit = bet * mult;
    payout = bet + profit; // Return original bet + profit
    statusType = "good";
    if (outcome === "blackjack") {
      statusText = `Blackjack! You won +${formatCoins(profit)} coins.`;
    } else {
      statusText = `You won +${formatCoins(
        profit,
      )} coins (${playerTotal} vs ${dealerTotal}).`;
    }
    state.wins += 1;
    flashBalance(true);
  } else if (outcome === "push") {
    profit = 0;
    payout = bet; // Return original bet
    statusText = `Push – bet returned (${playerTotal} vs ${dealerTotal}).`;
    state.pushes += 1;
  }

  // Add payout to balance
  if (payout > 0) {
      state.balance = changeBalance(payout);
  } else {
      // Just sync in case (loss)
      syncBalanceUI();
  }

  state.totalHands += 1;

  syncBalanceUI();
  setStatus(statusText, statusType);
  updateButtons();
  addHistoryEntry({ outcome, bet, profit });
  applyHandEffects(outcome, opts);

  recordBlackjack({
    bet,
    profit,
    outcome: outcome === "blackjack" ? "win" : outcome,
    isBlackjack: playerBJ,
  });
}

// ----- Event handlers -----
function handleBetMin() {
  if (!el.betInput) return;
  el.betInput.value = "1";
}

function handleAllIn() {
  if (state.balance <= 0) return;
  openDialog();
}

function handleDialogConfirm() {
  if (!el.betInput) return;
  el.betInput.value = String(state.balance);
  closeDialog();
}

function handleDialogCancel() {
  closeDialog();
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
  setStatus("Set your bet, then deal a new hand.", null);
  renderHands();
  updateButtons();

  // Betting controls
  el.betMin.addEventListener("click", handleBetMin);
  el.allIn.addEventListener("click", handleAllIn);

  if (el.dialog) {
    el.dialogConfirm.addEventListener("click", handleDialogConfirm);
    el.dialogCancel.addEventListener("click", handleDialogCancel);
  }

  // Main actions
  el.dealBtn.addEventListener("click", () => {
    startRound();
  });
  el.hitBtn.addEventListener("click", () => {
    playerHit();
  });
  el.standBtn.addEventListener("click", () => {
    playerStand();
  });
  el.doubleBtn.addEventListener("click", () => {
    playerDouble();
  });

  // Info panel
  el.infoOpen.addEventListener("click", openInfo);
  el.infoClose.addEventListener("click", closeInfo);
}

init();