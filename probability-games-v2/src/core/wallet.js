// src/core/wallet.js
// Shared wallet for all games

const STORAGE_KEY = "pgv2_shared_balance_v1";
const DEFAULT_BALANCE = 1000;

export function getBalance() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_BALANCE;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_BALANCE;
  return parsed;
}

export function setBalance(value) {
  const safe = Math.max(0, Number(value) || 0);
  localStorage.setItem(STORAGE_KEY, String(safe));
  return safe;
}

export function changeBalance(delta) {
  const current = getBalance();
  return setBalance(current + delta);
}

export function resetBalance() {
  return setBalance(DEFAULT_BALANCE);
}

export function formatCoins(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
