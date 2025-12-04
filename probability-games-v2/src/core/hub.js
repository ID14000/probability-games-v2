// src/core/hub.js
// Hub: show global balance + overall stats + Leveling + Achievements

import { getBalance, resetBalance, formatCoins } from "./wallet.js";
import { getStats, resetStats, calculateLevel } from "./stats.js";
import { getAchievementsStatus } from "./achievements.js";

const balanceEl = document.getElementById("hub-balance");
const balanceResetBtn = document.getElementById("hub-reset");

const statsBetEl = document.getElementById("hub-stats-bets");
const statsProfitEl = document.getElementById("hub-stats-profit");
const statsGamesEl = document.getElementById("hub-stats-games");
const statsWinrateEl = document.getElementById("hub-stats-winrate");
const statsTopGameEl = document.getElementById("hub-stats-topgame");
const statsResetBtn = document.getElementById("hub-stats-reset");

// Leveling Elements
const levelBadge = document.getElementById("hub-level-badge");
const levelTitle = document.getElementById("hub-level-title");
const levelProgressFill = document.getElementById("hub-level-fill");
const levelProgressText = document.getElementById("hub-level-text");

// Achievement Elements
const achToggle = document.getElementById("pg-achievements-toggle");
const achBackdrop = document.getElementById("pg-achievements-backdrop");
const achClose = document.getElementById("pg-achievements-close");
const achList = document.getElementById("pg-achievements-list");

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
    {
      key: "crash",
      label: "Crash",
      bet: stats.crash ? stats.crash.totalBet : 0,
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

  // --- Update Level UI ---
  const levelData = calculateLevel(stats.global.totalBets);
  
  if (levelBadge) levelBadge.textContent = `Lvl ${levelData.level}`;
  if (levelTitle) levelTitle.textContent = levelData.title;
  
  if (levelData.next) {
    const pct = Math.min(100, (stats.global.totalBets / levelData.next) * 100);
    if (levelProgressFill) levelProgressFill.style.width = `${pct}%`;
    if (levelProgressText) levelProgressText.textContent = `${formatCoins(stats.global.totalBets)} / ${formatCoins(levelData.next)} XP`;
  } else {
    if (levelProgressFill) levelProgressFill.style.width = `100%`;
    if (levelProgressText) levelProgressText.textContent = "Max Level Reached";
  }
}

// --- Achievements Modal Logic ---
function renderAchievements() {
  if (!achList) return;
  const list = getAchievementsStatus();
  achList.innerHTML = list.map(ach => `
    <div class="pg-achievement-card ${ach.isUnlocked ? 'pg-achievement-card--unlocked' : ''}">
      <div class="pg-achievement-icon">${ach.isUnlocked ? '🏆' : '🔒'}</div>
      <div class="pg-achievement-info">
        <h4>${ach.title}</h4>
        <p>${ach.desc}</p>
      </div>
    </div>
  `).join("");
}

if (achToggle && achBackdrop) {
  achToggle.addEventListener("click", () => {
    renderAchievements();
    achBackdrop.classList.add("pg-settings-backdrop--open"); // Reuse class for simplicity
  });
  
  achClose.addEventListener("click", () => {
    achBackdrop.classList.remove("pg-settings-backdrop--open");
  });
  
  achBackdrop.addEventListener("click", (e) => {
    if (e.target === achBackdrop) achBackdrop.classList.remove("pg-settings-backdrop--open");
  });
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