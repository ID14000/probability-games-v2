// src/core/achievements.js
// Defines achievements and checks criteria based on stats

import { showToast } from "./toaster.js";

const STORAGE_KEY = "pgv2_achievements_v1";

// --- DEFINITIONS ---
export const ACHIEVEMENTS = [
  {
    id: "first_blood",
    title: "First Blood",
    desc: "Play your first game.",
    check: (stats) => stats.global.totalGames >= 1
  },
  {
    id: "high_roller",
    title: "High Roller",
    desc: "Wager a total of 10,000 coins.",
    check: (stats) => stats.global.totalBets >= 10000
  },
  {
    id: "hot_streak",
    title: "Hot Streak",
    desc: "Win 50 games total.",
    check: (stats) => stats.global.totalWins >= 50
  },
  {
    id: "sniper",
    title: "Sniper",
    desc: "Hit a multiplier of 10x or higher in Plinko or Crash.",
    // Note: Requires stats.crash to exist (which we added)
    check: (stats) => {
      // Check Crash max mult
      if (stats.crash && stats.crash.maxMultiplier >= 10) return true;
      // We don't explicitly track max plinko mult in basic stats yet, 
      // so we rely on Crash for this specific badge in this version.
      return false;
    }
  },
  {
    id: "diamond_hands",
    title: "Diamond Hands",
    desc: "Survive 10 rounds of Crash.",
    check: (stats) => stats.crash && stats.crash.wins >= 10
  },
  {
    id: "mine_sweeper",
    title: "Mine Sweeper",
    desc: "Cash out 10 times in Mines.",
    check: (stats) => stats.mines.cashouts >= 10
  },
  {
    id: "coin_master",
    title: "Coin Master",
    desc: "Flip the coin 100 times.",
    check: (stats) => stats.dice.rolls >= 100 || stats.global.totalGames >= 100 // fallback
  }
];

// --- STATE MANAGEMENT ---
function loadUnlocked() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUnlocked(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getAchievementsStatus() {
  const unlocked = loadUnlocked();
  return ACHIEVEMENTS.map(ach => ({
    ...ach,
    isUnlocked: unlocked.includes(ach.id)
  }));
}

// --- MAIN CHECKER ---
// Called by stats.js whenever stats change
export function checkAchievements(stats) {
  const unlockedIds = loadUnlocked();
  let newUnlock = false;

  ACHIEVEMENTS.forEach(ach => {
    if (!unlockedIds.includes(ach.id)) {
      if (ach.check(stats)) {
        // Unlock!
        unlockedIds.push(ach.id);
        showToast("Achievement Unlocked!", ach.title, "achievement");
        newUnlock = true;
      }
    }
  });

  if (newUnlock) {
    saveUnlocked(unlockedIds);
  }
}