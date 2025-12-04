// src/core/hub.js
// Hub: show global balance + overall stats

import { getBalance, resetBalance, formatCoins } from "./wallet.js";
import { getStats, resetStats } from "./stats.js";

const balanceEl = document.getElementById("hub-balance");
const balanceResetBtn = document.getElementById("hub-reset");

const statsBetEl = document.getElementById("hub-stats-bets");
const statsProfitEl = document.getElementById("hub-stats-profit");
const statsGamesEl = document.getElementById("hub-stats-games");
const statsWinrateEl = document.getElementById("hub-stats-winrate");
const statsTopGameEl = document.getElementById("hub-stats-topgame");
const statsResetBtn = document.getElementById("hub-stats-reset");

function formatSignedCoins(value) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}${formatCoins(abs)}`;
}

function syncBalance() {
  if (!balanceEl) return;
  balanceEl.textContent = formatCoins(getBalance());
}

function pickTopGame(stats) {
  const totals = [
    { key: "dice", label: "Dice", bet: stats.dice.totalBet },
    { key: "mines", label: "Mines", bet: stats.mines.totalBet },
    { key: "plinko", label: "Plinko", bet: stats.plinko.totalBet },
    {
      key: "blackjack",
      label: "Blackjack",
      bet: stats.blackjack ? stats.blackjack.totalBet : 0,
    },
  ];
  totals.sort((a, b) => b.bet - a.bet);
  return totals[0].bet > 0 ? totals[0].label : "–";
}

function syncStats() {
  const stats = getStats();
  if (statsBetEl) statsBetEl.textContent = formatCoins(stats.global.totalBets);
  if (statsProfitEl)
    statsProfitEl.textContent = formatSignedCoins(stats.global.totalProfit);
  if (statsGamesEl) statsGamesEl.textContent = stats.global.totalGames;

  let winRate = 0;
  if (stats.global.totalGames > 0) {
    winRate = (stats.global.totalWins / stats.global.totalGames) * 100;
  }
  if (statsWinrateEl) statsWinrateEl.textContent = `${winRate.toFixed(1)}%`;

  if (statsTopGameEl) statsTopGameEl.textContent = pickTopGame(stats);
}

if (balanceResetBtn) {
  balanceResetBtn.addEventListener("click", () => {
    const confirmed = confirm("Reset your balance back to 1,000 coins?");
    if (!confirmed) return;
    resetBalance();
    syncBalance();
  });
}

if (statsResetBtn) {
  statsResetBtn.addEventListener("click", () => {
    const confirmed = confirm(
      "Reset all stats on this device? This cannot be undone.",
    );
    if (!confirmed) return;
    resetStats();
    syncStats();
  });
}

syncBalance();
syncStats();
