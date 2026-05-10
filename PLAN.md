# PLAN.md — Implementation Plan

Status: **Not started** — scaffold is clean BGA template, nothing game-specific yet.

---

## Phase 1 — Database & initialization

- [ ] `dbmodel.sql` — create `bc_card` table (incl. `card_family` column) and `bc_token` table; add gem and rage columns to `player`
- [ ] `Game.php::setupNewGame()` — create 24 Bronze + 36 Silver + 18 Gold cards in shared piles
- [ ] `Game.php::setupNewGame()` — distribute 6 unique Bronze cards to each player (personal decks)
- [ ] `Game.php::setupNewGame()` — run Silver draft (each player draws 3, keeps 1, passes 2 left; repeat)
- [ ] `Game.php::setupNewGame()` — init gems (1 charged, 2 uncharged per player), round=1, turn=1
- [ ] `Game.php::setupNewGame()` — determine first player randomly, set `turn_order_start`
- [ ] `Game.php::getAllDatas()` — return hand cards (private), grid cards (public face info only), gems, round/turn, turn order

---

## Phase 2 — Deploy state (State 10)

- [ ] `States/Deploy.php` — MULTIPLE_ACTIVE_PLAYER, state id 10
- [ ] `actDeployCards(centerId, leftId, rightId)` — validate card ids are in hand, move to grid face-down
- [ ] `actMulligan(cardId)` — validate gem available, decrement charged gem, move card to bottom of deck, draw new card
- [ ] `getArgs()` — return private hand cards for current player
- [ ] JS Deploy state — display hand, allow card selection for 3 positions + mulligan button
- [ ] Notification `cardsDeployed` — show "player placed 3 cards" without revealing types

---

## Phase 3 — Reveal & Resolve (State 20)

- [ ] `States/RevealAndResolve.php` — GAME, state id 20, fully automatic
- [ ] Flip all cards in current row face up (`card_face_up = 1`)
- [ ] Send `cardsRevealed` notification with full card data for current row
- [ ] Resolve Influence phase: for each player, apply central card effect
- [ ] Resolve Combat phase: iterate combats starting at `turn_order_start`, anticlockwise
  - [ ] Calculate each card's total strength (base + tokens + effects)
  - [ ] Award points = difference in strength to winner
  - [ ] Send `combatResolved` notification per combat
- [ ] Send `scoreUpdated` notifications
- [ ] Transition to CheckTurn (30)

---

## Phase 4 — Card effects engine

Each card effect is a method in a `CardEffects` class or handled via a strategy pattern.

- [ ] Define card effect types (see RULES.md / card list)
- [ ] Implement Influence effects (central card)
- [ ] Implement Combat effects (border cards)
- [ ] Implement Brutes: rage mechanic (`player_rage` toggle)
- [ ] Implement Flambeurs: dice roll effects
- [ ] Implement Pirates: pirate_gold token grants Or rank

---

## Phase 5 — Upgrade state (State 40)

- [ ] `States/Upgrade.php` — MULTIPLE_ACTIVE_PLAYER, state id 40
- [ ] `getArgs()` — for each player: face-up center column cards + pre-drawn 3 upgrade options per card (private)
- [ ] `actConfirmUpgrades(array $choices)` — validate choices, apply productions and upgrades
  - Production: flip card face-down, increment charged gem
  - Upgrade: decrement charged gem, return card to its origin rank deck, place chosen card face-down in grid
- [ ] JS Upgrade state — display center column cards with Produce / Upgrade choices; upgrade card picker dialog

---

## Phase 6 — Round & game management

- [ ] `States/CheckTurn.php` — GAME, state id 30 — increment turn or trigger upgrade/end
- [ ] `States/NextRound.php` — GAME, state id 50 — clear tokens, collect all cards, shuffle decks, advance round, move turn order marker
- [ ] `States/EndScore.php` — GAME, state id 98 — write final scores, apply gem tiebreaker
- [ ] `getGameProgression()` — return `(round - 1) * 25 + (turn - 1) * 8` (approximate)

---

## Phase 7 — UI & animations

- [ ] CSS grid layout for 2/3/4 player configurations
- [ ] Card flip animation on reveal
- [ ] Combat highlight animation (losing card visual)
- [ ] Gem display in player panels (charged vs uncharged icons)
- [ ] Turn order marker positioning
- [ ] Round/turn counter display
- [ ] Shared deck size counters

---

## Phase 8 — Solo mode (bot)

- [ ] Bot deck setup (based on difficulty: 0–4 Silver cards replacing Bronze)
- [ ] Bot card reveal (static face-down grid revealed at start of each round)
- [ ] Bot strength from bottom-right printed value (not standard strength)
- [ ] Bot upgrade logic (end of manche: replace 2 Bronze/Silver with 1 higher-rank card)
- [ ] One-player game option in `gameoptions.json`

---

## Phase 9 — Polish & release prep

- [ ] PHP syntax checks pass (`make check`)
- [ ] All card effects implemented and tested
- [ ] Replay support (all state changes via notifications)
- [ ] Translations: `clienttranslate()` on all user-facing strings
- [ ] `stats.json` — define meaningful statistics
- [ ] Pre-release checklist (see BGA docs)
