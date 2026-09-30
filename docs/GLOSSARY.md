# Border Clash — BGA Glossary (FR → EN → code)

> **Instruction for Claude Code**
> - All code identifiers (variables, constants, DB columns, state names, action names, CSS classes, notification names) MUST use the **Code identifier** column below. Never invent a synonym.
> - All player-facing strings are written in **English** (source language) and wrapped in `clienttranslate()` (PHP) or `_()` (JS). The French text is entered later in the BGA translation tool — never hardcode French in the code.
> - Use the **EN term** column for player-facing strings (logs, tooltips, buttons).
> - Source of truth: official EN rulebook + EN card sheet (Scoundrels box). Where the EN material is inconsistent, the choice made here wins (see §9).

---

## 1. Game structure

| FR | EN term (UI) | Code identifier | Notes |
|---|---|---|---|
| Partie | Game | `game` | |
| Manche | Round | `round` | 4 rounds per game |
| Tour | Turn | `turn` | 3 turns per round |
| Tuile Manche | Round tile | `round_tile` | UI display only |
| Mise en place | Setup | `setup` | |
| Déploiement | Deployment | `deployment` | Phase 1 of a turn |
| Deuxième chance | Second chance | `second_chance` | Discharge a gem to redraw a card |
| Révéler | Reveal | `reveal` | |
| Ordre de résolution | Resolution order | `resolution` | left → center → right |
| Résoudre | Resolve | `resolve` | |
| Points de victoire (PV) | Victory points (VP) | `vp` | Stored in `player_score` (BGA native) |
| Phase d'amélioration | Upgrade phase | `upgrade_phase` | End of round |
| Épuisement des cartes au combat | Exhaust cards in combat | `exhaust` | Border cards flipped face down |
| Amélioration | Upgrade | `upgrade` | Discharge 1 gem, swap for next rank |
| Production | Production | `production` | Flip card face down to charge 1 gem |
| Fin de manche | End of round | `round_end` | |
| Fin de partie | End of game | `game_end` | Tiebreaker: charged gems → `player_score_aux` |
| Égalité | Tie | `tie` | |

## 2. Grid & positions

| FR | EN term (UI) | Code identifier | Notes |
|---|---|---|---|
| Grille (3×3) | Grid | `grid` | |
| Ligne | Row | `row` | 3 cards played in the same turn (0–2) |
| Colonne | Column | `column` / `col` | Same slot across the turns of a round |
| Gauche / Centre / Droite | Left / Center / Right | `LEFT` / `CENTER` / `RIGHT` | Constants 0 / 1 / 2 |
| Frontière | Border | `border` | Shared between 2 neighbours |
| Carte centrale | Central card | `center_card` | Does not fight |
| Carte rivale | Rival card | `rival_card` | Card on the other side of the same border, same turn |
| Voisin de gauche / droite | Left / right neighbor | `left_neighbor` / `right_neighbor` | US spelling |
| Carte en dessous | Card underneath | `card_below` | Same column, previous row |

## 3. Cards

| FR | EN term (UI) | Code identifier | Notes |
|---|---|---|---|
| Carte | Card | `card` | |
| Rang | Rank | `rank` | |
| Bronze / Argent / Or | Bronze / Silver / Gold | `BRONZE` / `SILVER` / `GOLD` | Constants 1 / 2 / 3 |
| Famille | Family | `family` | Rulebook intro says "gangs": do not use |
| Trait | Trait | `trait` | |
| Force | Strength | `strength` | Printed value (never modified) |
| Puissance | Power | `power` | Strength + effects + tokens, 0–20 |
| Effet | Effect | `effect` | |
| Texte d'ambiance | Flavor text | `flavor_text` | Silver & Gold only |
| Texte de règle | Rules text | `rules_text` | Bronze only |
| Face visible / face cachée | Face up / face down | `face_up` / `face_down` | Face-down card = no rank, family, trait, effect; power 0 |
| Retourner (face cachée) | Flip face down | `flipFaceDown()` | Use "flip" everywhere (see §9) |
| Paquet (9 cartes du joueur) | Deck | `deck` | BGA Deck location |
| Pioche (paquet du joueur) | Draw pile | `deck` | Same location as above |
| Pioche Argent / Or | Silver / Gold draw pile | `silver_deck` / `gold_deck` | Shared supply |
| Support de pioche | Deck holder | — | Physical only |
| Main | Hand | `hand` | |
| Défausser | Discard | `discard` | |
| Retirer du jeu / remettre dans la boîte | Remove from game / back in the box | `removed` | Bronze cards removed on upgrade |

## 4. Families & traits

| FR | EN term (UI) | Code identifier |
|---|---|---|
| Brutes | Brutes | `BRUTE` |
| Flambeurs | Gamblers | `GAMBLER` |
| Pirates | Pirates | `PIRATE` |
| Crapules (nom de la boîte) | Scoundrels | `scoundrels` |
| Arcane | Arcane | `ARCANE` |
| Impact | Impact | `IMPACT` |
| Maîtrise | Mastery | `MASTERY` |

## 5. Components & resources

| FR | EN term (UI) | Code identifier | Notes |
|---|---|---|---|
| Plateau joueur | Player board | `player_board` | |
| Couleur du joueur (Rouge/Vert/Jaune/Bleu) | Red / Green / Yellow / Blue | `red` / `green` / `yellow` / `blue` | |
| Jauge de puissance | Power gauge | `power_gauge` | One per border |
| Compteur de puissance | Power counter | `power_counter` | Not "marker" (see §9) |
| Marqueur de PV | VP marker | `vp_marker` | UI only (BGA score) |
| Gemme | Gem | `gem` | 3 per player |
| Gemme chargée / déchargée | Charged / discharged gem | `charged` / `discharged` | Store as `charged_gems` (int 0–3) |
| Charger / décharger une gemme | Charge / discharge a gem | `chargeGem()` / `dischargeGem()` | Charging at 3/3 is allowed, no gain |
| Marqueur Rage | Rage marker | `rage_marker` | |
| Enragé / Calme | Enraged / Calm | `ENRAGED` / `CALM` | Checked when read |
| Retourner son marqueur Rage | Flip your Rage marker | `flipRage()` | |
| Dé Flambeurs | Gamblers die | `die` | |
| Lancer le dé | Roll the die | `rollDie()` | |
| Jeton Flambeurs | Gamblers token | `gambler_token` | Two-sided: plus / minus |
| Face + / face − | Plus side / minus side | `PLUS` / `MINUS` | |
| Jeton Or | Gold token | `gold_token` | Card with it counts as Gold |
| Jeton (générique) | Token | `token` | "Tokens" alone = all token types |

## 6. Keywords printed on cards

| FR | EN term (UI) | Code identifier |
|---|---|---|
| Sur une frontière | On a border | `ON_BORDER` |
| Dans tous les cas | In all cases | `IN_ALL_CASES` |
| Enragé | Enraged | `ENRAGED` |
| Calme | Calm | `CALM` |
| Gagnez +X | Gain +X | `gainPower(x)` |
| Placez un jeton sur cette carte | Place a token on this card | `placeToken()` |
| (strictement) | (strictly) | `>` (never `>=`) |

## 7. Solo mode

| FR | EN term (UI) | Code identifier | Notes |
|---|---|---|---|
| Mode solo | Solo mode | `solo` | |
| Automa | Automa | `automa` | |
| Valeur violette | Automa strength | `automa_strength` | Replaces printed strength |
| Éclair | Lightning bolt (effect active) | `automa_active` | bool |
| Facile / Moyen / Difficile / Extrême / Folie | Easy / Medium / Hard / Extreme / Madness | `EASY` … `MADNESS` | |
| Amélioration de l'Automa | Automa upgrade | `automa_upgrade` | |

## 8. Card list

`type` = rank, `type_arg` = card key (BGA Deck convention suggestion).

### Bronze (6 per color × 4 colors = 24)

| Key | EN name | FR name | Family | Trait | Str. |
|---|---|---|---|---|---|
| `HIGH_ROLLER` | High roller | Parieur | Gambler | Arcane | 2 |
| `AMATEUR` | Amateur | Amateur | Gambler | Mastery | 2 |
| `CABIN_BOY` | Cabin boy | Mousse | Pirate | Arcane | 2 |
| `FREEBOOTER` | Freebooter | Baroudeur | Pirate | Mastery | 2 |
| `BERSERKER` | Berserker | Berserker | Brute | Mastery | 3 |
| `TROLL` | Troll | Troll | Brute | Impact | 2 |

### Silver (18 cards × 2 = 36)

| Key | EN name | FR name | Family | Trait | Str. |
|---|---|---|---|---|---|
| `BARBARIAN` | Barbarian | Barbare | Brute | Impact | 3 |
| `GOON` | Goon | Gros bras | Brute | Impact | 3 |
| `DEFENDER` | The Defender | Muraille | Brute | Impact | 3 |
| `WEREWOLF` | Werewolf | Loup-Garou | Brute | Mastery | 4 |
| `MERCENARY` | Mercenary | Mercenaire | Brute | Impact | 2 |
| `BOUNCER` | Bouncer | Videur | Brute | Impact | 2 |
| `BOOKIE` | Bookie | Bookmaker | Gambler | Arcane | 3 |
| `LUCKY_DOG` | Lucky dog | Chanceux | Gambler | Impact | 2 |
| `ACCOMPLICE` | Accomplice | Complice | Gambler | Impact | 3 |
| `DEALER` | Dealer | Croupier | Gambler | Arcane | 4 |
| `BENEFACTOR` | Benefactor | Mécène | Gambler | Impact | 0 |
| `CHEATER` | Cheater | Tricheur | Gambler | Mastery | 2 |
| `BOMBARDIER` | Bombardier | Artificier | Pirate | Impact | 3 |
| `NAVIGATOR` | Navigator | Navigateur | Pirate | Arcane | 4 |
| `RAIDER` | Raider | Pillard | Pirate | Mastery | 4 |
| `FIRST_MATE` | First Mate | Second | Pirate | Impact | 2 |
| `LOOKOUT` | Lookout | Vigie | Pirate | Impact | 4 |
| `BUCCANEER` | Buccaneer | Boucanier | Pirate | Impact | 2 |

### Gold (9 cards × 3 = 27)

| Key | EN name | FR name | Family | Trait | Str. |
|---|---|---|---|---|---|
| `BRUNHILDE` | Brunhilde | Brunhilde | Brute | Impact | 3 |
| `GOLIATH` | Goliath | Goliath | Brute | Impact | 5 |
| `SHOCK_FANG` | Shock Fang | Shock Fang | Brute | Impact | 4 |
| `CRAZY_SIX` | Crazy 6 | Crazy 6 | Gambler | Impact | 6 |
| `MAD_DICE` | Mad Dice | Mad Dice | Gambler | Arcane | 6 |
| `POKER_FACE` | Poker Face | Poker Face | Gambler | Mastery | 3 |
| `DAVY_JONES` | Davy Jones | Davy Jones | Pirate | Impact | 2 |
| `FLYING_DUTCHMAN` | Flying Dutchman | Le Hollandais volant | Pirate | Impact | 0 |
| `LADY_FORTUNE` | Lady Fortune | Lady Fortune | Pirate | Mastery | 3 |

> Automa strength / lightning bolt values are not listed here: take them from the card data file.

## 9. Terminology decisions (EN material inconsistencies)

| Seen in EN material | Use in code & UI | Why |
|---|---|---|
| "opposing card" (Bouncer) | **rival card** | Official rules term (Q&A "Rival cards") |
| "Bettor" (rulebook examples) | **High roller** | Card name |
| "on your grid" / "in your grid" | **in your grid** | Majority usage |
| "Turn face down" / "Flip face down" | **Flip face down** | Majority usage |
| "power marker" (p.5) | **power counter** | Components page |
| "Next round" / "a new round begins" (p.6, between turns) | **Next turn** | FR = tour, not manche |
| "3 or plus" (Bookie) | **3 or more** | Typo |
| "all the other Gold card" (Flying Dutchman) | **all the other Gold cards** | Typo |
| "gangs" (intro) | **families** | Rules term |
