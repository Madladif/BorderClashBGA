# Border Clash — Crapules · Spécification des règles pour BGA

> **Source de vérité** : livret de règles Crapules (version imprimée, boîte réf. MEBOCR R01).
> Ce document reformule le livret en règles **atomiques et numérotées** (`R-xx.y`) pour l'implémentation BGA.
> En cas de conflit : **texte des cartes > ce document > ancienne implémentation**.
> Les points marqués **⚠️ OUVERT** ne sont pas tranchés par le livret : ne rien inventer, les remonter à Benjamin.

---

## 0. Conventions

| Terme livret | Identifiant code suggéré | Définition |
|---|---|---|
| Force | `strength` | Valeur imprimée en haut de la carte |
| Puissance | `power` | Force + effets + jetons, bornée 0–20 |
| Frontière | `border` | Limite entre 2 joueurs adjacents, porte une jauge partagée |
| Ligne | `row` (1–3) | Les 3 cartes jouées au même tour |
| Colonne | `col` (`left`/`center`/`right`) | Cartes d'un même emplacement sur la manche |
| Manche | `round` (1–4) | 3 tours + phase d'amélioration |
| Tour | `turn` (1–3) | Déploiement + résolution + PV |
| Rang | `rank` (`bronze`/`silver`/`gold`) | Bronze / Argent / Or |
| Famille | `family` (`brutes`/`flambeurs`/`pirates`) | |
| Gemme chargée / déchargée | `gem charged` | Ressource 0–3 par joueur |
| Cartes rivales | `rival` | Cartes de part et d'autre d'une même frontière au même tour |

---

## 1. Matériel → modèle de données

- **R-1.1** 87 cartes : 24 Bronze (6 par couleur joueur), 36 Argent (2 exemplaires de chaque), 27 Or (3 exemplaires de chaque) → soit 18 Argent distinctes et 9 Or distinctes.
- **R-1.2** Chaque carte possède : nom, rang, famille (icône), force, traits (ex. « Brute – Impact »), texte d'effet, **force Automa** (valeur violette) et **indicateur éclair** (effet activé en solo). Les Bronze ont en plus une couleur joueur.
- **R-1.3** Par joueur : 1 plateau (PV 0–99 via dizaines + unités), 2 compteurs de puissance (faces +0 / +10), 3 gemmes, 1 marqueur Rage (Enragé / Calme).
- **R-1.4** Communs : 4 jauges de puissance (graduées 1 à 10), 4 tuiles Manche, 1 pioche Argent, 1 pioche Or, 1 dé Flambeurs (d6), 11 jetons Flambeurs (double face), 8 jetons Or.
- **R-1.5 (arbitrage)** Valeurs des jetons Flambeurs : données par `docs/cartes.csv` (colonnes `jeton_rouge`/`jeton_vert`), qui fait foi. Parieur −1/+1, Bookmaker −2/+4, Croupier −3/+3, Mad Dice −4/+8. Aucune autre carte n'en porte.
- **R-1.6 (arbitrage)** Résolu par la structure de `docs/cartes.csv` : chaque design Bronze n'a qu'une ligne, avec une colonne `couleurs` listant les 4 couleurs ensemble → les 6 Bronze sont identiques entre couleurs (même effet/force/texte), seule la couleur change (cosmétique, attribution joueur).
- **R-1.7 (arbitrage)** Le matériel est prévu pour que le stock de jetons Or/Flambeurs soit toujours suffisant. Aucune limite à gérer côté implémentation.

> **Données cartes** : le livret ne contient **pas** le texte des 87 cartes. Elles doivent venir d'un fichier séparé (`docs/cartes.csv`). Aucun effet ne doit être codé de mémoire ou déduit.

---

## 2. Topologie de la table

- **R-2.1** Chaque joueur a une grille 3×3 : colonnes gauche / centre / droite, lignes 1 (bas) à 3 (haut).
- **R-2.2** Une jauge de puissance est placée entre chaque paire de joueurs voisins. La carte de **gauche** d'un joueur combat à la frontière avec son **voisin de gauche** ; la carte de **droite** avec son **voisin de droite**. La carte **centrale** ne combat jamais.
- **R-2.3** À 3 et 4 joueurs, la table est circulaire : autant de frontières que de joueurs.
- **R-2.4** Chaque joueur marque sa puissance **de son côté** de la jauge partagée.
- **R-2.5 (arbitrage)** À 2 joueurs : **2 frontières** (frontière gauche J1 ↔ frontière droite J2 ; frontière droite J1 ↔ frontière gauche J2).
- **R-2.6** Solo : voir §10 (l'Automa occupe les deux frontières).

---

## 3. Mise en place

- **R-3.1** Chaque joueur : PV = 0 ; 3 gemmes dont **1 chargée** et 2 déchargées.
- **R-3.2** Tuiles Manche empilées : Manche 1 visible.
- **R-3.3** Pioches Argent et Or mélangées séparément, face cachée.
- **R-3.4** Chaque joueur reçoit les 6 Bronze de sa couleur.
- **R-3.5** **Draft Argent initial** (multijoueur, simultané) :
  1. Chaque joueur pioche 3 Argent, en garde 1, passe les 2 autres à son **voisin de gauche**.
  2. Parmi les 2 reçues, il en garde 1 et passe la dernière à son voisin de gauche.
  3. Il ajoute la dernière reçue à son paquet.
  → Chaque joueur a 6 Bronze + 3 Argent = **9 cartes**, mélangées = sa pioche personnelle.
- **R-3.6** Mise en place de famille (voir §9) : chaque joueur prend un marqueur Rage face **Enragé** ; dé et jetons Flambeurs en réserve ; jetons Or en réserve.

---

## 4. Structure de partie

- **R-4.1** 4 manches × 3 tours.
- **R-4.2** Chaque tour : Déploiement → Résolution → PV → tour suivant.
- **R-4.3** Après le 3ᵉ tour d'une manche : phase d'amélioration (sauf manche 4) puis fin de manche.
- **R-4.4** Il n'y a **pas d'ordre de tour entre joueurs** : tout est simultané. (Anciennes versions : jetons d'ordre de tour → **supprimés**, remplacés par les tuiles Manche.)

---

## 5. Déroulé d'un tour

### 5.1 Déploiement (simultané, multiactif)

- **R-5.1** Chaque joueur pioche 3 cartes de sa pioche personnelle et les consulte.
- **R-5.2** **Deuxième chance** : tant qu'il a une gemme chargée, le joueur peut en décharger une pour placer une carte de sa main **sous** sa pioche et piocher une nouvelle carte. Répétable.
- **R-5.3 (arbitrage)** La deuxième chance (mulligan) est **interdite** au tour 3 (pas seulement inutile).
- **R-5.4** Le joueur place ses 3 cartes, face cachée, sur la nouvelle ligne (gauche / centre / droite). Au tour 2 et 3, la ligne est placée au-dessus de la précédente.
- **R-5.5** Quand tous les joueurs ont validé, toutes les cartes de la ligne sont révélées simultanément.

### 5.2 Résolution (automatique, aucun choix)

- **R-5.6** Tous les effets sont **obligatoires** et **sans choix**. Aucune interaction joueur pendant la résolution.
- **R-5.7** Ordre : **gauche → centre → droite**, simultané entre les joueurs. Une position est entièrement résolue chez **tous** les joueurs avant de passer à la suivante.
  1. Chaque joueur résout sa carte de gauche, calcule sa puissance, place un compteur sur la jauge **à sa gauche**.
  2. Chaque joueur résout sa carte centrale.
  3. Chaque joueur résout sa carte de droite, calcule sa puissance, place un compteur sur la jauge **à sa droite**.
- **R-5.8** Puissance bornée à **[0 ; 20]**. Affichage : compteur face +0 (0–10) ou +10 (11–20) sur la case 1–10. Puissance 0 = pas de compteur posé.
- **R-5.9** Seules les cartes de la **nouvelle ligne** sont résolues à chaque tour.
- **R-5.10 (arbitrage)** Départage déterministe à l'intérieur d'une étape : **ordre des sièges** (`player_order`).

### 5.3 Points de victoire

- **R-5.11** Une fois la ligne résolue, à chaque frontière : le joueur à la puissance la plus forte marque **(sa puissance − puissance adverse)** PV. Le plus faible marque 0. Égalité : personne ne marque.
- **R-5.12** Exemple de validation : Parieur 2 − 1 (jeton) = 1 ; Troll 2 + 2 (Enragé) = 4 → le joueur du Troll marque 3 PV.

### 5.4 Tour suivant

- **R-5.13** Jauges remises à zéro. Nouveau déploiement.
- **R-5.14** Après les PV du tour 3 : si Manche 4 → fin de partie ; sinon → phase d'amélioration.

---

## 6. Phase d'amélioration (simultanée, secrète)

### 6.1 Épuisement

- **R-6.1** Tous les jetons posés sur des cartes retournent à la réserve.
- **R-6.2** Toutes les cartes des colonnes **gauche et droite** (frontières) sont retournées face cachée.
- **R-6.3** Une carte face cachée ne peut être ni améliorée ni utilisée pour produire. → Seules les **3 cartes de la colonne centrale** restent éligibles.

### 6.2 Amélioration ou production

Pour **chaque** carte face visible (ordre au choix du joueur), exactement une action :

- **R-6.4 Production** : retourner la carte face cachée → charger 1 gemme (sans gain si déjà 3 chargées ; l'action reste possible).
- **R-6.5 Amélioration** (coût : décharger 1 gemme, donc nécessite 1 gemme chargée) :
  1. Retirer la carte : Bronze → hors jeu (boîte) ; Argent → **sous** la pioche Argent.
  2. Piocher 3 cartes du rang supérieur (Bronze → Argent, Argent → Or). **Une carte Or ne peut pas être améliorée.**
  3. Option : décharger 1 gemme supplémentaire pour piocher 3 nouvelles cartes.
  4. Choisir 1 carte, la placer face cachée à la place de la carte retirée. Les non choisies retournent **sous** leur pioche d'origine.
- **R-6.6 (arbitrage)** Repioche (étape 3) : les 3 premières cartes repartent sous leur pioche ; on tire 3 nouvelles cartes ; le choix se fait uniquement parmi ces 3 nouvelles ; l'action est répétable tant qu'on a des gemmes chargées.
- **R-6.7 (arbitrage)** Pioche Argent/Or insuffisante (< 3 cartes) : on propose simplement moins d'options.
- **R-6.8** Informations cachées : les autres joueurs ne voient pas les cartes obtenues par amélioration.
- **R-6.9 (arbitrage)** Confirmé : aucun cas particulier — les jetons Or sont déjà retirés en R-6.1 avant l'amélioration, la carte est traitée à son rang imprimé.

---

## 7. Fin de manche et fin de partie

- **R-7.1** Quand tous ont terminé : chaque joueur rassemble ses 9 cartes face cachée et les mélange = nouvelle pioche.
- **R-7.2** Tuile Manche suivante révélée.
- **R-7.3** Fin après la manche 4. Le plus de PV gagne.
- **R-7.4** Égalité : le plus de **gemmes chargées** gagne (→ `player_score_aux`). Égalité persistante : victoire partagée.
- **R-7.5 (arbitrage)** Aucun plafond en digital — le plateau physique n'est qu'une limite d'affichage, sans conséquence de règle.

---

## 8. Moteur d'effets (règle d'or + FAQ)

- **R-8.1** Les effets des cartes l'emportent toujours sur le livret.
- **R-8.2** Effets obligatoires, réalisés **autant que possible**.
- **R-8.3** Chaque instruction est traitée séparément, **dans l'ordre de lecture**. Une instruction irréalisable est ignorée ; les suivantes restent applicables, **sauf** si la première est explicitement leur **condition** (« si… ») ou leur **coût** (« déchargez une gemme pour… »). Un prérequis doit être rempli **entièrement**.
- **R-8.4 Mots-clés de portée** :
  - `Sur une frontière` : l'instruction ne s'applique pas si la carte est au centre.
  - `Dans tous les cas` : s'applique au centre comme en frontière.
  - Sans mot-clé : une carte centrale résout toutes ses instructions normalement (hors `Sur une frontière`). Un gain de puissance au centre est simplement sans effet (pas de combat).
- **R-8.5 Carte face cachée** : pas de rang, famille, trait ni effet. Perd immédiatement tous ses jetons ; rien ne peut être posé dessus. Retournée **avant** sa résolution → aucun effet, puissance 0. Retournée **après** → les conséquences restent, sa puissance sur la jauge est conservée jusqu'à la fin du tour.
- **R-8.6 Jetons** : « des jetons » sans précision = tous types de jetons.
- **R-8.7 Cartes rivales** : de part et d'autre d'une frontière commune, au même tour.
- **R-8.8 Gemmes** : décharger exige une gemme chargée. Charger est toujours résoluble (sans gain à 3/3).
- **R-8.9 Rage** : les conditions `Calme` / `Enragé` sont vérifiées au moment exact de leur lecture ; un retournement en cours de résolution n'est pas rétroactif.
- **R-8.10** Force de référence d'une carte Automa = valeur violette (voir §10).

**Recommandation d'architecture** : définitions de cartes data-driven (`material.inc.php` ou équivalent), un handler d'effet par carte, et un journal de résolution envoyé en notifications (le joueur doit comprendre chaque calcul).

---

## 9. Familles

### Brutes
- **R-9.1** Chaque joueur a un marqueur Rage, face **Enragé** au départ.
- **R-9.2** Les cartes Brutes modifient la puissance selon l'état Enragé / Calme et peuvent retourner le marqueur.
- **R-9.3** Exemple de validation (Troll, force 2) : « Enragé : gagnez +2 puissance. Dans tous les cas : retournez votre marqueur Rage. » Au centre : le +2 est sans effet, le marqueur est retourné.

### Flambeurs
- **R-9.4** Icône dé sur une carte = lancer le d6 et appliquer l'effet selon le résultat. Le jet est **aléatoire serveur** (`bga_rand`) et doit être notifié.
- **R-9.5** Les jetons Flambeurs posés sur une carte modifient sa puissance selon la face. Exemple (Parieur) : « Placez un jeton sur cette carte : 1 ou 2 → face rouge ; 3 ou plus → face verte. » Jet de 6 → +1 → puissance 2 + 1 = 3.

### Pirates
- **R-9.6** Une carte portant un jeton Or est considérée comme une carte de rang **Or** au lieu de son rang de base (compte pour tous les effets « cartes Or »).
- **R-9.7** Exemple (Mousse) : « Placez un jeton Or sur cette carte. »

---

## 10. Mode solo (Automa)

### Mise en place
- **R-10.1** Automa : une couleur, PV 0, **aucune gemme**, bénéficie des mises en place de famille (marqueur Rage, etc.).
- **R-10.2** Paquet Automa = 6 Bronze de sa couleur, dont certaines remplacées au hasard par des Argent aléatoires selon la difficulté (option de table BGA) :

| Niveau | Bronze | Argent |
|---|---|---|
| Facile | 6 | 0 |
| Moyen | 5 | 1 |
| Difficile | 4 | 2 |
| Extrême | 3 | 3 |
| Folie | 2 | 4 |

- **R-10.3** Joueur : mise en place normale, sauf le draft : il pioche **5 Argent**, en garde 3, remet les 2 autres sous la pioche Argent.

### Déroulement
- **R-10.4** Début de chaque manche : mélanger les 6 cartes Automa et les poser face cachée, une colonne de 3 à gauche de la grille du joueur, une colonne de 3 à droite.
- **R-10.5** Ordre de résolution à chaque tour :
  1. Révéler les 2 cartes Automa de la ligne en cours.
  2. Résoudre la carte Automa **gauche** → sa puissance sur la jauge gauche.
  3. Résoudre la carte frontière gauche du joueur → jauge gauche.
  4. Résoudre la carte centrale du joueur.
  5. Résoudre la carte frontière droite du joueur → jauge droite.
  6. Résoudre la carte Automa **droite** → jauge droite.
- **R-10.6** Carte Automa : force = **valeur violette** (et non la force imprimée). Effet résolu **uniquement si éclair** ; sinon texte ignoré. Si activé, mêmes règles que pour un joueur (`Sur une frontière`, `Calme`, `Enragé`, `Dans tous les cas`).
- **R-10.7** L'Automa ne peut jamais payer un coût « décharger une gemme ». « Charger une gemme » est sans effet ; les autres instructions indépendantes sont résolues.
- **R-10.8 Amélioration Automa** (fin de chaque manche, sauf la 4ᵉ) : mélanger ses 6 cartes, en tirer 2 au hasard ; toute Or tirée est remise et on retire à nouveau, jusqu'à 2 cartes Bronze ou Argent. Ces 2 cartes sont **retirées du jeu** ; pour chacune, tirer au hasard une carte du rang immédiatement supérieur et l'ajouter au paquet Automa.
- **R-10.9** Victoire : le joueur doit avoir **strictement** plus de PV que l'Automa.

---

## 11. Visibilité des informations

| Information | Visible par |
|---|---|
| Main pendant le déploiement | Le joueur seul |
| Cartes posées avant révélation | Dos pour tous (le propriétaire voit les siennes) |
| Cartes révélées de la ligne | Tous |
| Cartes obtenues par amélioration | Le joueur seul (face cachée dans la grille) |
| Contenu et ordre des pioches | Personne (nombre de cartes visible) |
| Gemmes, PV, marqueur Rage, jetons | Tous |

---

## 12. Machine à états suggérée (indicative)

```
gameSetup
  → draftSilver (multiactif, 2 passes)       // solo : chooseSilverSolo
  → roundStart (jeu)                          // solo : dealAutoma
  → turnDraw (jeu)
  → deploy (multiactif : deuxième chance + placement)
  → reveal (jeu)
  → resolve (jeu : gauche → centre → droite, notifications détaillées)
  → scoreBorders (jeu)
  → [tour < 3] turnDraw | [manche 4] gameEnd | sinon exhaust (jeu)
  → upgrade (multiactif, secret)              // solo : + automaUpgrade (jeu)
  → roundEnd (jeu) → roundStart
```

---

## 13. Écarts probables avec l'ancienne implémentation (à vérifier)

- Jauges **individuelles** → jauges **partagées** entre voisins (R-2.2, R-2.4).
- Jetons d'ordre de tour → **supprimés** ; résolution simultanée gauche/centre/droite ; tuiles Manche (R-4.4, R-5.7).
- Compteurs de puissance à paliers **+0 / +10**, puissance bornée 0–20 (R-5.8).
- Draft Argent initial (R-3.5), deuxième chance (R-5.2), épuisement des frontières (R-6.2), coût en gemme de l'amélioration et de la repioche (R-6.5).
- Départ à 1 gemme chargée sur 3 (R-3.1) ; départage aux gemmes chargées (R-7.4).
