# Objectif de ce fichier.

Ce fichier a pour but de générer l'architecture pour un nouveau projet de jeu pour BGA, afin de créer les .md dont tu auras besoin pour travailler ensuite.
Voici ce qui est présent dans ce fichier :
- Les règles du jeu
- Le contenu (liste des composants du jeu incluant les effets)
- Les assets graphiques, c'est-à-dire l'ensemble des fichiers images qui servent à BGA avec le détail des positions.


Voici les différentes étapes :
1. Aider à compléter ce fichier
2. Ecrire le PLAN.md pour la séquence de code à créer
3. Ecrire le CLAUDE.md qui servira de référence
4. Versionner ce fichier pour le faire évoluer en fonction de ce qui aura réellement été fait lors des étapes de code. (afin d'adapter CLAUDE.md)



# Règles du jeu

> Auteurs : Yoël Sayada et Frédéric Martinez — Illustrateur : Gaël Lannurien

---

## Informations générales

- 1 à 4 joueurs
- 10 ans et plus
- 30 minutes

---

## Matériel

- **78 cartes**
  - 24 cartes « Bronze »
  - 36 cartes « Argent »
  - 18 cartes « Or »
- 3 supports de pioche (Or, Argent, Bronze)
- 4 plateaux joueurs
- 12 gemmes de 4 couleurs différentes (recto coloré, verso décoloré)
- 8 cubes compte-point (4 couleurs) — 1 pour les dizaines, 1 pour les unités par joueur
- 1 marqueur ordre du tour
- 1 cube compteur de manche
- 1 dé
- 10 jetons Flambeurs
- 16 jetons Pirates
- 4 marqueurs Rage

---

## But du jeu

Le jeu se déroule en **4 manches de 3 tours**. À chaque tour, chaque joueur pioche 3 cartes et les déploie : une au centre et deux aux frontières avec ses voisins.

À chaque nouveau tour, 3 cartes sont placées en une nouvelle ligne au-dessus de la précédente, jusqu'à former une grille 3×3 à la fin du 3e tour.

À chaque fin de manche, les cartes de la colonne centrale non combattantes peuvent être échangées contre des cartes de rang supérieur.

---

## Mise en place

1. Chaque joueur prend :
   - un plateau de sa couleur
   - 2 cubes de sa couleur, placés sur 0
   - 3 gemmes de sa couleur (1 chargée face colorée, 2 déchargées face grise)
2. Mélangez les pioches « Or » et « Argent » et placez-les face cachées sur leurs supports.
3. Parmi les cartes Bronze, donnez un exemplaire de chaque carte différente à chaque joueur (6 cartes par joueur). Les éventuelles cartes restantes sont placées sur leur support.
4. Chaque joueur pioche 3 cartes Argent, en garde 1 et passe les 2 autres à son voisin de gauche. Chaque joueur garde alors 1 des 2 cartes reçues et donne la dernière à son voisin de gauche.
5. Déterminez aléatoirement le premier joueur et placez le marqueur ordre du tour entre lui et son voisin de gauche.
6. Placez le cube compteur de manche sur le marqueur ordre du tour en position 1.
7. Chaque joueur mélange sa pioche.

### Mise en place spécifique à la boîte « Crapules »

1. Chaque joueur prend un marqueur Rage et le place face « Calme ».
2. Placez le dé et les jetons Flambeurs au centre de la table.
3. Placez les jetons Pirates au centre de la table.

---

## Déroulé d'une manche

> **Règle importante** : tous les effets des cartes sont obligatoires. Une fois les cartes déployées, la résolution est automatique — aucun choix n'est possible.

### 1. Déploiement

a. Simultanément, tous les joueurs piochent 3 cartes et les consultent.

> **MULLIGAN** : avant de placer les cartes, un joueur peut décharger une gemme pour placer une carte de sa main sous sa pioche et en piocher une nouvelle. Cette action peut être répétée tant que le joueur a des gemmes chargées disponibles.

b. Chaque joueur place ses 3 cartes face cachée : une au centre, une à chaque frontière avec ses voisins.

c. Lorsque tous les joueurs sont prêts, toutes les cartes sont révélées simultanément.

### 2. Influence

Chaque joueur résout simultanément les effets de sa **carte centrale** et les applique.

### 3. Combat

Le premier combat a lieu à l'emplacement du marqueur ordre du tour, entre la carte de droite du premier joueur et la carte de gauche du second.

**a. Résolution des effets**

En commençant par le joueur de gauche (premier joueur), chaque joueur lit et résout sa carte de combat.

**b. Résolution du combat**

Chaque joueur calcule la force totale de sa carte (force de base + effets + jetons éventuels).

Le joueur avec le total le plus élevé remporte le combat et marque **autant de points que la différence** entre les deux forces totales.

Le combat suivant est résolu dans le sens antihoraire : le deuxième joueur fait s'affronter sa carte de droite avec la carte de gauche du joueur suivant, et ainsi de suite.

Une fois tous les combats résolus, un nouveau tour commence (retour à l'étape 1. Déploiement). Les nouvelles cartes sont placées au-dessus des précédentes. Seuls les combats des nouvelles cartes révélées sont résolus.

**La manche prend fin après le dernier combat du 3e tour** (9 cartes révélées par joueur).

---

## Amélioration (entre les manches)

Cette phase n'a pas lieu après la 4e manche. Elle est simultanée pour tous les joueurs.

### 1. Épuisement des cartes au combat

- Tous les jetons présents sur des cartes sont remis au centre de la table.
- Toutes les cartes aux frontières sont retournées face cachée. Elles ne peuvent être ni améliorées, ni utilisées pour charger des gemmes.

### 2. Amélioration ou production

Pour chaque carte **face visible** de votre grille, choisissez :

**a. Production** : retournez la carte face cachée pour charger une gemme.

**b. Amélioration** :
1. Déchargez une gemme, puis placez la carte sous sa pioche d'origine (Bronze ou Argent).
2. Piochez 3 cartes du rang supérieur (Argent si vous avez retiré une Bronze ; Or si vous avez retiré une Argent ou Or — une carte Or peut être remplacée par une autre carte Or).
3. Gardez 1 carte face cachée à l'emplacement libéré ; replacez les 2 autres sous leur pioche.

Une fois toutes les améliorations et productions terminées, chaque joueur récupère ses 9 cartes, les mélange et forme sa nouvelle pioche. La nouvelle manche débute.

> L'amélioration est secrète — les autres joueurs n'ont pas connaissance des cartes améliorées.

---

## Fin de partie

La partie se termine à la fin de la **4e manche**.

Le joueur ayant le plus de points l'emporte.

En cas d'égalité, le joueur avec le plus de **gemmes chargées** l'emporte.

---

## Familles et règles spécifiques (boîte Crapules)

La boîte Crapules comprend 3 familles : **Brutes**, **Flambeurs** et **Pirates**.

### Brutes

- **Mise en place** : chaque joueur prend un marqueur Rage et le place face « Calme ».
- Les Brutes jouent sur une force élevée, pouvant être renforcée par l'état Enragé.

### Flambeurs

- **Mise en place** : placez le dé et les jetons Flambeurs au centre de la table.
- L'icône [lancé de dé] indique de lancer le dé et d'appliquer l'effet correspondant au résultat.

### Pirates

- **Mise en place** : placez les jetons Or au centre de la table.
- Une carte possédant un jeton Or est considérée comme une carte « Or » (et non son rang de base).

---

## La règle d'or

- En cas de conflit entre les règles écrites et les effets des cartes, **les effets des cartes priment**.
- En cas de conflit de résolution entre joueurs, **l'ordre du tour** définit la priorité (sens antihoraire à partir du premier joueur).
- Les effets sont **obligatoires** et doivent être réalisés tant que possible.
- Un effet nécessitant un prérequis ne s'applique que si ce prérequis est entièrement rempli.

---

## FAQ — Cas particuliers

- **Force** : désigne toujours la valeur imprimée sur la carte, pas le résultat après bonus.
- **Emplacement suivant/précédent** : désigne une colonne. L'emplacement suivant du 3e tour n'existe pas (ne placez pas l'élément). L'emplacement précédent du 1er tour n'existe pas non plus (l'effet ne se résout pas).
- **Comparaisons** : toujours strictes. « Force supérieure à 2 » ne s'applique pas si la force est exactement 2.
- **Effets « Après le combat »** : résolus après la distribution des points.

---

## Mélange de boîtes

Border Clash se décline en plusieurs jeux indépendants, mais les boîtes sont combinables.

À chaque partie, **3 familles seulement** sont jouables. Constituez les pioches Bronze, Argent et Or avec ces trois familles. La mise en place spécifique de chaque famille choisie s'applique.

---

## Règle solo

### Mise en place du bot

Donnez 6 cartes Bronze différentes au bot. Selon la difficulté, remplacez certaines cartes Bronze par des cartes Argent aléatoires :

| Difficulté | Composition du paquet bot         |
|------------|-----------------------------------|
| Facile     | 6 cartes Bronze                   |
| Moyen      | 4 cartes Bronze + 2 cartes Argent |
| Difficile  | 2 cartes Bronze + 4 cartes Argent |
| Extrême    | 6 cartes Argent                   |

- Choisissez une couleur pour le bot et placez ses points à 0.
- Le bot bénéficie des mises en place spécifiques applicables.
- **Le bot n'a pas de gemmes.**

### Mise en place du joueur

Identique à la mise en place multijoueur, sauf pour les cartes Argent initiales : le joueur pioche **5 cartes Argent**, en choisit **3** à ajouter à son paquet, et remet les 2 autres sous la pioche Argent.

### Déroulement

La partie se déroule en 4 manches. Pour l'emporter, le joueur doit avoir **strictement plus de points** que le bot.

Au début de chaque manche, distribuez les cartes du bot face cachée : une colonne de 3 cartes à gauche de votre grille, une colonne de 3 cartes à droite.

Différences avec le multijoueur :
- Votre carte centrale est résolue **en premier** pour chaque ligne.
- La résolution se fait toujours **de gauche à droite**. Le premier combat est celui de votre frontière gauche, et la carte de gauche (celle du bot) est toujours résolue en premier.
- La **force et les effets bot** sont indiqués en bas à droite de la carte (ne pas considérer la force habituelle en haut à gauche).
  - Force en **bleu**.
  - Icône **Éclair** = l'effet doit être lu et résolu.
  - Pas d'icône Éclair = l'effet ne s'applique pas.

### Amélioration du bot (fin de manche)

Mélangez les 6 cartes du bot et piochez-en 2 au hasard. Si l'une est Or, piochez une autre jusqu'à avoir 2 cartes Bronze ou Argent. Remettez-les sous leur paquet de rang et remplacez-les par une carte de rang supérieur piochée au hasard.









# Game Components & Card List

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


# Assets graphiques

All assets go in `app/img/`. PNG sprites for cards, gems, components, boards.

---

## Sprite sheet summary

| File                       | Grid       | Cell size (native 2×) | Total size (native 2×) | Display size | 
| -------------------------- | ---------- | --------------------- | ---------------------- | ------------ | 
| `cards_scoundrels.png`     | 12 × 3     | 334 × 238 px          | 4008 × 714 px          | 167 × 119 px | 
| `gems.png`                 | 4 × 2      | 300 × 300 px          | 1200 × 600 px          | 40 × 40 px   | 
| `components_scoundrels.png`| 12 × 2     | 300 × 300 px          | 3600 × 600 px          | TBC          | 
| `boards.png`               | 7 × 1      | 900 × 600 px          | 6300 × 600 px          | TBC          | 

> Cards are delivered at **2× display size** (retina). CSS uses `background-size: 1547px 501px`
> to scale the 3094 × 1002 native sprite down to the 119 × 167 display size.

---

## `cards_scoundrels.png` — 13 columns × 3 rows

Each cell = one unique card face (300 × 222 px). Columns are shared across all three rows.

| Col | Content                                       | Rank   |
| --- | --------------------------------------------- | ------ |
| 1   | Family bronze design 1  (4 copies in game)    | Bronze |
| 2   | Family bronze design 2  (4 copies in game)    | Bronze |
| 3   | Family silver design 1  (2 copies in game)    | Silver |
| 4   | Family silver design 2  (2 copies in game)    | Silver |
| 5   | Family silver design 3  (2 copies in game)    | Silver |
| 6   | Family silver design 4  (2 copies in game)    | Silver |
| 7   | Family silver design 5  (2 copies in game)    | Silver |
| 8   | Family silver design 6  (2 copies in game)    | Silver |
| 9   | Family gold design 1    (2 copies in game)    | Gold   |
| 10  | Family gold design 2    (2 copies in game)    | Gold   |
| 11  | Family gold design 3    (2 copies in game)    | Gold   |
| 12  | Card back               (same for all rows)   | —      |

| Row | Family  |
| --- | ------- |
| 1   | Gambler (Flambeur) |
| 2   | Brute              |
| 3   | Pirate             |


### DB card counts

| Rank   | Designs | Copies | Total cards |
| ------ | ------- | ------ | ----------- |
| Bronze | 6 (2 × 3 families) | 4 | 24 |
| Silver | 18 (6 × 3 families) | 2 | 36 |
| Gold   | 9 (3 × 3 families)  | 2 | 18 |

Each player starts with 1 copy of each of the 6 bronze designs (6 cards) + 2 silver cards from the draft = 8 cards in their starting deck.

### CSS sprite formula

Display size: **167 × 119 px** per card (landscape). Native sprite cells: **334 × 238 px** (2× retina).

```css
.bc-card-sprite {
  background-image: url('img/cards_scoundrels.png');
  background-size: 2004px 357px;   /* 12 × 167, 3 × 119 */
  background-repeat: no-repeat;
}
```

Position for a card with `family` (1–3) and column `C` (0-indexed):
```
background-position-x: -(C * 167) px
background-position-y: -((family - 1) * 119) px
```

Column `C` from game data (`type` = rank 1/2/3, `type_arg` = global design number):
```
Bronze (type=1): C = (type_arg - 1) % 2          → 0, 1
Silver (type=2): C = 2 + (type_arg - 1) % 6      → 2 … 7
Gold   (type=3): C = 8 + (type_arg - 1) % 3      → 8, 9, 10
Back (face-down): C = 11                           → 11
```

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




# Règles fonctionnelles


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






