// src/core/shop.js
// Manages the Item Catalog, Purchases, and Equipped Skins

import { getBalance, changeBalance, formatCoins } from "./wallet.js";
import { showToast } from "./toaster.js";

const SHOP_KEY = "pgv2_shop_v1";

// --- THE CATALOG ---
export const CATALOG = [
  {
    id: "bj_cyberpunk",
    game: "blackjack",
    name: "Cyberpunk Deck",
    price: 5000,
    desc: "Neon-infused holographic cards.",
    icon: "🃏"
  },
  {
    id: "dice_golden",
    game: "dice",
    name: "Golden Roller",
    price: 10000,
    desc: "Luxurious gold interface for the Dice game.",
    icon: "🎲"
  },
  {
    id: "coin_bitcoin",
    game: "coinflip",
    name: "Bitcoin Asset",
    price: 2500,
    desc: "Flip a BTC token instead of a generic coin.",
    icon: "🪙"
  },
  {
    id: "plinko_matrix",
    game: "plinko",
    name: "Matrix Balls",
    price: 15000,
    desc: "Digital green rain physics style.",
    icon: "🧷"
  }
];

// --- STATE MANAGEMENT ---
function loadData() {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (!raw) return { owned: [], equipped: {} };
    return JSON.parse(raw);
  } catch {
    return { owned: [], equipped: {} };
  }
}

function saveData(data) {
  localStorage.setItem(SHOP_KEY, JSON.stringify(data));
}

// --- PUBLIC API ---

export function getShopStatus(itemId) {
  const data = loadData();
  const isOwned = data.owned.includes(itemId);
  // Find which item is equipped for this game
  const item = CATALOG.find(i => i.id === itemId);
  const isEquipped = item && data.equipped[item.game] === itemId;
  
  return { isOwned, isEquipped };
}

export function buyItem(itemId) {
  const item = CATALOG.find(i => i.id === itemId);
  if (!item) return;

  const balance = getBalance();
  if (balance < item.price) {
    showToast("Insufficient Funds", "Play more games to earn coins!", "error");
    return false;
  }

  const data = loadData();
  if (data.owned.includes(itemId)) return true; // Already owned

  // Transaction
  changeBalance(-item.price);
  data.owned.push(itemId);
  
  // Auto-equip on buy
  data.equipped[item.game] = itemId;
  
  saveData(data);
  showToast("Item Purchased!", `You unlocked ${item.name}.`, "achievement");
  
  // Dispatch event so UI updates balance immediately
  window.dispatchEvent(new Event("storage")); 
  return true;
}

export function equipItem(itemId) {
  const item = CATALOG.find(i => i.id === itemId);
  if (!item) return;

  const data = loadData();
  if (!data.owned.includes(itemId)) return;

  // Toggle logic: if already equipped, unequip (revert to default)
  if (data.equipped[item.game] === itemId) {
    delete data.equipped[item.game];
    showToast("Unequipped", `Restored default look for ${item.game}.`);
  } else {
    data.equipped[item.game] = itemId;
    showToast("Equipped", `${item.name} is now active.`);
  }
  
  saveData(data);
}

// Used by Games to check what to render
export function getActiveSkin(gameId) {
  const data = loadData();
  return data.equipped[gameId] || null; // returns itemId or null (default)
}