# TODO.md

> This file is for final polish tasks once the game is functionally complete.
> For in-progress implementation, see PLAN.md.

Nothing here yet — the game is still in early development.

Une fois chaque étape créée, transformer le [] en [x], et le [A faire] en [Terminé] lorsque le bloc est entièrement traité.
Puis colle le bloc terminé en haut des Logs.
Ne traites pas de qui est dans Logs
Tout ce qui est dans le bloc [Pour plus tard] n'est pas à traiter
Ne pose pas de question, sauf si un point n'est pas clair.
A la fin, met à jour ce fichier sans demander.

---

## [A faire] 20/05 20h
[] Faire le shuffle de carte via Bga-cards/Stock/Deck/Shuffle


## Pour plus tard

[] renommer les cartes
[] Amateur : sur une frontière : si la carte rivale, ...
[] Bug d'affichage, lorsque je passe en phase 2 de silver draft, j'ai 5 cartes affichée
[] A tout moment (sauf pendant la sélection d'un remplacement), un bouton permet de terminer la phase en produisant les cartes restantes (avec boîte de confirmation).

---

## Logs - ne pas traiter

## [Terminé] 19/05 15h45

[x] À la fin de la phase d'upgrade, je voudrais que l'ensemble des cartes de la grille soit rassemblé, donc qu'il y ait une animation des 9 cartes de ma grille qui soient rassemblées pour former le nouveau deck. Les neuf cartes vont à l'emplacement du deck, l'une après l'autre. Et ensuite, il y a un mélange du deck.
[x] J'ai un bug visuel lorsque j'upgrade une carte et que je l'échange contre une autre carte de rang supérieur. Au moment où je sélectionne la carte, je voudrais une animation qui flip la carte que je viens de sélectionner et qui la met à l'emplacement où elle va, en face cachée.

## [Terminé] 19/05 15h30

[x] Lorsque j'ai terminé la phase d'upgrade et que je retourne en phase de deploy, il faut que toutes les cartes de ma grille se retrouvent dans mon deck. Donc, je dois recommencer avec une grille vierge. Tous les joueurs doivent recommencer avec une grille vierge et 9 cartes dans le deck, et on en pioche trois.
[x] Pendant la phase Silver Draft, lorsque je sélectionne ma première carte, je reçois bien les deux cartes de mon adversaire. Par contre, j'ai les trois cartes que je viens de laisser qui s'affichent. C'est un bug à corriger.

## [Terminé] 19/05 14h

[x] Lorsque je clique "Spend 1 gem to upgrade" : la carte repart sous son paquet (animation vers le haut), 3 cartes de remplacement (piochées depuis le rang supérieur) s'affichent inline dans ma main et sont cliquables. Lorsque je sélectionne une carte de remplacement, un bouton "confirmer" apparaît. Si je clique sur confirmer, la carte choisie arrive face cachée à l'emplacement de la carte initialement défaussée. Je peux continuer de sélectionner les autres cartes face-visibles après un upgrade. Migration vers Private Parallel States : state 40 (Upgrade, MULTIPLE_ACTIVE_PLAYER, initialPrivate:41) → state 41 (UpgradeMain, PRIVATE) → state 42 (UpgradePickReplacement, PRIVATE).

## [Terminé] 18/05 20h15

[x] Phase d'upgrade MULTIPLAYER : tout se gère dans le même state Upgrade sans sortir vers un state séparé.
[x] Je commence avec aucune carte en main, tout est sur la grille.
[x] Je peux sélectionner les cartes face visibles (highlight).
[x] Si je clique sur 1 carte, j'ai deux boutons : "Flip down for 1 gem" et "Spend 1 gem to upgrade".
[x] "Flip down for 1 gem" : la carte se retourne, une gemme se charge, la carte n'est plus cliquable.
[x] "Spend 1 gem to upgrade" : la carte repart sous son paquet (animation vers le haut), 3 cartes de remplacement s'affichent inline et sont cliquables.
[x] Lorsque je sélectionne une carte de remplacement, un bouton "confirmer" apparaît.
[x] Si je clique sur confirmer, la carte choisie arrive face cachée à l'emplacement de la carte initialement défaussée.
[x] Je peux continuer de sélectionner les autres cartes face-visibles après un upgrade.
[x] Un bouton "Confirm upgrades" global apparaît quand toutes les cartes ont une action et tous les remplacements sont choisis.
[x] Quand toutes mes cartes sont face cachée, la phase prend fin pour moi ; les cartes de la grille retournent dans le deck et j'attends les autres joueurs.

## [Terminé] 17/05 10h

[x] Lorsque je F5 pendant la phase de SilverDraft, mon deck doit toujours être affiché.
[x] Le shuffle de deck doit avoir lieu au début de la 1ere phase de déploiement plutôt qu'à la fin de silverDeck.

## [Terminé] 17/05 9h22

[x] Ajoutes un console.log lorsque j'entre en UpgradeCards state.
[x] Il ne se passe rien lorsque j'entre en pahse d'amélioration → je devrais pouvoir sélectionner les cartes facup

## [Terminé] 17/05 9h01

[x] Pendant la phase de déploiement, cliquer sur les espaces vides de la ligne active place la carte sélectionnée dans l'emplacement correspondant.

## [Terminé] 17/05 8h38

[x] Pendant la pahse de déploiement, je veux pouvoir cliquer sur les espaces vides de la ligne actuelle de ma grille qui ont le même effet que les boutons (si je clique sur la grille de droite de la ligne active, envoie la carte à cet emplacement.)

## [Terminé] 17/05 7h30

[x] Pendant la pahse de déploiement, je veux pouvoir cliquer sur les espaces vides de la ligne actuelle de ma grille qui ont le même effet que les boutons (si je clique sur la grille de droite de la ligne active, envoie la carte à cet emplacement.)
[x] Pendant la phase d'amélioration, quand je F5, mes cartes faceup doivent être sélecionnables
[x] pendant la phase d'amélioration, quand je clique sur "Spend 1 gem to upgrade", après la disparition de la carte, il me faut un nouveau state UpgradeCards (dans lequel je pioche 3 cartes en remplacement de celle que je viens de défausser)

## [Terminé] 17/05 07h05

[x] Je veux un symbole de 1er joueur (pour le moment, cercle jaune) au dessus de la colonne qui va se déclencher en 1er (colonne 3 du prmier joueur)
[x] Ajoutes les tooltips aux cartes en main pendant la draft
[x] pendant la phase d'amélioration, quand je clique sur "Spend 1 gem to upgrade", après la disparition de la carte, passage en state Upgrade et on pioche 3 cartes.

## [Terminé] 16/05 21h30

[x] lorsque le marqueur rage doit etre retourné, il doit être en même temps que la carte qui le retourne est activé (wooble)
[x] lorsque je F5 pendant la phase d'amélioration, plus aucune carte faceup n'est sélectionnable
[x] lorsqu'une carte est flip down pendant la phase d'amélioration, je ne veux pas de voile blanc
[x] lorsque je F5 pendant la phase de draft, si je suis encore en attente des autres joueurs je veux que les cartes qui passeront au joueur suivant soient encore visible dans ma main
[x] pendant la phase d'amélioration, quand je clique sur "Spend 1 gem to upgrade", la carte que j'ai sélectionné repart sous son deck de rang → animation vers le haut fadeout

## [Terminé] 16/05 20h30

[x] Phase d'amélioration : retirer le bouton "confimer"
[x] Phase d'amélioration : il ne se passe rien lorsque je clique sur "Spend 1 gem to upgrade" → de devrai défausser la carte, décharger une gemme et piocher 3 cartes du rang supérieur
[x] Pendant la phase de résolution, les gemmes flip alors qu'il n'y a pas d'effet qui agit sur les gemmes (ex : je mousse charge 2 gemmes sur la frontière ; s'il est au centre, il n'en charge pas, donc les gemmes ne flip pas)

## [Terminé] 16/05 19h33

[x] J'ai toujours le souci avec les tooltips qui ne s'affichent pas ; seule la carte de la main à droite a un tooltip. Il faut que tous les éléments en aient.
[x] Lors de la pahse d'amélioration, lorsque je clique sur une carte puis un bouton, tout l'effet se fait. Dans le cas de "retourner pour gagner 1 gemme", animer la carte qui se retourne puis animer la gemme qui se charge. Dans le cas d'"améliorer une carte", animer le déchargemetn de gemme, animer la défausse de carte, animer les 3 cartes qui viennent dans la main
[x] La phase d'amélioration prend fin lorsque tous les joueurs ont retourné leur 3 cartes.

## [Terminé] 16/05 17h50

[x] Je veux que l'image du tooltip soit en 344x238 cas des cartes
[x] Les tooltips ne sont pas actives sur l'ensemble des éléments du plateau, il faut qu'il le soit
[x] L'effet du mousse ne s'active que sur une frontière (donc en colonne 1 et 3)
[x] Lorsque j'entre en phase d'amélioration, je devrais avoir possibilité d'interagir avec les 3 cartes de la colonne 2, or j'ai le message que je n'en ai aucune. En début de pahse d'amélioration, les 3 cartes faceup du centre doivent pouvoir être sélectionnées

## [Terminé] 16/05 17h20

[x] Le tooltip est bon, mais je ne le vois que sur 1 carte. Je veux que chaque élément du plateau ait un tooltip (cartes dans la main, sur les grilles, tokens en jeu)
[x] Lorsqu'un effet de flambeur lance le dé, je veux une animation de lancer de dé à droite du marqueur rage.
[x] Lorsqu'un effet de flambeur lance le dé et ajoute un jeton, je veux que l'animation du lancer de dé soit finie avant d'ajouter le jeton et annoncer la puissance

## [Terminé] 16/05 16h45

[x] Rajotues un tooltip lorsqu'on survole les cartes (pour avoir la carte en plus grand, la force, les traits et l'effet) ou sur les jetons (effet uniquement) avec this.bga.gameui.addTooltipHtml
[x] Le mousse doit se retourner s'il est sur une frontière (faire l'animation de flip)
[x] Les effets d'influence doivent être notify (l'effet de chaque carte)
[x] La force ne peut pas être inférieure à 0

## [Terminé] 16/05 16h33

[x] Réduis la taille des jetons à 60x60px
[x] Je veux que les animations de combat soient aussi sur les espaces flank, ainsi que les jetons.

## [Terminé] 16/05 16h06

[x] Je veux que les notify soient également dans la barre de titre lors de la résolution (influence et combat)
[x] Laisse un délai de 3 secondes entre chaque notify pour la résolution
[x] Le bouton mulligan ne doit pas apparaitre si je n'ai pas de gemmes
[x] Agrandir le jeton en 80x80px et le placer en haut à droite de la carte s'il est placé dessus. S'il y a plusieurs jetons, placer les suivants en colonne avec un gap de 40px

## [Terminé] 16/05 15h45

[x] Lorsque je mulligan, la carte qui est mulligan est mise en dessous du deck, puis la carte est la carte du dessus est piochée.
[x] Je veux intégrer les images des jetons (img/components)

## [Terminé] 16/05 11h56

[x] L'animation de wooble ne doit se faire qu'au moment du notify dans l'ordre de résolution : carte du centre du 1er joueur, puis carte du centre du 2nd joueur, etc... ; de la même manière pour les combats, carte 1 du 1er combat, puis carte 2 du 1er combat, puis carte 1 du 2nd combat et carte 2 du 2nd combat, ...
[x] je ne vois aucun jeton sur table.

## [Terminé] 16/05 10h21

[x] Les tokens doivent apparaître sur le plateau. Si un token est placé "sur cette carte", je veux qu'il apparaisse sur le board. Si c'est sur "l'emplacement suivant", le token va sur la ligne suivante de la même colonne
[x] L'animation d'apparition doit être un slide depuis le haut de l'écran jusqu'à sa position
[x] Les tokens sont toujours par dessus les cartes. Si une carte est retournée, le jeton est défaussé (animation de slide vers le haut)

## [Terminé] 16/05 9h43

[x] Prévoir une zone spécifique aux composants des classes à droite des gemmes.
[x] Déplacer le marqueur rage dans cette zone spécifique.
[x] Le dé est lancé dans cette zone. (à droite du marqueur rage)
[x] L'animation de wooble doit se faire au moment où la notification apparait dans le combat
[x] j'ai un bug, les cartes de la frontière se sont retournées en fin de tour 2 ; sauf effet de cartes, elle ne sont retournées qu'en fin de tour 3

## [Terminé] 16/05 8h39

[x] Lorsque les cartes sont activées via notify, je veux une animation type shuffle, pour montrer qu'elles s'activent.
[x] Je veux que la valeur de force "popup" sur la carte lorsqu'elle est calculée (avec this.bga.gameui.displayScoring)
[x] Au 3ème tour, le mulligan est désactivé
[x] Lorsque le 3ème tour arrive, toutes les cartes aux frontière (colonnes 1 et 3) sont flip down
[x] A la pahse d'upgrade, seules les cartes face up (centre) sont sélectionnables/
[x] Pendant la phase d'upgrade, lorsque je sélectionne une caret, j'ai 2 boutons qui s'affichent "flip down for 1 gem" et "spend 1 gem to upgrade"
[x] si le joueur n'a pas de gemme, l'action "spend 1 gem to upgrade" n'apparait pas

## [Terminé] 16/05 7h58

[x] La main doit avoir la même lageur que la grille, et doit être positionnée à droite du deck
[x] Le dessus du deck doit présenter le dos de cartes (img/cards_scoundrels.png, colonne 12)
[x] Lorsque le marqueur rage est retourné, faire une animation de flip
[x] Lors qu'un effet demande de jeter un dé, faire une animation sur la carte qui lance le dé (les images du dé sont dans img/components_scoundrels.png, colonnes 1 à 6 correspondantes aux valuers du dé)
[x] Implémete les visuels des jetons ; Jeton flambeurs dasn img/components_scoundrels.png (colonne 7 = +1, colonne 8 = +4, colonne 9 = +3, colonne 10 = +8) recto en ligne 1 (face verte), verso en ligne 2 face rouge ; Jeton pirate dans img/components_scoundrels.png colonne 12

## [Terminé] 16/05 7h24

[x] retirer bc-player-info
[x] Ajuster la couleur des gemmes (joueur rouge doit avoir les gemmes rouges, joueur vert doit avoir les vert, etc...)
[x] Le dessus du deck doit présenter le dos de cartes
[x] Lorsque je mulligan, je veux une animation de la carte qui retourne sous le deck
[x] Lorsque je mulligan, je veux une animation de la gemme qui se retourne
[x] Mettre un délai de 3 secondes entre chaque notity pour l'influence et la résolution
[x] lors de la notify de l'influence, notify l'effet de la carte.

## [Terminé] 15/05 20h30

[x] L'empalcement du deck doit être fixé à gauche de la zone [deck+main]
[x] Implanter le dos des cartes, dans img/cards_scoundrels.png, colonne 12 (ligne 1 pour les flambeurs, ligne 2 pour les brutes, ligne 3 pour les pirates)
[x] Implémenter le visuel du marqueur de rage (11ème colonne du fichier components_scoundrels.png, rage en ligne 1, calme en ligne 2) à droite de la zone [deck+main]
[x] Implémenter le visuel des gemmes (image gems.png, chaque ligne 1 est la face chargée, ligne 2 la face déchargée correspondante. Dans lordre, colonne 1 = rouge, colonne 2 = vert, colonne 3 = bleu, colonne 4 = jaune) sur une zone entre la grille et la [main+deck] - cette zone est visible pour tous.

## [Terminé] 15/05 18h24

[x] Dans CardEffects.php, prévois pour chaque effet d'avoir le texte qui sera renvoyé dans le notify.
[x] Les cartes dans les grilles ne peuvent jamais être sélectionnées ni hover. Seules les cartes de ma main peuvent être sélectionnées.
[x] Lorsqu'il n'y a pas d'effet d'une carte, annoncer uniquement la force.
[x] Afficher le jeton 1er joueur
[x] L'empalcement du deck doit être fixé à droite de la zone [deck+main]
