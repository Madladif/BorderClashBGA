# DESIGN.md — Border Clash Architecture

Framework: **new BGA PHP class-based framework** (namespace `Bga\Games\borderclash`).

---

## Database Schema

### `bc_card` table (custom Deck-compatible)

| Column | Type | Description |
|--------|------|-------------|
| `card_id` | INT UNSIGNED AUTO_INCREMENT | PK |
| `card_type` | TINYINT | Rank: 1=Bronze, 2=Silver, 3=Gold |
| `card_type_arg` | SMALLINT | Unique design number within rank (see MATERIALS.md) |
| `card_location` | VARCHAR(32) | See locations below |
| `card_location_arg` | INT | player_id (deck/hand) or grid_position 0–8 (grid) |
| `card_face_up` | TINYINT | 0=face down, 1=face up |
| `card_family` | TINYINT | Card family: 1=Flambeur, 2=Brute, 3=Pirate (future: 4=Mages, 5=Champions, 6=Créatures) |

**Card type/arg mapping** (see MATERIALS.md for full list):
- `card_type` 1 = Bronze, 2 = Silver, 3 = Gold
- `card_type_arg` = design number within rank
  - Bronze 1–6: 1=Amateur, 2=Parieur, 3=Troll, 4=Gros-bras, 5=Mousse, 6=Quartier-Maître
  - Silver 1–18: 1–6 Flambeur, 7–12 Brute, 13–18 Pirate
  - Gold 1–9: 1–3 Flambeur, 4–6 Brute, 7–9 Pirate
- `card_family` = 1 (Flambeur), 2 (Brute), 3 (Pirate) — enables family-based filtering for mixed-family game modes

**Locations:**
- `'deck'` / `'hand'` — personal deck/hand, location_arg = player_id
- `'grid_{player_id}'` — deployed in player grid, location_arg = grid_position 0–8
- `'shared_bronze'` / `'shared_silver'` / `'shared_gold'` — shared draw piles, location_arg = 0
- `'upgrade_temp_{player_id}'` — 3 cards drawn during upgrade pick, location_arg = 0–2
- `'draft'` — Silver draft hand (pre-game phase only), location_arg = player_id
- `'bot_deck'` — Solo mode: bot card pool (undeployed), location_arg = 0
- `'bot_grid_left'` / `'bot_grid_right'` — Solo mode: bot columns, location_arg = row index (0–2)

### `bc_token` table

Tokens are always stored by **position** (player_id + grid_position), not by card_id.
"Sur cette carte" = position of the current card. "Sur l'emplacement suivant" = grid_position + 3 (next row, same column).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT UNSIGNED AUTO_INCREMENT | PK |
| `player_id` | INT(10) | Owner |
| `grid_position` | TINYINT(1) | 0–8, see grid map below |
| `token_type` | VARCHAR(20) | `'flambeur'` or `'pirate_gold'` |
| `value` | TINYINT(2) | Flambeur: signed strength modifier (e.g. +1, −3, +8). Pirate gold: 0 (presence = Gold rank) |

Multiple tokens of the same type/value on the same position are allowed (one row each).

**Reserved positions:**
- `grid_position` 0–8 → standard grid cells
- `grid_position = 255` → reserved for out-of-grid containers (e.g. Mages cauldron in future expansion)

Key: `(player_id, grid_position)` secondary index for fast lookup.

A face-down Mousse has force 0 and its rank/traits are ignored for all effect calculations.

### `player` table (standard BGA + custom columns)

```sql
ALTER TABLE `player`
  ADD `player_gems_charged`   TINYINT(1) NOT NULL DEFAULT 1,
  ADD `player_gems_uncharged` TINYINT(1) NOT NULL DEFAULT 2,
  ADD `player_rage`           TINYINT(1) NOT NULL DEFAULT 0;
```

`player_rage`: 0=Calm, 1=Enraged (Brutes family only). Starts at 0 (Calm).
Total gems per player is always 3 (charged + uncharged = 3).

### Global variables (`$this->bga->globals`)

| Key | Type | Description |
|-----|------|-------------|
| `round_number` | int | Current round (1–4) |
| `turn_number` | int | Current turn within round (1–3) |
| `turn_order_start_id` | int | player_id of the current "first player" (where marker sits) |
| `player_order` | array | Ordered player_ids in anticlockwise combat direction |
| `current_combat_idx` | int | Index into `player_order` of the combat currently being resolved |
| `draft_round` | int | Silver draft pass number (1 or 2; set to 3 after completion) |
| `is_solo` | bool | 1 in solo mode; set once in setupNewGame |

---

## Grid

### Column and row convention (1-indexed, matching the wireframe)

```
col:    1 (left border)    2 (center)    3 (right border)
row 3:       6                  7               8
row 2:       3                  4               5
row 1:       0                  1               2
```

**grid_position formula:** `(row − 1) × 3 + (col − 1)` → 0–8

Rows are built bottom-up: row 1 first (turn 1), row 3 last (turn 3).
The UI displays them top-down (row 3 at top, row 1 at bottom).

**Column roles:**
- col 1 (positions 0, 3, 6) — left border → combat with previous player's col 3
- col 2 (positions 1, 4, 7) — center → Influence phase only
- col 3 (positions 2, 5, 8) — right border → combat with next player's col 1

**"Emplacement suivant"** = same column, next row = grid_position + 3.
Does not exist at row 3 (turn 3) → no token placed.
**"Emplacement précédent"** = same column, previous row = grid_position − 3.
Does not exist at row 1 (turn 1) → effect does not resolve.

---

## Turn Order

The turn order marker sits between the first player and their right neighbor (joueur suivant).

At the start of each combat phase, combats are resolved starting from the marker position:
1. First player's col 3 vs joueur suivant's col 1
2. Then anticlockwise: joueur suivant's col 3 vs the next player's col 1
3. … and so on until all N combats are resolved.

**Between rounds:** the marker advances one position anticlockwise (= the next player in combat order becomes the new first player). Round 1 → P1 first, Round 2 → P2 first, etc.

Within each combat, **left player's card effect is resolved first**, then right player's, then strength comparison.

**Simultaneous effects** (Influence phase): resolved in anticlockwise turn order.

---

## Rules clarifications (confirmed with game designers)

| Rule | Behaviour |
|------|-----------|
| Token storage | Always on position `(player_id, grid_position)`. "Sur cette carte" = the card's current position. |
| Direct VP cards (Loup-Garou, Lady Fortune, Double 6) | VPs are **cumulative** with combat differential points. |
| Grizzly gem cost | **Mandatory** if the player has a charged gem. All effects are obligatory if they can be resolved. |
| Mousse face-down | Force = 0, rank and traits **no longer count** for any effect. |
| Simultaneous effects | Anticlockwise turn order always determines resolution priority. |
| Turn order marker | Advances one step anticlockwise after each round. |

---

## Game State Machine

| ID | Class | Type | Description |
|----|-------|------|-------------|
| 1 | — | GAME | gameSetup (reserved) |
| 10 | `Deploy` | MULTIPLE_ACTIVE | All players place 3 cards face down + mulligan |
| 13 | `SilverDraft` | MULTIPLE_ACTIVE | Players simultaneously pick 1 Silver card from their 3-card draft hand (pre-game) |
| 16 | `SilverDraftNext` | GAME | Pass remaining draft cards left; loop or transition to Deploy after 2 passes |
| 20 | `RevealAndResolve` | GAME | Flip cards, resolve Influence, resolve Combats |
| 30 | `CheckTurn` | GAME | Advance turn or trigger Upgrade / EndScore |
| 40 | `Upgrade` | MULTIPLE_ACTIVE | Players simultaneously upgrade or produce center cards |
| 50 | `NextRound` | GAME | Reset tokens, collect decks, advance round/turn markers |
| 98 | `EndScore` | GAME | Write final scores before transitioning to 99 |
| 99 | — | GAME | gameEnd (reserved by BGA framework) |

### Transitions

```
gameSetup(1)         → SilverDraft(13)
SilverDraft(13)      → SilverDraftNext(16)
SilverDraftNext(16)  → SilverDraft(13)       [draft_round ≤ 2: pass cards left, loop]
SilverDraftNext(16)  → Deploy(10)            [draft_round > 2: draft complete]
Deploy(10)           → RevealAndResolve(20)
RevealAndResolve(20)→ CheckTurn(30)
CheckTurn(30)       → Deploy(10)         [turn_number < 3: increment turn]
CheckTurn(30)       → Upgrade(40)        [turn_number == 3 AND round < 4]
CheckTurn(30)       → EndScore(98)       [turn_number == 3 AND round == 4]
Upgrade(40)         → NextRound(50)
NextRound(50)       → Deploy(10)
EndScore(98)        → gameEnd(99)
```

### State details

**Deploy (10)** — MULTIPLE_ACTIVE_PLAYER
- Args (private per player): `hand` cards with their full type data
- Actions:
  - `actDeployCards(int $col1CardId, int $col2CardId, int $col3CardId)` — place 3 cards face down
  - `actMulligan(int $cardId)` — costs 1 charged gem; move card to deck bottom, draw 1 new card
- Zombie: auto-deploy 3 random hand cards, no mulligan

**RevealAndResolve (20)** — GAME (automatic)
- For each player: flip current row cards face up → `cardsRevealed`
- Influence phase: resolve col 2 cards in anticlockwise turn order → `influenceResolved`
- Combat phase: resolve N combats starting from `turn_order_start_id` → `combatResolved` per fight
  - Sequence per combat: left player effect → right player effect → compare strengths → award points (differential + any direct VPs)
- Transition to CheckTurn

**Upgrade (40)** — MULTIPLE_ACTIVE_PLAYER
- Args (private per player): face-up center column cards + 3 pre-drawn upgrade options per upgradable card
- Action: `actConfirmUpgrades(array $choices)` — array of `{cardId, action, keepCardId?}`
- Production: flip card face-down, increment `player_gems_charged` (max 3 total)
- Upgrade: decrement gem, return card to origin shared deck, place chosen card face-down, return 2 others
- Zombie: auto-produce all center cards

---

## Notifications

| Name | Emitter | Payload | Description |
|------|---------|---------|-------------|
| `silverDraftPicked` | `notify->all` | `player_id`, `player_name`, `draft_round` | Player picked a Silver card (no card type revealed) |
| `silverCardKept` | `notify->player` | `card` (`id`, `type`, `type_arg`, `family`) | Private: the card the active player kept |
| `silverCardsReceived` | `notify->player` | `cards[]` | Private: draft cards passed to recipient after a pick round |
| `silverLastCardReceived` | `notify->player` | `card` | Private: last remaining card auto-assigned after pass 2 |
| `silverDraftComplete` | `notify->all` | — | Silver Draft finished; game begins |
| `handDealt` | `notify->player` | `hand[]`, `deck_count`, `gems_charged` | Private: authoritative hand delivery at Deploy state entry |
| `cardsDeployed` | `notify->all` | `player_id`, `player_name`, `cards[]` (`id`, `position`) | Player placed 3 face-down cards (no card types!) |
| `mulliganCard` | `notify->player` | `discarded_card_id`, `new_card` (`id`, `type`, `type_arg`, `family`) | Private: mulligan result for the active player |
| `cardsRevealed` | `notify->all` | `player_id`, `cards[]` | Current row flipped face up with full type data |
| `influenceResolved` | `notify->all` | `player_id`, `card_id`, `effect_type`, `effect_args` | Central card effect applied |
| `combatResolved` | `notify->all` | `left_player_id`, `right_player_id`, `left_strength`, `right_strength`, `winner_id`, `combat_points`, `bonus_vp` | One combat result (combat_points = differential, bonus_vp = direct VP cards) |
| `scoreUpdated` | `notify->player` | `player_id`, `score` | Point total updated |
| `gemUpdated` | `notify->all` | `player_id`, `charged`, `uncharged` | Gem state changed |
| `rageUpdated` | `notify->all` | `player_id`, `rage` | 0=Calm, 1=Enraged |
| `tokenAdded` | `notify->all` | `player_id`, `grid_position`, `token_type`, `value` | Token placed on a position |
| `tokensCleared` | `notify->all` | — | End of round: all tokens removed |
| `upgradeCompleted` | `notify->all` | `player_id`, `actions[]` | Upgrade choices applied |
| `deckShuffled` | `notify->all` | `player_id` | Player shuffled deck for new round |
| `botCardsDeployed` | `notify->all` | `left_count`, `right_count` | Solo mode: bot placed cards at round start |

**Visibility rule** — CRITICAL:
```js
isCardVisible: (card) => !!card.type
```
Never include `card_type` / `card_type_arg` in `notify->all()` for face-down cards.
For upgrade draw (3 options): always `notify->player()` — never visible to others.

---

## UI Layout

### Wireframe — Multiplayer (current player view)

The current player ("Moi") sees 5 columns: their own 3 columns + the adjacent border columns of both neighbors.

```
[prev col3] [my col1] [my col2] [my col3] [next col1]
   row3        row3     row3      row3       row3
   row2        row2     row2      row2       row2
   row1        row1     row1      row1       row1
[Deck]    [Player board: gems | score dizaines | score unités]
```

Other players' boards show only their own 3 columns (no neighbor columns).

### Wireframe — Solo (player view)

```
[solo col1] [my col1] [my col2] [my col3] [solo col2]
   row3        row3     row3      row3       row3
   row2        row2     row2      row2       row2
   row1        row1     row1      row1       row1
[Deck]    [Player board]                  [Solo points]
```

Bot has 2 columns (col 1 left, col 2 right). No gems, no player board.

### HTML structure

```
#bc-game-area
  #bc-round-tracker          — round (1–4) + turn (1–3) display
  #bc-turn-order-marker      — positioned between current first player and next
  #bc-players-area           — wraps all player boards
    .bc-player-board[data-player-id]
      .bc-grid               — 3×3 cells, built row by row (row1 at bottom)
        .bc-cell[data-pos="0..8"]
      .bc-player-info        — gems + score
  #bc-shared-decks           — Bronze / Silver / Gold shared pile counters
```

### HTML IDs and classes

| Element | Selector |
|---------|---------|
| Player board | `.bc-player-board[data-player-id="{id}"]` |
| Grid cell | `.bc-cell[data-player-id="{id}"][data-pos="{0-8}"]` |
| Neighbor border col (left) | `.bc-neighbor-left[data-player-id="{id}"]` |
| Neighbor border col (right) | `.bc-neighbor-right[data-player-id="{id}"]` |
| Solo bot column left | `#bc-solo-left` |
| Solo bot column right | `#bc-solo-right` |
| Shared Bronze deck | `#bc-deck-bronze` |
| Shared Silver deck | `#bc-deck-silver` |
| Shared Gold deck | `#bc-deck-gold` |
| Round counter | `#bc-round-counter` |
| Turn counter | `#bc-turn-counter` |
| Score panel | `#bc-score-{playerId}` |
| Gems panel | `#bc-gems-{playerId}` |

### Card CSS classes

```
.bc-card                 — base card element
.bc-card-rank-1          — Bronze
.bc-card-rank-2          — Silver
.bc-card-rank-3          — Gold (or with pirate_gold token)
.bc-card-hidden          — face-down (shows card back)
.bc-card-selected        — during deploy selection
.bc-col-left             — in col 1 (left border)
.bc-col-center           — in col 2 (center/influence)
.bc-col-right            — in col 3 (right border)
```

### Sprites

TODO — pending assets from illustrator (Gaël Lannurien). See ASSETS.md.
