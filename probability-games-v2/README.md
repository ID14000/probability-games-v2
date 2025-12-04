# Probability Games v2

Interactive mini-casino built to **feel** probability instead of just reading about it.

- 🎲 **Dice Game** – choose a risk level and roll 1–100.
- 💣 **Mines Game** – open safe cells, avoid mines, decide when to cash out.
- 🧷 **Plinko Game** – drop balls through pegs and hit multipliers at the bottom.

This is a professional remake of my original *Probability Games* project that I first built at 18.

---

## Features

- **Shared wallet** across all games (localStorage-backed, resettable from the hub).
- **Math-driven outcomes**:
  - Dice: risk slider controls win probability and fair-ish multiplier.
  - Mines: more mines increase the growth rate of the cashout multiplier.
  - Plinko: binomial distribution for hit probabilities, multipliers weighted by risk.
- **Device-local stats**:
  - Total wagered, net profit, number of games, win rate.
  - Per-game tracking for Dice, Mines and Plinko.
- **Explain-the-math panels** on each game:
  - “How this game works” overlays that document mechanics and intuition.
- Fully client-side, zero backend, easy to host on GitHub Pages or Netlify.

---

## Tech stack

- **HTML + CSS + vanilla JavaScript**
- Modular structure with ES modules:
  - `src/core` – shared wallet, stats and hub logic.
  - `src/games` – per-game logic and styles.
- **Matter.js** for Plinko animation (physics visualisation only; outcomes are deterministic from the math).

---

## Project structure

```text
public/
  index.html        # hub (global balance + stats + game cards)
  404.html          # custom not-found page
  assets/
    icon.svg        # app icon / favicon
  games/
    dice.html       # Dice UI shell
    mines.html      # Mines UI shell
    plinko.html     # Plinko UI shell

src/
  core/
    wallet.js       # shared balance stored in localStorage
    stats.js        # device-local stats for all games
    hub.js          # hub page wiring
  games/
    dice/
      dice.js
      dice.css
    mines/
      mines.js
      mines.css
    plinko/
      plinko.js
      plinko.css
  styles/
    base.css        # global typography + reset
    theme.css       # layout, cards, info panels, hub styling
