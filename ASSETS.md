# ASSETS.md — Asset Pipeline

All assets go in `app/img/`. PNG sprites for cards, gems, components, boards.

---

## Sprite sheet summary

| File                       | Grid       | Cell size   | Total size   | Status  |
| -------------------------- | ---------- | ----------- | ------------ | ------- |
| `cards_scoundrels.png`     | 13 × 3     | 300 × 222 px | 3900 × 666 px | Pending |
| `gems.png`                 | 4 × 2      | 300 × 300 px | 1200 × 600 px | Pending |
| `components_scoundrels.png`| 12 × 2     | 300 × 300 px | 3600 × 600 px | Pending |
| `boards.png`               | 7 × 1      | 900 × 600 px | 6300 × 600 px | Pending |

> Cards are delivered at **2× display size** (retina). CSS uses `background-size: 1950px 333px`
> to scale the 3900 × 666 sprite down to the 150 × 111 display size.

---

## `cards_scoundrels.png` — 13 columns × 3 rows

Each cell = one unique card face (300 × 222 px). Columns are shared across all three rows.

| Col | Content                                       | Rank   |
| --- | --------------------------------------------- | ------ |
| 1   | Family bronze design 1  (4 copies in game)    | Bronze |
| 2   | Family bronze design 2  (4 copies in game)    | Bronze |
| 3   | Family bronze design 3  (4 copies in game)    | Bronze |
| 4   | Family silver design 1  (2 copies in game)    | Silver |
| 5   | Family silver design 2  (2 copies in game)    | Silver |
| 6   | Family silver design 3  (2 copies in game)    | Silver |
| 7   | Family silver design 4  (2 copies in game)    | Silver |
| 8   | Family silver design 5  (2 copies in game)    | Silver |
| 9   | Family silver design 6  (2 copies in game)    | Silver |
| 10  | Family gold design 1    (2 copies in game)    | Gold   |
| 11  | Family gold design 2    (2 copies in game)    | Gold   |
| 12  | Family gold design 3    (2 copies in game)    | Gold   |
| 13  | Card back               (same for all rows)   | —      |

| Row | Family  |
| --- | ------- |
| 1   | Gambler (Flambeur) |
| 2   | Brute              |
| 3   | Pirate             |

### CSS sprite formula

Display size: **150 × 111 px** per card.

```css
.bc-card-sprite {
  background-image: url('img/cards_scoundrels.png');
  background-size: 1950px 333px;   /* 13 × 150, 3 × 111 */
  background-repeat: no-repeat;
}
```

Position for a card with `family` (1–3) and column `C` (0-indexed):
```
background-position-x: -(C * 150) px
background-position-y: -((family - 1) * 111) px
```

Column `C` from game data (`type` = rank 1/2/3, `type_arg` = global design number):
```
Bronze (type=1): C = (type_arg - 1) % 3          → 0, 1, 2
Silver (type=2): C = 3 + (type_arg - 1) % 6      → 3 … 8
Gold   (type=3): C = 9 + (type_arg - 1) % 3      → 9, 10, 11
Back (face-down): C = 12                           → 12
```

### DB card counts (after change to 3 bronze designs per family)

| Rank   | Designs | Copies | Total cards |
| ------ | ------- | ------ | ----------- |
| Bronze | 9 (3 × 3 families) | 4 | 36 |
| Silver | 18 (6 × 3 families) | 2 | 36 |
| Gold   | 9 (3 × 3 families)  | 2 | 18 |

Each player starts with 1 copy of each of the 9 bronze designs (9 cards) + 2 silver cards from the draft = 11 cards in their starting deck.

---

## `gems.png` — 4 columns × 2 rows, 300 × 300 px per cell

| Col | Row 1 (charged) | Row 2 (uncharged) |
| --- | --------------- | ----------------- |
| 1   | Red charged     | Red uncharged     |
| 2   | Green charged   | Green uncharged   |
| 3   | Blue charged    | Blue uncharged    |
| 4   | Yellow charged  | Yellow uncharged  |

Player color order matches `gameinfos.jsonc`: red, green, blue, yellow.

CSS display size: **40 × 40 px** (TBC). `background-size: 160px 80px`.

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

## `boards.png` — 7 columns × 1 row, 900 × 600 px per cell

| Col | Content                    |
| --- | -------------------------- |
| 1   | Player board — Red         |
| 2   | Player board — Green       |
| 3   | Player board — Blue        |
| 4   | Player board — Yellow      |
| 5   | Bronze deck support        |
| 6   | Silver deck support        |
| 7   | Gold deck support          |

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
