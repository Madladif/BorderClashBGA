# CLAUDE.md — Border Clash (BGA Studio)

> Auto-loaded by Claude Code at every session start.

---

## Startup — always do this first

Before writing any code, read PROCEDURES.md for the full checklist.
Key files to read every session:

```bash
cat app/modules/php/States/Deploy.php
cat app/modules/php/States/RevealAndResolve.php
cat app/modules/php/States/Upgrade.php
cat app/modules/php/States/EndScore.php
cat app/modules/js/Game.js
cat app/modules/php/Game.php
```

> Until those state files exist, read `app/modules/php/States/PlayerTurn.php` and `NextPlayer.php` instead.

Project documentation:
- Architecture & DB schema → DESIGN.md
- Card list & physical components → MATERIALS.md
- Full rules → RULES.md
- What's done / what's next → PLAN.md
- Workflows & checklists → PROCEDURES.md
- Asset pipeline → ASSETS.md

---

## Code rules

- All comments in English
- All strings, variable names, HTML IDs in English — French translations handled later via `clienttranslate()`
- Do not create new files without asking first

### Vocabulary (FR → EN)

| FR | EN |
|----|----|
| Flambeur | gambler |
| Brute | brute |
| Pirate | pirate |
| Manche | round |
| Tour | turn |
| Bronze / Argent / Or | bronze / silver / gold |
| Gemme | gem |
| Chargée / Déchargée | charged / uncharged |
| Trait | trait |
| Arcane / Impact / Maîtrise | arcane / impact / mastery |
| Force | strength |
| Marqueur Rage | rage marker |
| Frontière (gauche/droite) | border (left/right) |
| Centre / Influence | center / influence |
| Grille | grid |
| Emplacement | position |
| Emplacement suivant / précédent | next position / previous position |
| Jeton Flambeur | gambler token |
| Jeton Or Pirate | pirate gold token |
| Chaudron (Mages) | cauldron |
| Piste de Gloire (Champions) | glory track |

---

## Critical rules (never violate)

**Card visibility:**
```js
isCardVisible: (card) => !!card.type,
```
Never include `card_type` / `card_type_arg` in `notify->all()` for a face-down card.
For upgrade draw (3 options): always `notify->player()` — never visible to others.

**Token storage:** Always by `(player_id, grid_position)`, never by `card_id`.
`grid_position = 255` is reserved for out-of-grid containers (Mages cauldron — future expansion).

**Grid positions (1-indexed columns and rows):**
```
col:  1 (left border)   2 (center)   3 (right border)
row3:       6                7               8
row2:       3                4               5
row1:       0                1               2
```
Formula: `(row - 1) * 3 + (col - 1)` → 0–8.
Next position = `grid_position + 3` (invalid at row 3 → no effect).
Previous position = `grid_position - 3` (invalid at row 1 → no effect).

---

## BGA libraries

```js
// Load order — BgaAnimations BEFORE BgaCards (dependency)
const BgaAnimations = await importEsmLib("bga-animations", "1.x");
const BgaCards = await importEsmLib("bga-cards", "1.x");
```

---

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| `addCards()` async not awaited → `setSelectableCards` too early | `async _initStocks()` or `setTimeout` |
| PHP data as object in JS | `Object.values(gamedatas.xxx)` |
| `card.type` as string → wrong sort | `parseInt(card.type)` on receipt |
| Mixed px/% in sprites | Same unit throughout |
| CSS ID selector on animated element | Class selectors only |
| `drop-shadow` + Safari → slow | `html.dj_safari .el { filter: none; }` |
| Face-down card: `type` sent by mistake | Never include `type` in `notify->all()` for hidden card |
| `self::` on instance method (PHP 8.4) | Use `$this->` everywhere (`self::CONST` for constants is fine) |
| `${var}` in PHP string (PHP 8.4) | Use `{$var}` instead |
| `implode(array, separator)` (PHP 8.4) | `implode(separator, array)` |

---

## Useful commands

```bash
php -l app/modules/php/Game.php                                      # PHP syntax check
php -l app/modules/php/States/Deploy.php                             # syntax check a state
grep -rn "bc-" app/modules/js/                                       # list HTML IDs used in JS
grep -rn "notify->all\|notify->player" app/modules/php/              # list PHP notifications
grep -rn "class.*extends GameState" app/modules/php/States/          # list state classes
```

---

## References

### BGA Libraries
- BgaCards API: https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/docs/index.html
- BgaAnimations API: https://x.boardgamearena.net/data/game-libs/bga-animations/1.x/docs/index.html
- BgaCards demo: https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/demo/index.html

### BGA Documentation
- Game.js: https://en.doc.boardgamearena.com/Game_interface_logic:_Game.js
- Game.php: https://en.doc.boardgamearena.com/Main_game_logic:_Game.php
- Game.php Actions (autowired): https://en.doc.boardgamearena.com/Main_game_logic:_Game.php#Actions_(autowired)
- dbmodel.sql: https://en.doc.boardgamearena.com/Game_database_model:_dbmodel.sql
- stats.json: https://en.doc.boardgamearena.com/Game_statistics:_stats.json
- gameoptions / gamepreferences: https://en.doc.boardgamearena.com/Options_and_preferences:_gameoptions.json,_gamepreferences.json
- States: https://en.doc.boardgamearena.com/State_classes:_State_directory
- PlayerCounter / TableCounter: https://en.doc.boardgamearena.com/PlayerCounter_and_TableCounter
- Pre-release checklist: https://en.doc.boardgamearena.com/Pre-release_checklist
- BGA Cookbook: https://en.doc.boardgamearena.com/BGA_Studio_Cookbook
