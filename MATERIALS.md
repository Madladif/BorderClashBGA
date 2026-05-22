# MATERIALS.md — Game Components & Card List

---

## Physical Components

| Component | Quantity | Details |
|-----------|----------|---------|
| Cartes Bronze | 24 | 6 designs uniques × 4 exemplaires |
| Cartes Argent | 36 | 18 designs uniques × 2 exemplaires |
| Cartes Or | 18 | 9 designs uniques × 2 exemplaires |
| Supports de pioche | 3 | Or, Argent, Bronze |
| Plateaux joueurs | 4 | Un par couleur |
| Gemmes | 12 | 3 par joueur × 4 couleurs (recto coloré, verso gris) |
| Cubes compte-point | 8 | 2 par joueur (dizaines + unités) × 4 couleurs |
| Marqueur ordre du tour | 1 | |
| Cube compteur de manche | 1 | |
| Dé | 1 | D6 standard |
| Jetons Flambeurs | 10 | Valeurs variables (+/−) |
| Jetons Pirates (Or) | 16 | Confèrent le rang Or à la carte |
| Marqueurs Rage | 4 | Recto Calme / Verso Enragé |

---

## Card Identifier Conventions (code)

In `bc_card`: `card_type` = rank (1=Bronze, 2=Silver, 3=Gold), `card_type_arg` = design number within rank.

### Token icons (used in effect text)

| Placeholder | Signification |
|-------------|--------------|
| `[token_plus]` | Jeton Flambeur positif (vert) — ajoute sa valeur à la force |
| `[token_minus]` | Jeton Flambeur négatif (rouge) — soustrait sa valeur à la force |
| `[token_gold]` | Jeton Or Pirate — la carte est considérée comme Or |
| `[force+N]` | Bonus de force N |
| `[force-N]` | Malus de force N |

---

## Card List — Family: Flambeur (Gambler)

### Bronze (card_type=1)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 1 | Amateur | Amateur | 4 | 2 | Gambler. Arcane. | Roll the die. Add a token to the next position: 1–2 → token −1 / 3+ → token +1 | 2 + effect |
| 2 | Bettor | Parieur | 4 | 2 | Gambler. Mastery. | If this card shares a trait with the rival card, charge a gem. (Traits: Gambler or Mastery) | 3 |

### Silver (card_type=2)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 3 | Bookmaker | Bookmaker | 2 | 3 | Gambler. Arcane. | Roll the die. Add a token to the next position: 1–2 → token −2 / 3+ → token +4 | 4 + effect |
| 4 | Accomplice | Complice | 2 | 2 | Gambler. Impact. | Gain +1 Strength for each of your cards with the Impact trait. | 5 |
| 5 | Dealer | Croupier | 2 | 3 | Gambler. Arcane. | Roll the die. Add a token to **this card**: 1–2 → token −3 / 3+ → token +3 | 4 + effect |
| 6 | Cheater | Tricheur | 2 | 3 | Gambler. Mastery. | Place all your [token_plus] and [token_minus] tokens from this column onto this card, then flip them to [token_plus]. | 6 |
| 7 | Patron | Mécène | 2 | 0 | Gambler. Impact. | Charge a gem. Gain +2 Strength for each of your charged gems. | 7 |
| 8 | The Coin | La Pièce | 2 | 1 | Gambler. Impact. | Roll the die. Gain the die value as strength. | 3 + effect |

### Or (card_type=3)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 9 | Mad Dice | Mad Dice | 2 | 4 | Gambler. Arcane. | Roll the die. 1–2: add token −4 to this card. 3–4: charge all your gems. 5–6: add token +8 to this card. | 8 |
| 10 | Poker Face | Poker Face | 2 | 2 | Gambler. Mastery. | Place all your [token_plus] and [token_minus] tokens in play onto this card, then flip them to [token_plus]. | 8 |
| 11 | Snake | Snake | 2 | 6 | Gambler. Impact. | After combat: the winner rolls the die and adds its value to their victory points. | 7 + effect |

---

## Card List — Family: Brute

### Bronze (card_type=1)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 1 | Troll | Troll | 4 | 1 | Brute. Impact. | Enraged: +2 Strength. In all cases: flip your Rage marker. (Applies at center and border) | 2 + effect |
| 2 | Berserk | Gros-bras | 4 | 3 | Brute. Mastery. | If this card has the highest strength in this column, charge 1 gem. (strength = printed value) | 4 |

### Silver (card_type=2)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 3 | Mercenary | Mercenaire | 2 | 2 | Brute. Impact. | Enraged: +3 Strength. / Calm: flip your Rage marker. | 3 + effect |
| 4 | Muscle Man | Berserk | 2 | 3 | Brute. Impact. | On a border: discharge a gem to gain +5 Strength. In all cases: flip your Rage marker. | 6 |
| 5 | Bouncer | Videur | 2 | 2 | Brute. Impact. | Gain +4 Strength if the rival card has a strength strictly greater than 2. Calm: flip your Rage marker. | 3 + effect |
| 6 | Rampart | Muraille | 2 | 3 | Brute. Impact. | Calm: gain strength equal to the rival card's strength. | 4 + effect |
| 7 | Werewolf | Loup-Garou | 2 | 3 | Brute. Mastery. | Enraged: gain 2 victory points. In all cases: flip your Rage marker. | 7 |
| 8 | Barbarian | Barbare | 2 | 3 | Brute. Impact. | Enraged: +1 Strength for each of your cards with the Impact trait. In all cases: flip your Rage marker. | 7 |

### Or (card_type=3)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 9 | Brunhilde | Brunhilde | 2 | 4 | Brute. Mastery. | Enraged: add the strength of your other cards in this column. In all cases: flip your Rage marker. | 9 |
| 10 | Goliath | Goliath | 2 | 5 | Brute. Impact. | Enraged: discharge all your gems and gain +3 Strength per gem discharged by this effect. | 9 |
| 11 | Shockfang | Shockfang | 2 | 2 | Brute. Impact. | Enraged: +8 Strength. In all cases: flip your Rage marker. | 4 + effect |

---

## Card List — Family: Pirate

### Bronze (card_type=1)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 1 | Cabin Boy | Mousse | 4 | 2 | Pirate. Mastery. | On a border: flip this card face down to charge 2 gems. (A face-down card has strength 0 and its rank/traits no longer count for any effect) | 3 |
| 2 | Freebooter | Flibustier | 4 | 1 | Pirate. Arcane. | Add a [token_gold] to this card. ([token_gold]: this card is now considered a Gold card) | 3 + effect |

### Silver (card_type=2)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 3 | Plunderer | Pillard | 2 | 4 | Pirate. Mastery. | If you have a Gold card in play, charge 2 gems. | 6 |
| 4 | First Mate | Second | 2 | 2 | Pirate. Impact. | Gain +3 Strength for each Gold card in this column. | 4 + effect |
| 5 | Buccaneer | Boucanier | 2 | 3 | Pirate. Impact. | Gain +3 Strength if you have no Bronze card in play. | 4 + effect |
| 6 | Gunner | Artificier | 2 | 2 | Pirate. Mastery. | Flip the previous card. If it is Gold, gain +5 Strength. If Silver, gain +3 Strength. If Bronze, gain +1 Strength. | 5 + effect |
| 7 | Lookout | Vigie | 2 | 4 | Pirate. Impact. | Gain +4 Strength if the rival card is Gold. | 4 + effect |
| 8 | Navigator | Navigateur | 2 | 4 | Pirate. Arcane. | Add a [token_gold] to this card and a [token_gold] to the next position. | 5 + effect |

### Or (card_type=3)

| design | Nom EN | Nom FR | Copies | Force | Traits | Effet | Force Solo |
|--------|--------|--------|--------|-------|--------|-------|------------|
| 9 | Flying Dutchman | Hollandais Volant | 2 | 0 | Pirate. Impact. | Flip all your other Gold cards face down and gain +4 Strength per card flipped by this effect. | 9 |
| 10 | Lady Fortune | Lady Fortune | 2 | 0 | Pirate. Mastery. | Gain 2 victory points for each of your Gold cards in play. | 4 + effect |
| 11 | Davy Jones | Davy Jones | 2 | 2 | Pirate. Impact. | Gain +2 Strength for each of your Gold cards in play. / Gain −1 Strength for each of your Bronze cards in play. | 9 |

---

## Card counts (verification)

| Rank | Flambeur | Brute | Pirate | Total designs | × copies | Total cards |
|------|----------|-------|--------|---------------|----------|-------------|
| Bronze | 2 | 2 | 2 | 6 | × 4 | 24 |
| Silver | 6 | 6 | 6 | 18 | × 2 | 36 |
| Or | 3 | 3 | 3 | 9 | × 2 | 18 |
| **Total** | | | | **33** | | **78** |
