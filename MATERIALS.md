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

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 1 | Amateur | 4 | 2 | Flambeur. Arcane. | Lancez le dé. Ajoutez un jeton sur l'emplacement suivant : 1–2 → jeton −1 / 3+ → jeton +1 | 2 + effet |
| 2 | Parieur | 4 | 2 | Flambeur. Maîtrise. | Si cette carte partage un trait avec la carte rivale, chargez une gemme. (Traits : Flambeur ou Maîtrise) | 3 |

### Silver (card_type=2)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 1 | Bookmaker | 2 | 3 | Flambeur. Arcane. | Lancez le dé. Ajoutez un jeton sur l'emplacement suivant : 1–2 → jeton −2 / 3+ → jeton +4 | 4 + effet |
| 2 | Croupier | 2 | 2 | Flambeur. Impact. | Gagnez +1 Force pour chacune de vos cartes avec le trait Impact. | 5 |
| 3 | Pièce | 2 | 3 | Flambeur. Arcane. | Lancez le dé. Ajoutez un jeton sur **cette carte** : 1–2 → jeton −3 / 3+ → jeton +3 | 4 + effet |
| 4 | Tricheur | 2 | 0 | Flambeur. Impact. | Chargez une gemme. Gagnez +2 Force pour chacune de vos gemmes chargées. | 6 |
| 5 | Mécène | 2 | 3 | Flambeur. Maîtrise. | Placez tous vos jetons [token_plus] et [token_minus] de cette colonne sur cette carte, puis retournez-les face [token_plus]. | 7 |
| 6 | Complice | 2 | 1 | Flambeur. Impact. | Lancez le dé. Gagnez la valeur du dé en force. | 3 + effet |

### Or (card_type=3)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 1 | Jack Jackpot | 2 | 4 | Flambeur. Arcane. | Lancez le dé. 1–2 : jeton −4 sur cette carte. / 3–4 : chargez toutes vos gemmes. / 5–6 : jeton +8 sur cette carte. | 8 |
| 2 | Poker Face | 2 | 2 | Flambeur. Maîtrise. | Placez tous vos jetons [token_plus] et [token_minus] en jeu sur cette carte, puis retournez-les face [token_plus]. | 8 |
| 3 | Double 6 | 2 | 6 | Flambeur. Impact. | Après le combat : le vainqueur lance le dé et ajoute sa valeur à ses points de victoire. | 7 + effet |

---

## Card List — Family: Brute

### Bronze (card_type=1)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 3 | Troll | 4 | 1 | Brute. Impact. | Enragé : +2 Force. Dans tous les cas : retournez votre marqueur Rage. (S'applique au centre et en frontière) | 2 + effet |
| 4 | Gros-bras | 4 | 3 | Brute. Maîtrise. | Si cette carte a la plus grande force de cette colonne, chargez 1 gemme. (force = valeur imprimée) | 4 |

### Silver (card_type=2)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 7 | Mercenaire | 2 | 2 | Brute. Impact. | Enragé : +3 Force. / Calme : retournez votre marqueur Rage. | 3 + effet |
| 8 | Grizzly | 2 | 3 | Brute. Impact. | Sur une frontière : déchargez une gemme pour gagner +5 Force. Dans tous les cas : retournez votre marqueur Rage. | 6 |
| 9 | Videur | 2 | 2 | Brute. Impact. | Gagnez +4 Force si la carte rivale a une force **strictement supérieure** à 2. Calme : retournez votre marqueur Rage. | 3 + effet |
| 10 | Berserker | 2 | 3 | Brute. Impact. | Calme : gagnez autant de force que la force de la carte rivale. | 4 + effet |
| 11 | Loup-Garou | 2 | 3 | Brute. Maîtrise. | Enragé : gagnez 2 points de victoire. Dans tous les cas : retournez votre marqueur Rage. | 7 |
| 12 | Barbare | 2 | 3 | Brute. Impact. | Enragé : +1 Force pour chacune de vos cartes avec le trait Impact. | 7 |

### Or (card_type=3)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 4 | Brunhilde | 2 | 4 | Brute. Maîtrise. | Enragé : ajoutez la force de vos autres cartes de cette colonne. Dans tous les cas : retournez votre marqueur Rage. | 9 |
| 5 | Goliath | 2 | 5 | Brute. Impact. | Enragé : déchargez toutes vos gemmes et gagnez +3 Force par gemme déchargée par cet effet. | 9 |
| 6 | Shockfang | 2 | 2 | Brute. Impact. | Enragé : +8 Force. Dans tous les cas : retournez votre marqueur Rage. | 4 + effet |

---

## Card List — Family: Pirate

### Bronze (card_type=1)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 5 | Mousse | 4 | 2 | Pirate. Énergie. | Sur une frontière : retournez cette carte face cachée pour charger 2 gemmes. (Une carte face cachée a une force de 0, et son rang/traits ne comptent plus pour aucun effet) | 3 |
| 6 | Quartier-Maître | 4 | 1 | Pirate. Arcane. | Ajoutez un [token_gold] sur cette carte. ([token_gold] : cette carte est désormais considérée comme une carte Or) | 3 + effet |

### Silver (card_type=2)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 13 | Pillard | 2 | 4 | Pirate. Maîtrise. | Si vous avez une carte Or en jeu, chargez 2 gemmes. | 6 |
| 14 | Second | 2 | 2 | Pirate. Impact. | Gagnez +3 Force pour chaque carte Or dans cette colonne. | 4 + effet |
| 15 | Boucanier | 2 | 3 | Pirate. Impact. | Gagnez +3 Force si vous n'avez aucune carte Bronze en jeu. | 4 + effet |
| 16 | Artificier | 2 | 3 | Pirate. Maîtrise. | Si la carte de l'emplacement précédent est Or, gagnez sa force. | 5 + effet |
| 17 | Vigie | 2 | 4 | Pirate. Impact. | Gagnez +4 Force si la carte rivale est Or. | 4 + effet |
| 18 | Navigateur | 2 | 4 | Pirate. Arcane. | Ajoutez un [token_gold] sur cette carte et un [token_gold] sur l'emplacement suivant. | 5 + effet |

### Or (card_type=3)

| design | Nom | Copies | Force | Traits | Effet | Force Solo |
|--------|-----|--------|-------|--------|-------|------------|
| 7 | Hollandais Volant | 2 | 0 | Pirate. Impact. | Retournez face cachée toutes vos autres cartes Or et gagnez +4 Force par carte retournée par cet effet. | 9 |
| 8 | Lady Fortune | 2 | 0 | Pirate. Maîtrise. | Gagnez 2 points de victoire pour chacune de vos cartes Or en jeu. | 4 + effet |
| 9 | Davy Jones | 2 | 2 | Pirate. Impact. | Gagnez +2 Force pour chacune de vos cartes Or en jeu. / Gagnez −1 Force pour chacune de vos cartes Bronze en jeu. | 9 |

---

## Card counts (verification)

| Rank | Flambeur | Brute | Pirate | Total designs | × copies | Total cards |
|------|----------|-------|--------|---------------|----------|-------------|
| Bronze | 2 | 2 | 2 | 6 | × 4 | 24 |
| Silver | 6 | 6 | 6 | 18 | × 2 | 36 |
| Or | 3 | 3 | 3 | 9 | × 2 | 18 |
| **Total** | | | | **33** | | **78** |
