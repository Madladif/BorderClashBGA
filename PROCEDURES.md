# PROCEDURES.md — Workflows for AI

---

## Before writing any code

Always read these files first (no exceptions):

```bash
cat app/modules/php/States/Deploy.php         # main player state
cat app/modules/php/States/RevealAndResolve.php
cat app/modules/php/States/Upgrade.php
cat app/modules/php/States/EndScore.php
cat app/modules/js/Game.js
cat app/modules/php/Game.php
```

Then check the relevant section of DESIGN.md for the feature being implemented.

> Note: until the state files above are created, read the existing scaffold states:
> `app/modules/php/States/PlayerTurn.php` and `app/modules/php/States/NextPlayer.php`

---

## Adding a new PHP game state

1. Create `app/modules/php/States/MyState.php` — extend `GameState`, set a unique `id`
2. Register in `Game.js` constructor: `this.bga.states.register('MyState', new MyState(this, this.bga))`
3. Update the state machine table in DESIGN.md
4. Mark the step complete in PLAN.md

State ID ranges:
- 10–19: deploy / player action states
- 20–39: automatic game resolution states
- 40–49: upgrade / between-round states
- 50–89: transitions and round management
- 98: EndScore (reserved — write scores here, not in state 99)
- 99: gameEnd (reserved by BGA framework)

---

## Adding a new notification

1. **PHP** — emit in the relevant State class:
   ```php
   $this->bga->notify->all('notifMyEvent', clienttranslate('...'), [...]);
   // For private info (hidden cards, private upgrade draw): notify->player()
   ```
2. **JS** — add handler method (auto-detected by `setupPromiseNotifications`):
   ```js
   async notif_myEvent(args) { ... }
   ```
3. Update the Notifications table in DESIGN.md

---

## Card visibility rule (enforced everywhere)

- Never include `card_type` or `card_type_arg` in `notify->all()` for a face-down card.
- Face-down cards: send only `card_id`, `card_location`, `card_location_arg`.
- Opponent's upgrade draw: always `notify->player()` (private, not `notify->all()`).

---

## Running syntax checks

```bash
php -l app/modules/php/Game.php
php -l app/modules/php/States/Deploy.php
php -l app/modules/php/States/RevealAndResolve.php
php -l app/modules/php/States/Upgrade.php
php -l app/modules/php/States/EndScore.php
```

---

## Before declaring a feature complete

- [ ] PHP syntax check passes
- [ ] All notifications have both a PHP emitter and a JS handler
- [ ] Hidden cards never expose `card_type` to `notify->all()`
- [ ] New state registered in `Game.js` with exact PHP class name (case-sensitive)
- [ ] DESIGN.md updated if state machine or notifications changed
- [ ] PLAN.md step marked complete

---

## Grid position reference

Columns and rows are **1-indexed**. Formula: `($row - 1) * 3 + ($col - 1)` → 0–8.

```
col:  1 (left border)   2 (center)   3 (right border)
row 3:       6               7               8
row 2:       3               4               5
row 1:       0               1               2
```

Rows are built bottom-up (row 1 = turn 1, placed first). UI displays top-down (row 3 at top).

Center column / Influence (col 2): positions 1, 4, 7
Left border / Combat (col 1): positions 0, 3, 6
Right border / Combat (col 3): positions 2, 5, 8

**Emplacement suivant** = grid_position + 3 (next row, same col). Invalid at row 3.
**Emplacement précédent** = grid_position − 3 (prev row, same col). Invalid at row 1.

---

## Deploy action validation checklist

When implementing `actDeployCards`:
- Card IDs must be in player's `'hand'` location
- All 3 card IDs must be distinct
- Cards in grid must not already exist for current turn row
- After deploy: all 3 cards moved to `"grid_{playerId}"` with `card_face_up = 0`

When implementing `actMulligan`:
- Player must have `player_gems_charged >= 1`
- Card ID must be in `'hand'` location
- Move card to bottom of `'deck'` (location_arg = player_id)
- Draw 1 new card from top of `'deck'`
- Decrement `player_gems_charged` by 1

---

## Upgrade action validation checklist

When implementing `actConfirmUpgrades`:
- Only face-up center column cards (`grid_position` in {1, 4, 7}) may be targeted
- `'produce'` action: no gem cost; flip card face-down; increment `player_gems_charged` by 1 (max 3 total)
- `'upgrade'` action: requires `player_gems_charged >= 1`
  - Decrement charged gem
  - Return card to its origin shared deck (Bronze→`shared_bronze`, Silver→`shared_silver`)
  - The 3 drawn upgrade options (pre-drawn in getArgs) must still be in `upgrade_temp_{playerId}`
  - Move chosen card to the vacated grid position, face-down
  - Return other 2 drawn cards to bottom of their shared deck
