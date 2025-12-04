// src/core/stats.js
// Shared stats tracking for all games

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
    merged.global = { ...defaultStats.global, ...(parsed.global || {}) };
    merged.dice = { ...defaultStats.dice, ...(parsed.dice || {}) };
    merged.mines = { ...defaultStats.mines, ...(parsed.mines || {}) };
    merged.plinko = { ...defaultStats.plinko, ...(parsed.plinko || {}) };
    merged.blackjack = {
      ...defaultStats.blackjack,
      ...(parsed.blackjack || {}),
    };
    return merged;
  } catch {
    return cloneDefaults();
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function getStats() {
  return loadStats();
}

export function resetStats() {
  const fresh = cloneDefaults();
  saveStats(fresh);
  return fresh;
}

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
  // outcome: "win" | "loss" | "push"
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
