# ASSETS.md — Asset Pipeline

All assets go in `app/img/`. SVG preferred for cards and tokens; PNG for anything with complex gradients.

---

## Card sprites

Each card is a unique design. The sprite sheet is organized by rank.

| File | Content | Format |
|------|---------|--------|
| `cards_bronze.png` | All 24 Bronze card faces (8 per family × 3 families) | PNG sprite |
| `cards_silver.png` | All 36 Silver card faces (12 per family × 3 families) | PNG sprite |
| `cards_gold.png` | All 18 Gold card faces (6 per family × 3 families) | PNG sprite |
| `card_back.svg` | Generic card back (same for all ranks) | SVG |
| `card_back_bronze.svg` | Bronze card back (if rank-specific backs are used) | SVG |
| `card_back_silver.svg` | Silver card back | SVG |
| `card_back_gold.svg` | Gold card back | SVG |

### Sprite sheet layout

TODO — to be defined once illustrator assets are received (Gaël Lannurien).

Planned CSS class pattern:
```css
.bc-card-rank-1 { background-image: url('img/cards_bronze.png'); }
.bc-card-type-1  { background-position: 0 0; }
.bc-card-type-2  { background-position: -120px 0; }
/* ... */
```

Card dimensions: TODO (to confirm with illustrator).

---

## Tokens

| File | Description |
|------|-------------|
| `token_flambeur.svg` | Flambeur token (10 in game) |
| `token_pirate_gold.svg` | Pirate gold token / "Or" token (16 in game) |
| `token_rage.svg` | Rage marker — Calm face |
| `token_rage_enraged.svg` | Rage marker — Enraged face |

---

## Gems

| File | Description |
|------|-------------|
| `gem_charged_{color}.svg` | Charged gem (colored face) — one per player color |
| `gem_uncharged.svg` | Uncharged gem (grey face, same for all) |

Player colors: red, green, blue, orange (matches `gameinfos.inc.php`).

---

## Player board & other components

| File | Description |
|------|-------------|
| `board_player.svg` | Player board (with grid area outline) |
| `cube_score_{color}.svg` | Score cube per player color (units + tens tracking) |
| `marker_turn_order.svg` | Turn order marker |
| `cube_round.svg` | Round counter cube |
| `die.svg` | Die faces (or use `bga-dice` library) |
| `deck_support_bronze.svg` | Bronze deck support |
| `deck_support_silver.svg` | Silver deck support |
| `deck_support_gold.svg` | Gold deck support |

---

## Naming conventions

- All files: lowercase, underscores, no spaces.
- Player color suffix: `_red`, `_green`, `_blue`, `_orange`.
- Rank suffix: `_bronze`, `_silver`, `_gold`.
- Family suffix: `_brute`, `_flambeur`, `_pirate` (if needed).

---

## Status

Pending delivery from illustrator. This file will be updated once assets arrive.
