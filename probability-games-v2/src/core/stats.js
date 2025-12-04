// src/core/stats.js
// Shared stats tracking + Leveling + Auto Achievement Check

import { checkAchievements } from "./achievements.js";

const STATS_KEY = "pgv2_stats_v1";

const defaultStats = {
  global: {
    totalBets: 0,
    totalProfit: 0,
    totalGames: 0,
    totalWins: 0,
  },
  dice: {
    rolls: 0,
    totalBet: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
  },
  mines: {
    rounds: 0,
    totalBet: 0,
    totalProfit: 0,
    cashouts: 0,
    busts: 0,
  },
  plinko: {
    drops: 0,
    totalBet: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
  },
  blackjack: {
    hands: 0,
    totalBet: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
  },
  crash: {
    rounds: 0,
    totalBet: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
    maxMultiplier: 0
  },
  market: {
    trades: 0,
    totalVolume: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0
  }
};

function cloneDefaults() {
  if (typeof structuredClone === "function") {
    return structuredClone(defaultStats);
  }
  return JSON.parse(JSON.stringify(defaultStats));
}

function loadStats() {
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) return cloneDefaults();
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...defaultStats, ...parsed };
    // Merge nested objects
    merged.global = { ...defaultStats.global, ...(parsed.global || {}) };
    merged.dice = { ...defaultStats.dice, ...(parsed.dice || {}) };
    merged.mines = { ...defaultStats.mines, ...(parsed.mines || {}) };
    merged.plinko = { ...defaultStats.plinko, ...(parsed.plinko || {}) };
    merged.blackjack = { ...defaultStats.blackjack, ...(parsed.blackjack || {}) };
    merged.crash = { ...defaultStats.crash, ...(parsed.crash || {}) };
    merged.market = { ...defaultStats.market, ...(parsed.market || {}) };
    return merged;
  } catch {
    return cloneDefaults();
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  checkAchievements(stats);
}

export function getStats() {
  return loadStats();
}

export function resetStats() {
  const fresh = cloneDefaults();
  saveStats(fresh);
  return fresh;
}

export function calculateLevel(totalWagered) {
  if (totalWagered < 1000) return { level: 1, title: "Rookie", next: 1000 };
  if (totalWagered < 5000) return { level: 2, title: "Grinder", next: 5000 };
  if (totalWagered < 20000) return { level: 3, title: "Strategist", next: 20000 };
  if (totalWagered < 100000) return { level: 4, title: "Pro", next: 100000 };
  if (totalWagered < 1000000) return { level: 5, title: "High Roller", next: 1000000 };
  return { level: 6, title: "Whale", next: null };
}

// --- RECORDING FUNCTIONS ---

export function recordDice({ bet, profit }) {
  const stats = loadStats();
  stats.global.totalBets += bet;
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  stats.dice.rolls += 1;
  stats.dice.totalBet += bet;
  stats.dice.totalProfit += profit;
  if (profit > 0) stats.dice.wins += 1;
  if (profit < 0) stats.dice.losses += 1;
  saveStats(stats);
}

export function recordMines({ bet, profit, outcome }) {
  const stats = loadStats();
  stats.global.totalBets += bet;
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  stats.mines.rounds += 1;
  stats.mines.totalBet += bet;
  stats.mines.totalProfit += profit;
  if (outcome === "cashout") stats.mines.cashouts += 1;
  if (outcome === "bust") stats.mines.busts += 1;
  saveStats(stats);
}

export function recordPlinko({ bet, profit }) {
  const stats = loadStats();
  stats.global.totalBets += bet;
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  stats.plinko.drops += 1;
  stats.plinko.totalBet += bet;
  stats.plinko.totalProfit += profit;
  if (profit > 0) stats.plinko.wins += 1;
  if (profit < 0) stats.plinko.losses += 1;
  saveStats(stats);
}

export function recordBlackjack({ bet, profit, outcome, isBlackjack }) {
  const stats = loadStats();
  stats.global.totalBets += bet;
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  stats.blackjack.hands += 1;
  stats.blackjack.totalBet += bet;
  stats.blackjack.totalProfit += profit;
  if (outcome === "win") stats.blackjack.wins += 1;
  if (outcome === "loss") stats.blackjack.losses += 1;
  if (outcome === "push") stats.blackjack.pushes += 1;
  if (isBlackjack) stats.blackjack.blackjacks += 1;
  saveStats(stats);
}

export function recordCrash({ bet, profit, outcome, multiplier }) {
  const stats = loadStats();
  stats.global.totalBets += bet;
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  stats.crash.rounds += 1;
  stats.crash.totalBet += bet;
  stats.crash.totalProfit += profit;
  if (outcome === "win") stats.crash.wins += 1;
  if (outcome === "loss") stats.crash.losses += 1;
  if (multiplier > stats.crash.maxMultiplier) stats.crash.maxMultiplier = multiplier;
  saveStats(stats);
}

export function recordMarket({ bet, profit, outcome }) {
  const stats = loadStats();
  stats.global.totalBets += bet; // "Volume"
  stats.global.totalProfit += profit;
  stats.global.totalGames += 1;
  if (profit > 0) stats.global.totalWins += 1;
  
  stats.market.trades += 1;
  stats.market.totalVolume += bet;
  stats.market.totalProfit += profit;
  if (outcome === "win") stats.market.wins += 1;
  if (outcome === "loss") stats.market.losses += 1;
  
  saveStats(stats);
}