# PLAN.md — Implementation Plan

Status: **Not started** — scaffold is clean BGA template, nothing game-specific yet.

---

## Phase 1 — Database & initialization

- [x] `dbmodel.sql` — create `bc_card` table (incl. `card_family` column) and `bc_token` table; add gem and rage columns to `player`
- [x] `Game.php::setupNewGame()` — create 24 Bronze + 36 Silver + 18 Gold cards in shared piles
- [x] `Game.php::setupNewGame()` — distribute 6 unique Bronze cards to each player (personal decks)
- [x] `Game.php::setupNewGame()` — run Silver draft (simplified: 3 random Silver per player — draft UI deferred to later phase)
- [x] `Game.php::setupNewGame()` — init gems (1 charged, 2 uncharged per player), round=1, turn=1
- [x] `Game.php::setupNewGame()` — determine first player randomly, set `turn_order_start`
- [x] `Game.php::getAllDatas()` — return hand cards (private), grid cards (public face info only), gems, round/turn, turn order

---

## Phase 2 — Deploy state (State 10)

- [x] `States/Deploy.php` — MULTIPLE_ACTIVE_PLAYER, state id 10
- [x] `actDeployCards(col1CardId, col2CardId, col3CardId)` — validate card ids are in hand, move to grid face-down
- [x] `actMulligan(cardId)` — validate gem available, decrement charged gem, move card to bottom of deck, draw new card
- [x] `getArgs()` — draw 3 cards to hand on state enter, return private hand + gems_charged
- [x] JS Deploy state — display hand, card selection for 3 positions + mulligan mode
- [x] Notification `cardsDeployed` — player deployed 3 cards (no card types); `gemUpdated` + `mulliganCard` for mulligan
- [x] `States/RevealAndResolve.php` — minimal stub (state 20); transitions to EndScore until Phase 3

---

## Phase 3 — Reveal & Resolve (State 20)

- [x] `States/RevealAndResolve.php` — GAME, state id 20, fully automatic
- [x] Flip all cards in current row face up (`card_face_up = 1`)
- [x] Send `cardsRevealed` notification with full card data for current row
- [x] Resolve Influence phase: for each player, apply central card effect
- [x] Resolve Combat phase: iterate combats starting at `turn_order_start`, anticlockwise
  - [x] Calculate each card's total strength (base + tokens + effects)
  - [x] Award points = difference in strength to winner
  - [x] Send `combatResolved` notification per combat
- [x] Transition to CheckTurn (30)

---

## Phase 4 — Card effects engine

- [x] `CardEffects.php` — static class: data registry + `applyEffect()` for all 25 designs
- [x] Implement Influence effects (central card)
- [x] Implement Combat effects (border cards)
- [x] Implement Brutes: rage mechanic (`player_rage` toggle)
- [x] Implement Flambeurs: dice roll + gambler tokens
- [x] Implement Pirates: pirate_gold token grants Gold rank

---

## Phase 5 — Upgrade state (State 40)

- [x] `States/Upgrade.php` — MULTIPLE_ACTIVE_PLAYER, state id 40
- [x] `getArgs()` — for each player: face-up center column cards + pre-drawn 3 upgrade options per card (private)
- [x] `actConfirmUpgrades(array $choices)` — validate choices, apply productions and upgrades
  - Production: flip card face-down, increment charged gem
  - Upgrade: decrement charged gem, return card to its origin rank deck, place chosen card face-down in grid
- [x] JS Upgrade state — display center column cards with Produce / Upgrade choices; upgrade card picker dialog

---

## Phase 6 — Round & game management

- [x] `States/CheckTurn.php` — GAME, state id 30 — increment turn or trigger upgrade/end
- [x] `States/NextRound.php` — GAME, state id 50 — collect all cards, advance round, rotate first player
- [x] `States/EndScore.php` — GAME, state id 98 — write final scores, apply gem tiebreaker (player_score_aux)
- [x] `getGameProgression()` — return `(round - 1) * 25 + (turn - 1) * 8` (approximate)

---

## Phase 7 — UI & animations

- [x] CSS grid layout for 2/3/4 player configurations
- [x] Card flip animation on reveal
- [x] Combat highlight animation (losing card visual)
- [x] Gem display in player panels (charged vs uncharged icons)
- [x] Turn order marker positioning
- [x] Round/turn counter display
- [x] Shared deck size counters

---

## Phase 8 — Solo mode (bot)

- [x] Bot deck setup (based on difficulty: 0–4 Silver cards replacing Bronze)
- [x] Bot card reveal (static face-down grid revealed at start of each round)
- [x] Bot strength from bottom-right printed value (not standard strength)
- [x] Bot upgrade logic (end of manche: replace 2 Bronze/Silver with 1 higher-rank card)
- [x] One-player game option in `gameoptions.json`

---

## Phase 9 — Polish & release prep

- [ ] PHP syntax checks pass (`make check`) — requires BGA Studio deploy
- [ ] All card effects implemented and tested — 33 effects coded; needs in-game testing
- [x] Replay support — `gemUpdated` emitted after every `applyEffect()` call in RevealAndResolve (influence + combat phases, incl. solo)
- [x] Translations: PHP `clienttranslate()` done; JS `_()` applied to all static user-facing strings (buttons, labels, hints, rank/family names)
- [x] `gameinfos.jsonc` — game name "Border Clash", publisher, tie-breaker description, suggest_player_number
- [x] `stats.jsonc` — define meaningful statistics (8 player stats + 2 table stats); all `incStat`/`setStat` replaced with new `bga->playerStats`/`bga->tableStats` API
- [ ] Pre-release checklist (see BGA docs)
