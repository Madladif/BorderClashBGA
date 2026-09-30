# Border Clash — Card Effects (EN reference for BGA)

> **Instruction for Claude Code**
> - Naming follows `docs/GLOSSARY.md`. Card keys (`TROLL`, `DEALER`…) are the same as in the glossary.
> - The **EN text** column is the player-facing string (tooltip / card text). Wrap it in `clienttranslate()` / `_()`. This is the authoritative wording — do not reintroduce French text in the code.
> - Icons inside texts use the placeholders from §1, replaced in JS by icon `<span>`s.
> - Each card effect is built only from the **atomic effects** in §2. Card logic lives in one handler per card key, e.g. `resolveEffect_TROLL()`.

---

## 1. Icon placeholders

| Placeholder | Meaning |
|---|---|
| `[power]` | Power icon (crossed swords) |
| `[VP]` | Victory points icon (green laurel) |
| `[die]` | "Roll the die" icon |
| `[gold_token]` | Gold token |
| `[token_minus_X]` | Gamblers token, minus side, value X |
| `[token_plus_X]` | Gamblers token, plus side, value X |
| `[bronze]` / `[silver]` / `[gold]` | Rank label |
| `[enraged]` / `[calm]` | Rage state label |
| `[on_border]` / `[in_all_cases]` | Condition label |

### Gamblers token types (double-sided, minus / plus)

Read from the cards. **Check the physical token count per type before coding the supply.**

| Token type | Minus side | Plus side | Used by |
|---|---|---|---|
| `GT_1_1` | −1 | +1 | High roller |
| `GT_2_4` | −2 | +4 | Bookie |
| `GT_3_3` | −3 | +3 | Dealer |
| `GT_4_8` | −4 | +8 | Mad Dice |

Die rule shared by all these cards: **1 or 2 → minus side, 3 or more → plus side.**

## 2. Atomic effects (building blocks)

| Code identifier | EN wording on cards | Notes |
|---|---|---|
| `gainPower(x)` | Gain +X [power] | Only counts on a border (center does not fight) |
| `gainVP(x)` | Gain +X [VP] | Awarded immediately (game-end score), unlike power — not border-restricted |
| `addStrengthToPower(card)` | Add the strength of … to your power | Uses printed strength |
| `addDieValueToPower()` | Add the value of the die to your power | Current die face |
| `placeGoldToken(card)` | Place a [gold_token] token on … | Card now counts as Gold |
| `rollDie()` | Roll the die | |
| `placeGamblerToken(card, type)` | Place a token on … • 1 or 2 : … • 3 or more : … | Rolls the die, then places token on the right side |
| `gatherGamblerTokens(scope)` | Place on this card all the … tokens from … | scope = `grid` or `row_and_column` |
| `flipTokensPlusSide(card)` | … then place them face up | "Face up" = plus side |
| `chargeGem(n)` | Charge N gem(s) | Allowed at 3/3, no gain |
| `dischargeGem(n)` | Discharge a gem | Cost: requires a charged gem |
| `dischargeAllGems()` | Discharge all your gems | Returns count |
| `flipRage()` | Flip your Rage marker | |
| `flipFaceDown(card)` | Flip … face down | Card loses tokens, rank, family, trait |
| `countCards(scope, filter)` | for each card … in … | scope = `row` / `column` / `grid` |
| `countTokens(scope)` | for each token on … | All token types |

### Condition keywords

| Code identifier | EN |
|---|---|
| `ON_BORDER` | On a border |
| `IN_ALL_CASES` | In all cases |
| `ENRAGED` | Enraged |
| `CALM` | Calm |
| `IF` | If … |
| `STRICTLY` | (strictly) → `>` |

## 3. Card effects

### Bronze

| Key | EN name | EN text | Atomic effects |
|---|---|---|---|
| `HIGH_ROLLER` | High roller | Place a token on this card. • 1 or 2 : [token_minus_1] token • 3 or more : [token_plus_1] token | `placeGamblerToken(self, GT_1_1)` |
| `AMATEUR` | Amateur | [on_border] Charge one gem for each trait in common with the rival card. | `ON_BORDER` → `chargeGem(sharedTraits(rival))` — traits = family + trait |
| `CABIN_BOY` | Cabin boy | Place a [gold_token] token on this card. | `placeGoldToken(self)` |
| `FREEBOOTER` | Freebooter | [on_border] Flip this card face down to charge 2 gems. | `ON_BORDER` → `flipFaceDown(self)` then `chargeGem(2)` |
| `BERSERKER` | Berserker | If this card has the highest strength in this column (strictly), charge 1 gem. | `IF` strength > all others in column → `chargeGem(1)` |
| `TROLL` | Troll | [enraged] Gain +2 [power]. [in_all_cases] Flip your Rage marker. | `ENRAGED` → `gainPower(2)`; `IN_ALL_CASES` → `flipRage()` |

### Silver

| Key | EN name | EN text | Atomic effects |
|---|---|---|---|
| `BARBARIAN` | Barbarian | [enraged] Gain +1 [power] for each card in your grid with the Impact trait. [in_all_cases] Flip your Rage marker. | `ENRAGED` → `gainPower(countCards(grid, IMPACT))`; `IN_ALL_CASES` → `flipRage()` |
| `GOON` | Goon | [on_border] Discharge a gem to gain +4 [power]. | `ON_BORDER` → cost `dischargeGem(1)` → `gainPower(4)` |
| `DEFENDER` | The Defender | [calm] Add the rival card's strength to your power. [in_all_cases] Flip your Rage marker. | `CALM` → `addStrengthToPower(rival)`; `IN_ALL_CASES` → `flipRage()` |
| `WEREWOLF` | Werewolf | [enraged] Gain +3 [VP]. | `ENRAGED` → `gainVP(3)` |
| `MERCENARY` | Mercenary | [enraged] Gain +4 [power]. [calm] Flip your Rage marker. | `ENRAGED` → `gainPower(4)`; `CALM` → `flipRage()` |
| `BOUNCER` | Bouncer | Gain +6 [power] if the rival card has a strength strictly greater than 2. | `IF` rival.strength > 2 → `gainPower(6)` |
| `BOOKIE` | Bookie | Place a token on the card on your right border. • 1 or 2 : [token_minus_2] token • 3 or more : [token_plus_4] token | `placeGamblerToken(rightBorderCard, GT_2_4)` |
| `LUCKY_DOG` | Lucky dog | Add the value of the die to your power. | `addDieValueToPower()` |
| `ACCOMPLICE` | Accomplice | Gain +1 [power] for each token on your grid. | `gainPower(countTokens(grid))` |
| `DEALER` | Dealer | Place a token on this card. • 1 or 2 : [token_minus_3] token • 3 or more : [token_plus_3] token | `placeGamblerToken(self, GT_3_3)` |
| `BENEFACTOR` | Benefactor | Charge a gem. Gain +2 [power] for each of your charged gems. | `chargeGem(1)` then `gainPower(2 × chargedGems)` |
| `CHEATER` | Cheater | Place on this card all the [token_plus] and [token_minus] tokens from this row and this column, then place them [token_plus] face up. | `gatherGamblerTokens(row_and_column)` → `flipTokensPlusSide(self)` |
| `BOMBARDIER` | Bombardier | [on_border] Flip face down the card underneath this one. If it's a card: [gold], gain +5 [power]; [silver], gain +3 [power]; [bronze], gain +1 [power]. | `ON_BORDER` → read rank of `card_below`, `flipFaceDown(card_below)`, `gainPower(5/3/1)` |
| `NAVIGATOR` | Navigator | Place a [gold_token] token on the two cards at your borders of this row. | `placeGoldToken(leftCard)`, `placeGoldToken(rightCard)` |
| `RAIDER` | Raider | If you have a [gold] card in your grid, charge 2 gems. | `IF` countCards(grid, GOLD) ≥ 1 → `chargeGem(2)` |
| `FIRST_MATE` | First Mate | Gain +3 [power] for each [gold] card in this column. | `gainPower(3 × countCards(column, GOLD))` |
| `LOOKOUT` | Lookout | Gain +5 [power] if the rival card is [gold]. | `IF` rival is GOLD → `gainPower(5)` |
| `BUCCANEER` | Buccaneer | Gain +5 [power] if you don't have any [bronze] card in this column. | `IF` countCards(column, BRONZE) = 0 → `gainPower(5)` |

### Gold

| Key | EN name | EN text | Atomic effects |
|---|---|---|---|
| `BRUNHILDE` | Brunhilde | Add the strength of the other cards in this column to your power. | `addStrengthToPower(otherCards(column))` |
| `GOLIATH` | Goliath | [enraged] Gain +8 [power]. [in_all_cases] Flip your Rage marker. | `ENRAGED` → `gainPower(8)`; `IN_ALL_CASES` → `flipRage()` |
| `SHOCK_FANG` | Shock Fang | Discharge all your gems and gain +4 [power] per gem discharged by this effect. | `n = dischargeAllGems()` → `gainPower(4 × n)` |
| `CRAZY_SIX` | Crazy 6 | Roll the die for each token on your grid. For each 6 rolled, gain +6 [power]. | loop `countTokens(grid)` × `rollDie()` → `gainPower(6)` per 6 |
| `MAD_DICE` | Mad Dice | Place a token on this card. • 1 or 2 : [token_minus_4] token • 3 or more : [token_plus_8] token | `placeGamblerToken(self, GT_4_8)` |
| `POKER_FACE` | Poker Face | Place on this card all the [token_plus] and [token_minus] tokens from your grid, then place them [token_plus] face up. | `gatherGamblerTokens(grid)` → `flipTokensPlusSide(self)` |
| `DAVY_JONES` | Davy Jones | Gain +4 [power] for each other [gold] card in this row and this column. | `gainPower(4 × countCards(row + column, GOLD, excludeSelf))` |
| `FLYING_DUTCHMAN` | Flying Dutchman | Flip face down all the other [gold] cards in your grid. Gain +3 [power] per card flipped face down by this effect. | `n = flipFaceDown(otherCards(grid, GOLD))` → `gainPower(3 × n)` |
| `LADY_FORTUNE` | Lady Fortune | Gain +1 [VP] for each [gold] card in your grid. | `gainVP(countCards(grid, GOLD))` |

## 4. Wording normalised vs printed EN cards

| Card | Printed | Used here |
|---|---|---|
| Bouncer | opposing card | rival card |
| Bookie | 3 or plus | 3 or more |
| Flying Dutchman | Turn face down all the other Gold card on your grid | Flip face down all the other Gold cards in your grid |
| Bombardier | Gain +5 (capitalised mid-sentence) | gain +5 |
| Accomplice, Crazy 6, Lady Fortune | on your grid | in your grid |
| Dealer | "• Place a token…" (stray bullet) | Place a token… |

## 5. Points to confirm (rules ambiguities for the code)

- **Davy Jones**: a Gold card that sits in both the row and the column cannot exist (only the card itself is at the intersection), so no double counting. Confirm "Gold" includes cards with a [gold_token].
- **Lucky dog**: "value of the die" = last rolled value of the shared die, even if rolled by another player this turn?
- **Crazy 6 / Accomplice**: "each token" includes [gold_token] tokens (rulebook: unspecified tokens = all tokens).
- **Amateur**: "trait in common" counts family + trait (the reminder text says "Gambler or Mastery"), max 2 gems.
