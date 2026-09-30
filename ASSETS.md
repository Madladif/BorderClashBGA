# ASSETS.md — Asset Pipeline

All assets go in `app/img/`. PNG sprites for cards, gems, components, boards.

---

## Sprite sheet summary

| File                       | Grid       | Cell size (native 2×) | Total size (native 2×) | Display size | Status  |
| -------------------------- | ---------- | --------------------- | ---------------------- | ------------ | ------- |
| `cards_scoundrels.png`     | 18 × 3     | 334 × 238 px          | 6012 × 714 px          | 167 × 119 px | Pending |
| `gems_power_discs.png`     | 8 × 2      | 300 × 300 px          | 2400 × 600 px          | 48 × 48 px   | Pending |
| `components_scoundrels.png`| 12 × 2     | 300 × 300 px          | 3600 × 600 px          | TBC          | Pending |
| `boards.png`               | irregular (7 items, see below) | varies, h=900px | 3020 × 900 px | TBC          | Pending |

> Cards are delivered at **2× display size** (retina). CSS uses `background-size: 1547px 501px`
> to scale the 3094 × 1002 native sprite down to the 119 × 167 display size.

---

## `cards_scoundrels.png` — 18 columns × 3 rows

Each cell = one unique card face (300 × 222 px). Columns are shared across all three rows.

Bronze cards are now printed **per player color** (24 unique bronze faces: 2 designs ×
3 families × 4 colors), so the bronze block widened from 2 to 8 columns. Silver/Gold/Back
keep the same design order as before, just shifted right by 6 columns.

| Col     | Content                          | Rank   |
| ------- | --------------------------------- | ------ |
| 1 – 8   | Bronze, 2 designs × 4 colors (see table below) | Bronze |
| 9 – 14  | Silver, 6 designs (see table below) | Silver |
| 15 – 17 | Gold, 3 designs (see table below)   | Gold   |
| 18      | Card back (same for all rows)       | —      |

**Verified against the actual delivered `cards_scoundrels.png` pixel-by-pixel** (not a
placeholder) — the artist's in-family column order is its own thing, not the
`cartes.csv` row order the code originally assumed. This table is the corrected
source of truth; `Game.js`'s `_spritePos()` was fixed to match (see below).

| Row | Family             | Col 1 (bronze) | Col 2 (bronze) | Col 9 | Col 10 | Col 11 | Col 12 | Col 13 | Col 14 | Col 15 (gold) | Col 16 (gold) | Col 17 (gold) |
| --- | ------------------ | --------------- | --------------- | ----- | ------ | ------ | ------ | ------ | ------ | -------------- | -------------- | -------------- |
| 1   | Gambler (Flambeur)  | High Roller (Parieur) | Amateur | Bookie (Bookmaker) | Accomplice (Complice) | Dealer (Croupier) | Cheater (Tricheur) | Benefactor (Mécène) | Lucky Dog (Chanceux) | Mad Dice | Poker Face | Crazy 6 |
| 2   | Brute               | Berserker | Troll | Mercenary (Mercenaire) | Goon (Gros bras) | Bouncer (Videur) | Defender (Muraille) | Werewolf (Loup-Garou) | Barbarian (Barbare) | Brunhilde | Shock Fang | Goliath |
| 3   | Pirate              | Cabin Boy (Mousse) | Freebooter (Baroudeur) | Raider (Pillard) | First Mate (Second) | Buccaneer (Boucanier) | Bombardier (Artificier) | Lookout (Vigie) | Navigator (Navigateur) | Flying Dutchman (Hollandais volant) | Lady Fortune | Davy Jones |

Cols 3-8 (bronze) repeat cols 1-2's two designs for Green/Blue/Yellow (col order:
Red, Green, Blue, Yellow — matches `gameinfos.jsonc`'s `player_colors` order and the
existing `_colorToGemCol()` helper in `Game.js`, which `_bronzeColorIndex()` reuses
directly).

### CSS sprite formula

Display size: **167 × 119 px** per card (landscape). Native sprite cells: **334 × 238 px** (2× retina).

```css
.bc-card-sprite {
  background-image: url('img/cards_scoundrels.png');
  background-size: 3006px 357px;   /* 18 × 167, 3 × 119 */
  background-repeat: no-repeat;
}
```

Position for a card with `family` (1–3) and column `C` (0-indexed):
```
background-position-x: -(C * 167) px
background-position-y: -((family - 1) * 119) px
```

Column `C` from game data (`type` = rank 1/2/3, `type_arg` = design number, i.e. the
`CardEffects.php` `$DATA` key = `cartes.csv` id minus 6 for Silver / minus 24 for Gold):
```
Bronze (type=1): C = colorIndex(owner) * 2 + (type_arg - 1) % 2   → 0 … 7
Silver (type=2): C = 8  + SILVER_COL[type_arg]                    → 8 … 13
Gold   (type=3): C = 14 + GOLD_COL[type_arg]                      → 14 … 16
Back (face-down): C = 17                                            → 17
```
`SILVER_COL`/`GOLD_COL` are explicit per-design lookup tables in `_spritePos()`
(`Game.js`) — **not** `(type_arg - 1) % 6` / `% 3`. That naive cycling formula was
the original (wrong) assumption; the real in-family column order, read directly off
`cards_scoundrels.png`, doesn't follow the csv row order. See the table above for the
verified per-family order these two lookups encode.

`colorIndex(owner)` maps the card's owning player's color to **0=Red, 1=Green,
2=Blue, 3=Yellow** via `_colorToGemCol()`.

Implemented in `Game.js`: `_spritePos(type, typeArg, family, cardId)` now takes the
card id and looks up its owner via `this._bronzeOwnerPid` (a `cardId → pid` map built
once in `setup()` from `hand`/`deck_cards`/`grid_cards` — bronze cards never change
owner mid-game, so one pass at load/F5 covers the whole session). All render call sites
(`setupFrontDiv`, `setupBackDiv`, `_cardTooltipHtml`, `_cardHtml`) pass `card.id`.
Back-face column moved to 17 (was 11).

### DB card counts

| Rank   | Designs | Copies | Total cards |
| ------ | ------- | ------ | ----------- |
| Bronze | 6 (2 × 3 families) | 4 | 24 |
| Silver | 18 (6 × 3 families) | 2 | 36 |
| Gold   | 9 (3 × 3 families)  | 2 | 18 |

Each player starts with 1 copy of each of the 6 bronze designs (6 cards) + 2 silver cards from the draft = 8 cards in their starting deck.

---

## `gems_power_discs.png` — 8 columns × 2 rows, 300 × 300 px per cell

Renamed from `gems.png`: now combines the 3 gems per player with the physical
+0 / +10 power-disc markers used on the shared power gauges (`boards.png` pos. 7).

| Col | Row 1 (charged / "0" face) | Row 2 (uncharged / "+10" face) |
| --- | --------------------------- | -------------------------------- |
| 1   | Red gem charged              | Red gem uncharged                |
| 2   | Green gem charged            | Green gem uncharged              |
| 3   | Blue gem charged             | Blue gem uncharged               |
| 4   | Yellow gem charged           | Yellow gem uncharged             |
| 5   | Red power disc, "0" face     | Red power disc, "+10" face       |
| 6   | Green power disc, "0" face   | Green power disc, "+10" face     |
| 7   | Blue power disc, "0" face    | Blue power disc, "+10" face      |
| 8   | Yellow power disc, "0" face  | Yellow power disc, "+10" face    |

Player color order matches `gameinfos.jsonc`: red, green, blue, yellow (cols 1-4 and
5-8 use the same order). `_colorToGemCol()` in `Game.js` returns this column index
(0-3) from a player's hex color; gem cells use it directly, disc cells use `4 + index`.

CSS display size: **48 × 48 px** for both gems and discs. `background-size: 384px 96px`.

The power gauge marker (`.bc-gauge-marker` in `borderclash.css`) uses the row-1/row-2
split as the physical "+10 flip": row 1 while a side's power is ≤ 10, row 2 once it
exceeds 10 (toggled via the `.bc-gauge-over10` class, already computed in
`_setGaugeMarker()`). The disc's color column is fixed per marker at gauge creation
time (`_gaugeHtml()`), since a player's color never changes mid-game.

---

## `components_scoundrels.png` — 12 columns × 2 rows, 300 × 300 px per cell

Row 1 = front face, Row 2 = back face.

| Col | Front (row 1)               | Back (row 2)          |
| --- | --------------------------- | --------------------- |
| 1   | Die face 1                  | —                     |
| 2   | Die face 2                  | —                     |
| 3   | Die face 3                  | —                     |
| 4   | Die face 4                  | —                     |
| 5   | Die face 5                  | —                     |
| 6   | Die face 6                  | —                     |
| 7   | Gambler token  +1           | Gambler token  −1     |
| 8   | Gambler token  +4           | Gambler token  −2     |
| 9   | Gambler token  +3           | Gambler token  −3     |
| 10  | Gambler token  +8           | Gambler token  −4     |
| 11  | Brute rage marker (enraged) | Brute rage (calm)     |
| 12  | Pirate gold token (front)   | Pirate gold (back)    |

---

## `boards.png` — irregular grid, common height 900 px, no bronze deck support

Unlike the other sheets, cells here do **not** share a uniform width — each source
image keeps its own aspect ratio and most are stored **rotated 90°** so every cell's
height matches the common 900 px. Because widths vary, positioning uses an explicit
per-item offset table below (`x`, `width`), not a `column × cell_width` formula.

Sheet total: **3020 × 900 px** (native, 2× retina — display size TBC, same convention as the rest of this file).

| Pos | Content                          | Source (native, pre-rotation) | Orientation in sheet | Cell in sheet (w × h) | `x` offset |
| --- | --------------------------------- | ------------------------------ | --------------------- | ---------------------- | ---------- |
| 1   | Player board — Red                | 900 × 410                      | 90°                    | 410 × 900               | 0          |
| 2   | Player board — Green               | 900 × 410                      | 90°                    | 410 × 900               | 410        |
| 3   | Player board — Blue                | 900 × 410                      | 90°                    | 410 × 900               | 820        |
| 4   | Player board — Yellow              | 900 × 410                      | 90°                    | 410 × 900               | 1230       |
| 5   | Silver deck support                | 900 × 600                      | 90°                    | 600 × 900               | 1640       |
| 6   | Gold deck support                  | 900 × 560                      | 90°                    | 560 × 900               | 2240       |
| 7   | Power gauge (jauge de puissance)   | 220 × 900                      | 0° (not rotated)       | 220 × 900               | 2800       |

- No Bronze deck support in this file (dropped from the previous 7-column layout).
- Power gauge (pos. 7): drawn with **1 at the bottom, 10 at the top** — matches the
  in-game gauge's `column-reverse` orientation (see `.bc-power-gauge` in
  `borderclash.css`), no flip needed.
- CSS: one class per item with an explicit `background-position-x: -{x}px` (no shared
  formula), e.g. `.bc-board-red { background-position-x: -0px; width: 410px; }` (native
  values shown; halve for 2× display once the actual display size is confirmed).

**Implemented** (power gauge only, pos. 7): `.bc-power-gauge` in `borderclash.css` now
uses this file as its background — element sized 110 × 450 px (half of native 220 × 900,
same convention as cards), `background-position: -1400px 0` (half of native x=2800),
`background-size: 1510px 450px` (half of the full 3020 × 900 sheet). Positions 1-6
(player boards, deck supports) are still undocumented in CSS — no UI element consumes
them yet.

---

## Naming conventions

- All files: lowercase, underscores, no spaces.
- Player color suffix: `_red`, `_green`, `_blue`, `_yellow`.
- Rank suffix: `_bronze`, `_silver`, `_gold`.
- Family suffix: `_brute`, `_gambler`, `_pirate` (if needed).

---

## Status

All assets pending delivery from illustrator (Gaël Lannurien).
CSS sprite infrastructure is implemented and ready; cards render as blank cells until images arrive.
