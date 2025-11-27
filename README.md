# Probability Games – Professional Edition (v2)

Modern, browser-based probability games (Dice, Mines, Plinko) with a focus on:
- intuitive risk/reward
- clean UX
- educational transparency of the underlying math.

This is a **rebuilt and professionalized version** of my original *Probability Games* project, which I created at age 18.

> 🔗 Original project (legacy version, built at 18):  
> [View the legacy repo](LEGACY_REPO_URL_HERE)

---

## 🎮 Games Included

### 🎲 Dice Game
Risk-based dice game where you choose a **risk percentage** and a **bet**, then roll a number from 1–100.

- Higher risk → higher potential multiplier.
- Uses a dynamic multiplier calculation to keep expected value intuitive.
- Balance, bets, and risk all update visibly in the UI.

*(Original logic inspired by my first version using a risk slider and balance system.)*

### 💣 Mines Game
Grid-based risk game similar to “mines” style games.

- Select number of mines and bet.
- Reveal safe cells to increase your **cash-out multiplier**.
- Cash out early or risk hitting a mine and losing the bet.
- Uses a non-linear multiplier curve that increases as you open more cells.

### 🧷 Plinko Game
Physics-based Plinko board built with a physics engine.

- Drop balls from the top; they bounce through pegs and land in pots at the bottom.
- Each pot can be associated with a different multiplier / reward (in this v2).
- Visually demonstrates probability distribution in a fun way.

---

## ✨ Goals of v2

The v2 repo exists to:

1. **Keep the original project as a historical artifact** (built at age 18).
2. **Refactor the codebase** into clean modules with shared logic.
3. **Upgrade the UX/UI** into something polished and production-ready.
4. Add **educational overlays** to explain the probability behind each game.
5. Prepare the project for:
   - hosting as a public web app,
   - future backend integration (accounts, leaderboards, monetization).

---

## 🚀 Live Demo

- **Live site:** [)

(If you’re viewing this before deployment, the link may not be live yet.)

---

## 🧱 Tech Stack

- **HTML / CSS / JavaScript**
- **No framework required** (works as a static site)
- Optional:
  - Physics: [Matter.js] (for Plinko)
  - Backend (future): Node.js / any API

---

## 📁 Project Structure

```text
probability-games-v2/
├─ public/
│  ├─ index.html              # Landing page + game selector
│  ├─ games/
│  │  ├─ dice.html
│  │  ├─ mines.html
│  │  └─ plinko.html
│  ├─ assets/
│  │  ├─ images/
│  │  └─ audio/
│  └─ favicon.ico
│
├─ src/
│  ├─ core/
│  │  ├─ engine.js           # Core game engine glue (routing, game loading)
│  │  ├─ balance.js          # Shared balance & currency logic
│  │  ├─ storage.js          # LocalStorage / API layer
│  │  └─ ui.js               # Shared UI helpers (modals, toasts, etc.)
│  │
│  ├─ games/
│  │  ├─ dice/
│  │  │  ├─ dice.js
│  │  │  └─ dice.css
│  │  ├─ mines/
│  │  │  ├─ mines.js
│  │  │  └─ mines.css
│  │  └─ plinko/
│  │     ├─ plinko.js
│  │     └─ plinko.css
│  │
│  └─ styles/
│     ├─ base.css
│     └─ theme.css
│
├─ docs/
│  ├─ DESIGN.md
│  ├─ PROBABILITIES.md
│  └─ ROADMAP.md
│
├─ .gitignore
├─ LICENSE
└─ README.md
