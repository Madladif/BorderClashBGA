# TODO.md

> This file is for final polish tasks once the game is functionally complete.
> For in-progress implementation, see PLAN.md.

- Toujours lors de la phase d'amélioration, lorsque je sélectionne ma carte, elle flip, mais le dos n'est pas correct (affiche une autre carte au dos alorsq ue ça devrait être le dos de carte.)

---

## Logs - ne pas traiter

## [Terminé] 29/09 (48)

[x] Régression persistante "spend 1 to upgrade" (carte qui revient en place) → 2 fixes précédents ((42), (45)) n'y suffisaient pas car le vrai problème n'était pas l'ORDRE des opérations mais le fait d'animer directement l'élément réel (`cardEl`) puis de le remettre à `gridStock.removeCard()` : cette méthode a sa propre gestion interne de l'élément qui entrait en conflit avec nos styles inline, quel que soit l'ordre. Corrigé en adoptant le même principe qu'ailleurs dans ce fichier (`notif_deckShuffled`, `_placeTokenAnimated`) : un clone ("ghost") fixe joue l'animation de vol, l'élément réel est caché instantanément (`visibility:hidden`) puis remis au stock indépendamment, sans jamais toucher son style de transformation.
[x] Animation flip + slide pour la carte de remplacement choisie → ajoutée dans `notif_upgradeReplacementPicked` : clone de l'option choisie (encore visible face visible dans le panneau de choix), flip vers le dos (sprite dos réutilisé de `_cardHtml`), puis glissement vers la case de grille libérée. Auparavant la carte apparaissait directement sans transition.
[x] Mulligan : une 2e utilisation peut repiocher la carte rendue par la 1re → le fix du (38) n'excluait que la carte du mulligan EN COURS, pas celles rendues par un mulligan précédent ce même tour. Ajouté un historique par joueur (`mulligan_returned_{pid}`), remis à zéro à chaque nouvelle distribution de main de round ; chaque mulligan y ajoute sa carte et exclut tout l'historique du tirage (repli progressif si le deck n'a plus rien d'autre à proposer).
[x] Jeton disparu après F5 (effet Navigateur, 2 jetons posés) → vrai bug de fond trouvé, pas spécifique au Navigateur : `getCollectionFromDb()` indexe son résultat par la 1re colonne sélectionnée par défaut ; la requête de `Game::getAllDatas()` sélectionnait `player_id` en premier — dès qu'un joueur a 2 jetons ou plus en même temps (n'importe quel effet), les lignes se marchent dessus sur cette même clé et une seule survit. Invisible en direct (l'affichage suit les éléments DOM, pas ce tableau), mais un F5 reconstruit tout depuis lui → perte silencieuse. Corrigé en sélectionnant l'`id` unique de `bc_token` en premier. Même faille trouvée et corrigée dans `broadcastTokensSync()` (RevealAndResolve.php), qui indexait par `grid_position` — non-unique dès que 2 jetons partagent une case (le but même de l'affichage à 50%).
[x] Animation de rassemblement (Tricheur/Poker Face) : le nouveau jeton tombait quand même du haut de l'écran après la convergence → les anciens jetons convergeaient bien vers la carte cible (fix du (45)), mais le jeton final était ensuite ajouté via `_placeTokenAnimated` qui rejoue SYSTÉMATIQUEMENT une chute depuis le haut, en plus de la convergence — deux arrivées au lieu d'une. Remplacé par une pose instantanée (sans chute) à cet endroit précis, la convergence des anciens jetons suffit à montrer l'arrivée.

**Pas testé en Studio.**

## [Terminé] 29/09 (47)

[x] Freebooter : confirmé bug d'animation (pas de bug serveur) → `_updateGemDisplay()` supposait qu'un seul jeton change d'état par appel (vrai pour la plupart des effets ±1 gemme) et ne retournait QUE le premier jeton concerné (`gems[changingIdx]`), ignorant silencieusement les autres. Le +2 gemmes du Freebooter passait donc de 1→3 en DB (correct, d'où le F5 qui montrait le bon compte) mais l'animation ne retournait qu'1 seul jeton à l'écran. Corrigé : la fonction retourne maintenant TOUS les jetons sur la plage concernée, un par un.
[x] Deck de draft pas à la même position qu'en déploiement, + retrait du label et du contour gris → le deck de draft était ajouté à la fin du plateau joueur (`.bc-player-board`), donc positionné par le flux normal de la page, pas aligné avec où le deck apparaît ensuite en déploiement. Reconstruit à l'intérieur de `#bc-footer-deck-{pid}` — exactement le conteneur que le deck de déploiement (`.bc-deck-pile`) utilise plus tard — donc même emplacement dans les deux phases. Label "Deck" et fond gris/bordure retirés (`.bc-draft-deck-area` est maintenant un simple conteneur).
[x] Marqueur rage déplacé sous les gemmes → `.bc-footer-extras` passé de ligne à colonne (`flex-direction:column`), gemmes en haut puis rage(+dé) en dessous. Un seul changement CSS, rien touché côté HTML/JS.
[x] Crazy 6 ("Crazy Joker") : une seule animation de dé au lieu d'une par jeton → l'effet lance bien 1 dé par jeton en DB mais ne gardait que le compte de "6" obtenus, jamais les valeurs individuelles, et rien n'était envoyé au client pour les animer. Ajouté `dice_rolls` (tableau de tous les lancers) en plus du champ `dice_roll` existant ; le serveur envoie maintenant une notification d'animation par lancer (jouées les unes après les autres, comme les autres notifications).

**Pas testé en Studio.**

## [Terminé] 29/09 (46)

[x] Bombardier : la carte du dessous ne se retourne pas visuellement (flip down absent) → vraie cause trouvée : le serveur fait bien le flip en DB (`UPDATE bc_card SET card_face_up=0`), mais n'envoyait AUCUNE notification côté client pour CETTE carte précise (le système `cardFlippedFaceDown` existant ne couvrait que le cas où une carte se retourne ELLE-MÊME, comme Freebooter — jamais le cas Bombardier où c'est une AUTRE carte, celle du dessous, qui est concernée). Résultat : la DB était correcte mais l'écran restait faux jusqu'à un F5. Ajouté un nouveau champ `flipped_below` (position + famille de la carte concernée) renvoyé par l'effet, et une notification dédiée envoyée dès qu'il est présent — réutilise le handler client existant (`notif_cardFlippedFaceDown`), qui marche déjà pour n'importe quelle position. (Le bot solo a aussi la donnée calculée côté serveur pour cohérence, mais son affichage utilise un système différent — pas branché, hors-sujet ici puisque le bug touchait ta propre grille.)
[x] Erreur SQL fatale au dernier tour de déploiement (fin de partie) → `"rank"` est un mot réservé MySQL depuis la 8.0 (fonctions fenêtre) ; l'utiliser tel quel comme alias de colonne (`SELECT card_type AS rank`) fait planter la requête sur le serveur réel — jamais vu en local si ta version de MySQL/MariaDB locale est plus ancienne ou plus permissive, d'où le bug qui n'apparaît qu'en jeu réel, uniquement à la toute fin (EndScore, calcul du décompte de cartes par rang). Renommé l'alias en `card_rank`.

**Pas testé en Studio.**

## [Terminé] 29/09 (45)

[x] Régression du (42) : "spend 1 to upgrade" — la carte slide vers le haut puis revient en place → cause trouvée : mon fix du (42) remettait `opacity`/`transform` à vide AVANT d'appeler `gridStock.removeCard()` (pas après). Le temps que `removeCard()` fasse effet, la carte — déjà rendue visible à nouveau par ce reset — réapparaissait en pleine vue à sa place, exactement le symptôme d'origine que (42) devait justement corriger. Inversé l'ordre : on attend maintenant la fin de `removeCard()` avant de nettoyer les styles.
[x] Jetons multiples sur 1 carte, recouvrement total au lieu de 50% → vrai bug de course (race condition) trouvé : le code de décalage 50% existait déjà et fonctionnait pour un jeton posé seul, mais quand PLUSIEURS jetons arrivent sur la même carte dans le même évènement (ex: un effet de rassemblement), ils sont posés en parallèle (`Promise.all`) et chacun lit le nombre de jetons déjà présents AVANT que les autres de son propre lot aient eu le temps de s'ajouter — tous lisaient donc le même compte de départ et atterrissaient au même endroit. Corrigé : le décalage de chaque jeton du lot est maintenant calculé à l'avance (avant de les lancer en parallèle), pas relu en direct pendant l'animation.
[x] Poker Face / Cheater : jeton rouge qui arrive devrait flip vers la face verte → ajouté une animation de flip (rotation 90°, changement de sprite vers la face "+", pas de retour à 0°) juste avant que chaque jeton rouge rassemblé ne converge vers la carte cible — visualise le texte de règle "rassemble + retourne face +" au lieu d'un simple fondu resté rouge.

**Pas testé en Studio.**

## [Terminé] 29/09 (44)

[x] Bombardier : aucun bonus si la carte du dessous est déjà face cachée → confirmé bug réel grâce à ta précision (l'effet EXIGE de retourner une carte face visible ; si elle est déjà cachée, rien à retourner, donc pas de bonus). La requête qui va chercher la carte du dessous ne filtrait pas du tout sur `card_face_up` — elle la trouvait quand même (le type reste connu en DB même face cachée) et donnait le bonus à tort. Ajouté `AND card_face_up = 1` à la requête (version joueur ET version bot, les deux avaient le même trou).

**Reste ouvert — Freebooter (charge 1 gemme au lieu de 2)** : vérifié tout le circuit (requête, `chargeGems()`, notif `gemUpdated`) — rien ne plafonne à 1 dans ton scénario (1 chargée avant → 2 non-chargées dispo → devrait charger les 2 sans problème). Vérifié aussi contre `docs/cartes.csv` (source de vérité citée en commentaire du code) : le code correspond exactement au texte français d'origine ("Retournez cette carte face cachée pour charger 2 gemmes"), donc ce n'est pas un mélange de cartes. Fait au passage : repéré que **MATERIALS.md a les mauvaises infos** pour Bronze/Pirate (son tableau inverse Cabin Boy et Freebooter, et son "effet" pour Freebooter parle à tort d'un jeton or) — pas touché à ce fichier (marge de manœuvre limitée sans savoir si c'est lui ou cartes.csv qu'il faut corriger), à voir si tu veux que je le remette d'aplomb. Pour le vrai bug de charge : peux-tu redonner le contexte exact la prochaine fois que ça arrive (nombre de gemmes chargées juste après, via l'interface) ? Sans ça je ne peux pas aller plus loin sans deviner.

**Pas testé en Studio.**

## [Terminé] 29/09 (43)

[x] Bug dos de carte "montre une autre carte" au flip-down, se corrige tout seul après le slide (confirmé desktop) → cause trouvée grâce à tes réponses : c'était la même faute de frappe que toute la saga mobile de ce chantier — la règle CSS de secours du flip 3D (`.bc-card .card-side`/`.card-sides`, sans le préfixe `bga-cards_`) ne matchait RIEN depuis le début (vrai nom : `bga-cards_card-side`/`bga-cards_card-sides`), donc notre `backface-visibility:hidden` n'était JAMAIS appliqué par nous-mêmes. Le temps que le style injecté par bga-cards lui-même prenne effet (race au chargement), une carte en cours de rotation n'avait aucune règle backface-visibility active, laissant transparaître l'AUTRE face (une autre carte) pendant le milieu du flip — puis "correction toute seule" une fois le style de la lib appliqué. Corrigé : sélecteurs mis à jour avec le vrai nom de classe, donc ce filet de sécurité s'applique vraiment dès le premier rendu.
[x] Fin de phase d'amélioration, shuffle invisible → cause trouvée : `notif_deckShuffled` créait un `BgaCards.AllVisibleDeck` vide (jamais peuplé de cartes) et appelait `.shuffle()` dessus — comme la méthode existe, le filet de secours CSS (prévu seulement `si` `.shuffle` n'existe pas) ne se déclenchait jamais non plus. Résultat : aucune animation visible, sur rien. Remplacé par un vrai placeholder visuel (pile face-cachée, même famille que le joueur, même id que celle que `_buildHand` construira juste après) sur lequel joue directement le wiggle CSS — garanti visible.
[ ] Distribution de main "stack" en fin d'amélioration : la cause connue (largeur/`--bga-cards_card-width` de grille mobile qui traîne sur les cartes redistribuées) a déjà été corrigée au (39), dans ce même chemin de code. Pas de nouvelle cause trouvée en relisant — à confirmer si ça persiste après ces 2 fixes, sinon j'ai besoin d'un nouveau test en Studio pour repartir de zéro dessus.

**Pas testé en Studio.**

## [Terminé] 29/09 (42)

[x] Bug d'affichage phase d'amélioration : la carte que j'améliore ne sortait pas visuellement de la grille → cause trouvée en lisant le code, pas devinée. `_onSpendGem()` fait bien flotter+disparaître la carte (`translateY(-70px)` + `opacity:0`) pendant 400ms, MAIS la vraie suppression de cette carte du `gridStock` n'arrivait que bien plus tard, dans `notif_upgradeReplacementPicked` — qui ne se déclenche qu'une fois que tu as fini de choisir ta carte de remplacement sur l'écran SUIVANT (UpgradePickReplacement). Entre les deux, mon fix du (39) remettait `opacity`/`transform` à vide après les 400ms (pour éviter qu'ils polluent une future réutilisation de cet élément DOM) — sauf que la carte était TOUJOURS dans le gridStock à ce moment-là, donc elle réapparaissait en pleine visibilité à sa place d'origine dès que ce reset passait, et y restait jusqu'à l'écran de remplacement. Corrigé : à la fin du fondu (400ms), la carte est maintenant vraiment retirée du `gridStock` (en plus de nettoyer les styles inline) — donc elle reste bien partie tout le temps que tu choisis son remplacement.

**Pas testé en Studio.**

## [Terminé] 29/09 (41)

[x] 4 derniers warnings "Possibly untranslated" (Game.php:272/334/335/412/457) — au tour (40) je les avais volontairement laissés (vrais faux positifs : format SQL, exceptions internes jamais vues par un joueur), mais le checker BGA les compte quand même comme erreurs restantes. Enveloppés dans `clienttranslate()` comme le reste, même si semantiquement bizarre pour un format SQL — sans effet fonctionnel (juste une entrée en plus dans les fichiers de traduction, jamais affichée à un joueur pour 3 des 4 ; le format SQL n'est de toute façon jamais montré à personne). `php -l` propre sur Game.php.

**Pas testé en Studio.**

## [Terminé] 28/09 (40)

[x] Liste complète des warnings "Possibly untranslated" du linter BGA Studio (CardEffects.php, Game.php, Deploy.php, PlayerTurn.php, SilverDraft.php, UpgradeMain.php, UpgradePickReplacement.php) → traités par catégorie :

- **CardEffects.php (~80 fragments, bulles de résolution)** : chaque morceau de texte statique dans `$out['effect_text']` (concaténé avec des nombres/variables) enveloppé dans `clienttranslate()`, fragment par fragment — les flèches/symboles/emoji seuls (`→`, `+`, `🎲`) laissés tels quels (le linter ne les réclamait pas, rien à traduire). Fait via un script Node ciblé (regex sur les littéraux après le `=`, en excluant les clés de tableau type `['strength_bonus']`), plus 2 lignes à ternaire multi-lignes corrigées à la main (le script ne les avait pas vues).
- **Exceptions joueur (`UserException`)** : 13 messages (Deploy.php, PlayerTurn.php, SilverDraft.php, UpgradeMain.php, UpgradePickReplacement.php) enveloppés dans `clienttranslate()` — ce sont des messages vus par le joueur (carte invalide, pas assez de gemmes, etc.), donc traduisibles comme le reste du texte joueur du projet.
- **`debugLog` restant (UpgradeMain.php:244)** : c'est un vrai `console.log` de debug côté client (`notif_debugLog` dans Game.js), toujours utilisé activement pendant tes tests Studio — pas supprimé, juste enveloppé dans `clienttranslate()` pour faire taire le warning sans perdre l'outil.
- **Laissés tels quels (faux positifs, pas de texte joueur)** : `Game.php:272` (format SQL `vsprintf("(%s,'%s','%s')", ...)`, aucun mot, jamais vu par un joueur) ; `Game.php:334-335` et `:412`/`:457` (exceptions internes de crash serveur — `\Exception`/`\RuntimeException`, pas `UserException` — donc jamais affichées traduites au joueur, seulement dans les logs BGA en cas de bug réel).
- `php -l` propre sur les 6 fichiers PHP modifiés.

**Pas testé en Studio.**

## [Terminé] 26/09 (39)

[x] Fin de phase d'amélioration : cartes de main toujours empilées/non cliquables après le fix (38) → vraie cause trouvée, différente de celle visée au (38). Le fix mobile de la grille (`_watchMobileGridCardWidth`) force en permanence `width` + `--bga-cards_card-width` + `--bga-cards_card-effective-width` à 83.5px EN INLINE directement sur l'élément `.bc-card`, tant qu'une carte est dans la grille (mobile). Or bga-cards réutilise ce même élément DOM par id de carte partout ailleurs (bug de fond déjà rencontré plusieurs fois ce chantier) — quand la carte revient au deck du joueur en fin de manche (`notif_deckShuffled`) puis ressort en main la manche suivante (`_buildHand`), elle traînait encore sa demi-largeur "grille" (83.5px au lieu des 167px d'une carte de main) : bga-cards recalculait la mise en page de la main (LineStock) sur cette fausse largeur → cartes chevauchées/mal positionnées, donc non cliquables. Les deux boucles de nettoyage existantes (qui remettaient déjà transform/opacity/zIndex/visibility à vide pour cette même raison ailleurs dans le fichier) ne touchaient pas ces 3 propriétés — ajoutées aux deux endroits (`_buildHand` juste avant distribution, et `notif_deckShuffled` juste avant le retour au deck, en double sécurité).

**Pas testé en Studio — refaire un F5 après ce fix (vieux styles inline restent collés tant qu'une carte n'est pas recréée).**

## [Terminé] 26/09 (38)

[x] Mobile : garder les images des jetons, juste redimensionnées (pas de forme CSS plate). → Retiré `background-image:none;background-color:...;border:...` du `.bc-token` mobile — gardé uniquement `transform:scale(0.5)` (déjà là depuis le (27)) qui réduit l'image réelle en place.
[x] Hauteur de main fixe, avec ou sans cartes (évite que la page saute). → `.bc-hand-area{min-height:30px}` → `119px` (= hauteur d'une carte) — la boîte fait donc la même taille pleine ou vide.
[x] Mulligan : parfois je repioche la carte que je viens de mulligan. → Bug réel confirmé dans le code : la carte revient dans le pool `deck` puis le tirage se fait par `ORDER BY RAND()` sur TOUT le pool, y compris la carte qu'on vient d'y remettre — un commentaire existant ("may draw the same card back if deck had only 1 card") sous-estimait le risque : en réalité n'importe quelle taille de deck peut retomber dessus, pas seulement 1 carte (RAND() est uniforme sur tout le pool). Corrigé : le tirage exclut explicitement `card_id != {$cardId}` ; repli sur l'ancien comportement (carte autorisée) uniquement si c'est la SEULE carte restante dans le deck (sinon le joueur perdrait sa carte sans remplacement).
[x] Fin de phase d'amélioration : cartes de main empilées et non cliquables à la distribution. → Vrai bug trouvé, même famille que plusieurs fixes précédents (carte réutilisée par bga-cards avec des styles inline oubliés) : `_onSpendGem()` (bouton "Spend 1 gem to upgrade") anime la carte qui s'envole (`translateY(-70px)`, `opacity:0`) mais ne nettoyait jamais ces styles après — cette carte part ensuite dans une pile partagée et peut réapparaître n'importe où plus tard (main d'un futur tour, autre joueur) en gardant ces styles, invisible/décalée. Ajouté un nettoyage différé (`setTimeout` 400ms, la durée de l'animation).

**Pas testé en Studio.**

## [Terminé] 26/09 (37)

[x] Images de carte grille : nouveau symptôme après (36) — moitié droite VIDE (au lieu de montrer la carte suivante), position inchangée. → Toi-même trouvé la preuve décisive : désactiver `--bga-cards_card-width: 167px` posé en inline SUR LA CARTE ELLE-MÊME (pas juste hérité de `.bc-grid`) réglait l'affichage. Ça confirme que bga-cards utilise cette variable pour un calcul interne (position/transform du flip 3D), indépendant de la largeur réelle de la boîte — tant qu'elle restait 167 sur la carte, la géométrie du flip continuait de supposer une carte 2× trop large, d'où le contenu réel visible seulement à gauche et rien à droite (la moitié qui aurait dû "glisser" pour remplir l'espace). Corrigé : `--bga-cards_card-width` ET `--bga-cards_card-effective-width` forcées à 83.5px directement sur l'élément carte (JS `_watchMobileGridCardWidth`, + filet CSS en secours).

**Pas testé en Studio — pense à refaire un F5.**

## [Terminé] 26/09 (36)

[x] Images de carte grille toujours mal positionnées — cause trouvée grâce à ton nouveau DevTools (Computed `width: 166.997px` sur la face + breadcrumb DOM). → Il y a un 3e niveau dans la structure bga-cards que le (34) n'avait pas couvert : `.bc-card` (83.5px, forcé) → **`bga-cards_card-sides`** (wrapper "sides", PLURIEL, porte la transformation 3D du flip — jamais touché) → `bga-cards_card-side` (face, SINGULIER, `width:100%`). Le `width:100%` de la face se calculait par rapport à ce wrapper intermédiaire encore à 167px, pas par rapport à `.bc-card` directement — d'où le 167px qui remontait jusqu'au Computed final malgré le `!important` déjà posé sur la face. Ajouté le wrapper pluriel (`bga-cards_card-sides`) au même traitement forcé (JS `_watchMobileGridCardWidth` + règle CSS mobile), en plus du singulier.

**Pas testé en Studio — fais un nouveau F5 après ce fix (les vieux styles inline restent collés tant qu'une carte n'est pas recréée).**

## [Abandonné] 26/09

[x] Dark mode — clôturé à ta demande, pas de mécanisme BGA officiel trouvé/documenté à l'heure actuelle. À rouvrir si BGA publie une doc dev ou si tu repères la classe/attribut exact via DevTools.

## [Terminé] 26/09 (35)

[x] Égalité de puissance : afficher "0" sur fond gris dans la bulle (permanent comme les autres). → `_recordGaugeDiffLine()` sortait immédiatement sur égalité (`if (lStr===rStr) return`), donc le tour disparaissait carrément de l'historique au lieu d'y laisser une trace. Restructuré : le calcul du côté ("mySide") se fait toujours en premier, puis égalité → texte "0" + gris `#7f8c8d` (déjà la couleur de repli existante), sinon comportement inchangé. Réutilise le même mécanisme d'ajout de ligne donc même permanence/F5 que les autres (le serveur stockait déjà TOUS les combats dans `gauge_diff_history`, y compris les égalités — seul le client les ignorait).
[x] Mobile, cartes de grille toujours en défaut — trouvé un vrai trou dans le (34) avant même que tu retestes. → Le `MutationObserver` ne réagissait qu'aux nouveaux `.bc-card` (ou leurs descendants) ; si bga-cards crée d'abord la carte VIDE puis ajoute ses faces avant/arrière (`bga-cards_card-side`) en 2 temps, une face ajoutée seule à une carte déjà vue passait entre les mailles. Ajouté un traitement direct sur les faces elles-mêmes, plus en sécurité un balayage complet (`gridEl.querySelectorAll(".bga-cards_card-side")`) à chaque passage.
[x] Mobile, couleurs de jauge : fond #2886CC, traits blancs, valeurs #9E1E21 gras (déjà gras). → 3 couleurs mises à jour dans le bloc mobile.
[x] Tooltip, traits en gras+italique. → Déjà fait au tour (28) (`<strong><em>`) — rien à changer, vérifié.

**Reste ouvert** : dark mode. → Cherché en ligne : BGA a bien un mode sombre natif mais toujours "inachevé" mi-2026 d'après les dépôts communautaires trouvés (aucune doc officielle sur le mécanisme CSS exact — classe sur `html`/`body`, `prefers-color-scheme`, variables custom...). Sans savoir COMMENT BGA signale le mode sombre à notre CSS, je ne peux rien cibler correctement. Tu peux m'envoyer : le lien vers l'annonce/doc BGA que tu as vue, OU juste ouvrir DevTools avec le mode sombre activé et me dire quelle classe apparaît sur `<html>` ou `<body>` ?

**Pas testé en Studio.**

## [Terminé] 26/09 (34)

[x] "Image à cheval sur 2" — cause trouvée grâce à la valeur Computed que tu as donnée. → Le calcul (-2254.5px) était bien correct (confirmé), donc le problème n'était pas le calcul mais la fenêtre à travers laquelle il se lit. En comparant avec le HTML collé au tour (33), la vraie classe posée par bga-cards est `bga-cards_card-side` (avec préfixe), PAS `.card-side` — nos sélecteurs `.card-side` (règle CSS mobile du (28) ET le JS `_watchMobileGridCardWidth` du (29)) ne matchaient donc RIEN depuis le début. Résultat concret : la div interne qui peint réellement le sprite restait à son ancienne largeur, se retrouvait centrée (pas collée à gauche) dans la `.bc-card` désormais plus étroite, et la fenêtre visible finissait par chevaucher la moitié droite de cette carte ET la moitié gauche de la suivante dans la feuille de sprites — exactement "à cheval sur 2". Corrigé : sélecteur JS (`querySelectorAll(".bga-cards_card-side")`) et règle CSS mobile mis à jour avec le vrai nom de classe. Les anciennes règles `.card-side` "desktop" (centrage de secours, jamais actives non plus) laissées telles quelles à dessein — les corriger changerait un comportement jamais testé sur tout le jeu (main, tooltip, etc.) sans besoin établi, alors que rien n'y est actuellement cassé.
[x] Bonus au passage : bandeau de traits dupliqué (visible dans ton HTML collé) — déjà corrigé au tour (33).

**Pas testé en Studio — mais chaque étape de ce fix a été vérifiée avec tes vrais chiffres/HTML, pas juste déduite.**

## [Terminé] 26/09 (33)

[x] Bandeau de traits dupliqué (visible dans le HTML collé : "gambler impact" apparaissait 2 fois). → `setupFrontDiv()` peut être ré-appelée par bga-cards sur le même élément (reflow/réutilisation) sans qu'on l'ait demandé — chaque appel ajoutait un nouveau bandeau sans retirer l'ancien. Ajout d'un `element.querySelector(".bc-card-traits-overlay")?.remove()` avant d'en recréer un.

**Reste ouvert** : "image à cheval sur 2". → Vérifié le calcul à la main avec tes chiffres (`--sprite-x:-2171px`, carte rang 2/silver) : `-2171 - 83.5 = -2254.5`, ce qui donne exactement la moitié DROITE de cette carte (fenêtre [2254.5, 2338], borne exacte de la case suivante dans la feuille de sprite 3006px/18 colonnes) — aucun débordement en théorie. Le panneau Styles montrait la règle MATCHÉE, pas la valeur finale résolue. Demandé dans le chat la valeur **Computed** de `background-position-x` (et `background-size`) sur cette même carte, pour voir si autre chose la court-circuite.

**Pas testé en Studio.**

## [Terminé] 26/09 (32)

[x] Mobile : grille+jauges+frontières adverses doivent prendre 100% de la largeur dispo. → `.bc-grid-with-flanks` n'avait pas de largeur propre (sizée à son contenu, plus étroit que le plateau maintenant que les cartes sont rognées) → `width:100%;justify-content:space-between` (répartit l'espace entre les 5 sections flanc/jauge/grille/jauge/flanc plutôt que d'agrandir une section en particulier).

**Reste ouvert** : alignement des CASES ok (merci, la piste `--bga-cards_card-width` a marché), mais l'IMAGE de la carte est maintenant à cheval sur 2 — symptôme différent, nouveau. Besoin d'une capture + DevTools comme le tour (31) pour cibler juste (demandé dans le chat).

**Pas testé en Studio.**

## [Terminé] 26/09 (31)

[x] `.bc-cell` toujours à la largeur d'une carte complète — vraie cause enfin trouvée grâce à tes captures DevTools. → `--bga-cards_card-width: 167px` (custom property CSS posée en inline par bga-cards sur le conteneur grille, héritée par tout ce qu'il y a dedans) pilote la taille réelle en interne — c'est CETTE variable que bga-cards lit partout, pas les propriétés `width` qu'on bataillait dessus depuis 6 tours (cellule, carte, face interne pouvaient toutes recalculer leur propre taille à partir d'elle, peu importe ce qu'on forçait individuellement). Corrigé à la source : `.bc-grid { --bga-cards_card-width: 83.5px !important; }` — se propage par héritage à tout ce qui est dans la grille en une seule fois, hauteur (`--bga-cards_card-height`) non touchée comme demandé. Gardé en plus (filet de sécurité, pas retiré) les forçages JS/CSS des tours (29)/(30) au cas où certains éléments internes ne dérivent pas de cette variable.

**Pas testé en Studio — mais cette fois la cause est confirmée par inspection réelle, pas déduite.**

## [Terminé] 26/09 (30)

[x] Mobile grille, toujours pas bon (5e round) — "force la réduction comme sur les frontières". → Le forçage JS du (29) ne réduisait que `.bc-card`, pas `.bc-cell` (la case/slot elle-même) — or côté frontière, C'EST LE CONTENANT (`.bc-flank-cell`) qui est réduit en premier, la carte suit. `_watchMobileGridCardWidth()` force maintenant aussi `.bc-cell`/`[data-slot-id]` (largeur + `overflow:hidden`) en plus de la carte, avec le même mécanisme (écriture JS séquentielle + MutationObserver, gagne toujours peu importe ce que bga-cards pose).
[x] Gemmes+enragé des adversaires débordent du cadre. → Bug réel trouvé, indépendant du mobile : `.bc-footer-extras` (zone gemmes+rage+dé) a une largeur calculée à partir de `--gauge-w`, une variable posée UNIQUEMENT sur mon propre plateau (`_sizeGauges()` ne mesure que ma grille à moi, la seule avec des frontières/jauges). Pour un adversaire, `--gauge-w` est absente → repli sur 0px → largeur figée à 181px, trop étroite pour son contenu réel (gemmes+rage+dé ≈ 288px) → débordement visible sur TOUS les plateaux adverses, en permanence (pas spécifique au mobile, juste jamais remarqué avant). Corrigé : la largeur calculée sur `--gauge-w` ne s'applique plus qu'au plateau réellement flanqué de jauges (nouvelle classe `.bc-my-board`, posée en JS uniquement sur `isMe`) ; les autres plateaux utilisent `width:auto` (s'ajuste à son propre contenu, ne peut plus déborder).

**Pas testé en Studio.**

## [Terminé] 26/09 (29)

[x] Mobile, bulles de résolution + jetons dans la grille, toujours pas bons après 3 tentatives CSS. → Suivi ta piste ("le contenant fonctionne bien réduit de moitié côté frontière, fais pareil côté grille") : abandonné le combat CSS `!important` contre bga-cards (qui gère la taille de la carte de grille via son propre style inline, et continuait apparemment de gagner peu importe nos règles) — remplacé par un forçage en JS direct (`_watchMobileGridCardWidth()`), qui réécrit `cardEl.style.width` (et celle de sa face interne `.card-side`) juste après la pose de CHAQUE carte dans la grille, via un `MutationObserver` sur `.bc-grid` (même patron que celui déjà utilisé juste au-dessus pour assigner les ids de case). Une réécriture JS séquentielle du style inline gagne toujours, peu importe qui a écrit avant et avec quelle importance — plus fiable qu'une bataille de spécificité CSS. Couvre F5 (cartes déjà présentes) et toute pose ultérieure, quel que soit l'endroit du code qui la déclenche.
[x] Tooltip : "Enraged:" surligné en rouge. → Ajouté dans `_effectWithTokenIcons()` (déjà le point de passage pour tout enrichissement HTML du texte d'effet, tooltip uniquement).
[x] Remplacer "Always" par "In all cases" partout. → 4 occurrences dans `_influenceEffectDesc()` (1:6, 2:1, 2:3, 3:2). Rien trouvé ailleurs dans le texte joueur (juste des commentaires de code, pas concernés) ni dans `docs/`.
[x] Effets en boîte de résolution : "+X pwr" au lieu de "+X str". → Le texte affiché dans les bulles de combat vient de `CardEffects.php` (`effect_text`, généré serveur), pas du JS. 32 occurrences remplacées (`\bstr\b` → `pwr`, `strength_bonus` non touché — vérifié).

**Pas testé en Studio.**

## [Terminé] 26/09 (28)

[x] Mobile : bulles de résolution + placement des jetons dans la grille, toujours pas bons (le fix (27) `!important` n'a pas suffi — 3e symptôme lié au même chantier). → Changement de méthode plutôt que 4e patch ciblé : le "rognage par translate" (carte gardée à 167px, translatée -83.5px, coupée par le débordement caché de `.bc-cell`) continuait de perdre contre du style posé par bga-cards sur la carte gérée, peu importe l'`!important`. Passé la grille sur la MÊME méthode que les frontières (déjà confirmées bonnes) : `.bc-card` réellement réduit à 83.5px (plus de translate), et — nouveau, probablement la vraie cause de l'ancien bug de "chevauchement" du (25) — ses divs internes `.card-side` (face avant/arrière posées par bga-cards) forcées aussi à `width:100%;height:100%` en plus, au lieu de rester bloquées à leur taille fixe pendant que seul le conteneur externe rétrécissait. Carte et case font maintenant exactement la même taille (comme aux frontières), donc tout ce qui est ancré sur `.bc-cell` (badges, jetons) s'aligne automatiquement, sans calcul séparé à resynchroniser. Supprimé au passage : le décalage `left:50%` du bandeau de traits et les keyframes de wobble mobile dédiées (`bc-card-activate-mobile`) — plus nécessaires avec cette méthode.
[x] Tooltip : remplacer les icônes textuelles de jetons par les vraies images. → Nouveau `_tokenIconHtml()` (icône 18×18, même feuille de sprite que `.bc-token` à l'échelle 0.3) + `_effectWithTokenIcons()` qui repère `token ±N` (jeton flambeur, valeur exacte connue au moment de la génération) et `[Gold] token` (jeton or pirate, type sans valeur) dans le texte et les remplace par l'icône. Appliqué uniquement dans le tooltip (`_cardTooltipHtml`), pas dans `_influenceEffectDesc`/`_bronzeClarification` eux-mêmes — ces fonctions servent aussi le texte brut de la barre de statut, qui ne peut pas afficher du HTML.
[x] Tooltip : nom en gras, traits en gras+italique, instructions bronze en italique (déjà le cas pour ces dernières, rien à changer). → Nom enveloppé dans un `<strong>` séparé (seule la force ⚔ l'était avant) ; traits enveloppés dans `<strong><em>`.

**Pas testé en Studio.**

## [Terminé] 26/09 (27)

[x] Mobile : réduire les jetons de 50%. → `.bc-token{transform:scale(0.5);transform-origin:top right}` en mobile — l'ancre (`top:3px;right:3px`, posée par jeton en inline) ne bouge pas, le jeton rétrécit depuis son coin haut-droit.
[x] Mobile : tooltip illisible (texte trop petit) + réduire l'illustration à 50%. → Texte 12px→16px. Illustration : ramenée à sa taille native 1x (167×119, au lieu du zoom ×2 habituel de 334×238) — **choix fait : réduction de TAILLE, pas un rognage** (contrairement au rognage droite/50% des cartes de grille/frontière) : pour un tooltip dont le but est justement de bien voir la carte, masquer la moitié de l'image semblait contre-productif ; la réduire libère de la place pour le texte, ce qui correspond à la raison donnée ("pas lisible"). Dis-moi si tu voulais en fait un rognage (comme la grille) plutôt qu'une réduction — c'est un point d'interprétation, pas une certitude.

[x] Bulles de résolution mal centrées dans la grille (frontières OK) — résolu après question posée (mobile uniquement, décalage vers la droite). → Cause trouvée : `.bc-cell .bc-card { transform: translateX(-83.5px); }` (le rognage droite/50% posé en (25)) n'avait pas de `!important`. bga-cards peut poser son propre `transform` inline sur la carte gérée (centrage interne, rotation de flip) — sans `!important`, notre translate de rognage perdait ce combat silencieusement, la carte affichait alors une tranche différente de celle prévue (décalée), pendant que le badge (positionné uniquement par rapport à `.bc-cell`, non affecté) restait lui bien centré sur la case — d'où l'impression de badge décalé, alors que c'est la carte qui glissait. Ajouté `!important`.

**Pas testé en Studio.**

## [Terminé] 26/09 (26)

[x] Mobile : traits invisibles (centrés sur 100% de la carte, pas sur les 50% affichés). → Confirmé : le bandeau de traits est un enfant de `.bc-card` (167px natif, non redimensionné, juste translaté -83.5px pour n'en montrer que la moitié droite) — `left:0;right:0` (règle de base) le centre sur les 167px COMPLETS, donc son centre visuel tombe dans la moitié GAUCHE cachée. Ajouté `left:50%` en mobile (le bandeau ne couvre plus que card-local [83.5,167], soit exactement la moitié droite visible) — son propre centrage interne tombe alors bien dans la fenêtre visible.
[x] Mobile : blocs bleus de résolution (badges d'effet) pas centrés sur les emplacements de grille. → Le badge lui-même est enfant de `.bc-cell` (correctement réduite à 83.5px, donc déjà bien centré en soi) — la vraie cause est ailleurs : l'animation "wobble" (`.bc-card-activating`, déclenchée à CHAQUE résolution, donc pile au moment où le badge apparaît) a des keyframes qui écrivent `transform:translateX(0) rotate(...)` codé en dur — pendant ces 0.3s, ça écrase notre `translateX(-83.5px)` de rognage et la carte saute brièvement à sa position complète (non rognée), pendant que le badge (lui non affecté, ce n'est pas `.bc-card`) reste immobile → décalage visuel exactement au moment de la résolution. Nouveau `@keyframes bc-card-activate-mobile` (mêmes wobbles, mais translateX recalé sur la base -83.5px) + `.bc-cell .bc-card-activating{animation-name:bc-card-activate-mobile}` en mobile.
[x] Tooltips : léger décalage, bout de la carte suivante visible. → Vrai bug (pas spécifique mobile) : l'aperçu de tooltip agrandi 2x codait en dur `width:344px`, mais la carte native fait 167px → ×2 = 334px, pas 344 (10px de trop). Ce 10px de large en trop, avec le fond ancré à gauche, laissait déborder le début de la carte suivante de la feuille de sprites sur la droite. Corrigé 344→334.

**Pas testé en Studio.**

## [Terminé] 26/09 (25)

[x] Mobile, cartes de grille toujours décalées/chevauchement (le fix (24) n'a pas suffi). → Vraie cause : forcer la largeur de `.bc-card` lui-même (167px→83.5px) entrait en conflit avec la structure interne de bga-cards (faces avant/arrière positionnées en absolu + potentiellement un flip 3D), d'où le chevauchement — exactement la carte qui n'avait pas ce souci (frontière, HTML brut sans bga-cards) confirme le diagnostic. Changé d'approche pour la grille uniquement : on ne touche plus à `.bc-card` (garde ses 167px natifs, tout son mécanisme interne intact) — on rétrécit juste la case (`.bc-cell`) et on translate la carte de -83.5px vers la gauche dedans (`justify-content:flex-start` + `transform:translateX(-83.5px)`), la case (`overflow:hidden`) ne laissant voir que sa moitié droite. Carte affichée à l'identique du desktop (sprite, flip), juste rognée par la case. Les frontières gardent l'ancienne méthode (rétrécir+décaler le sprite), qui marchait déjà.
[x] Mobile : valeurs de jauge centrées (horizontal+vertical) + gras. → `.bc-gauge-tick::after` : `right/bottom` → `top:50%;left:50%;transform:translate(-50%,-50%)`, `font-weight:bold` ajouté.
[x] Mobile : traits sur cartes de grille en 2 lignes sans séparateur (toujours aligné en bas). → Les traits étaient un seul texte joint par " · ". Remplacé par un `<span>` par trait (le séparateur devient un `::before` CSS sur les spans non-premiers, `content:" · "` par défaut) — permet à la media query mobile de juste faire `content:none` sur ce `::before` et passer le conteneur en `flex-direction:column` pour les cartes dans `.bc-cell` uniquement. L'alignement bas ne change pas (le bloc garde son `bottom:3px`, il grandit juste vers le haut avec 2 lignes). Les frontières n'affichent pas ce bandeau de traits actuellement (jamais implémenté pour elles) — rien à faire là-bas pour ce point.
[x] Tooltips bronze : ajout des clarifications entre parenthèses (colonne `texte_italique` de `cartes.csv`, présentes uniquement sur les 6 cartes Bronze — Silver/Gold ont du texte d'ambiance aux guillemets à cet endroit, pas une clarification de règle, donc volontairement pas repris). Mécanisme codé (`_bronzeClarification()`, ajouté en italique sous l'effet dans `_cardTooltipHtml()`, seulement si `card.type===1`). Traductions validées (1 correction : Troll → "In all cases" au lieu de "Always") :

- High Roller : "(Die: roll the die.)"
- Amateur : "(Trait: Gambler or Mastery for this card.)"
- Cabin Boy : "([Gold] token: this card now counts as a [Gold] card.)"
- Freebooter : "(A face-down card loses its tokens, has strength 0, and adds no power.)"
- Berserker : "(Strength: the value printed at the top of the card.)"
- Troll : "(\"In all cases\": applies whether your card is at the center or on a border.)"

**Pas testé en Studio.**

## [Terminé] 26/09 (24)

[x] Mobile : cartes de grille ne se coupent pas (OK aux frontières). → Cause trouvée : `.bc-cell` (case de grille) ET `.bc-card` (carte) géré par bga-cards sont dimensionnés en INLINE par la lib elle-même (`SlotStock`/`CardManager` reçoivent `cardWidth`/`cardHeight` et posent `style.width` directement) — une règle CSS de classe, même dans la media query, ne peut pas battre un style inline. Les cartes de frontière (`_cardHtml()`, du HTML brut sans passer par bga-cards) n'ont pas cet inline, d'où la différence. Ajouté `!important` aux 2 règles mobiles concernées (`.bc-cell`/`.bc-flank-cell` et `.bc-cell .bc-card`/`.bc-flank-cell .bc-card`) — même remède déjà utilisé ailleurs dans le fichier pour la même raison (cf. commentaire existant sur `.bc-grid{display:grid !important}`).
[x] Mobile : bc-player-board doit prendre toute la largeur. → `_sizeGauges()` pose une largeur fixe en px (inline, calculée pour aligner mon plateau avec flancs) sur TOUS les plateaux (cf. (23)). Ajouté `.bc-player-board{width:100% !important}` en mobile pour la neutraliser.
[x] Mobile : jauge de puissance doit être graduée 1 (bas) → 10 (haut). → La graduation n'existait que sur l'image `boards.png`, qu'on retire justement en mobile (23). Ajouté un compteur CSS (`counter-reset`/`counter-increment` sur `.bc-gauge-track`/`.bc-gauge-tick`) + une ligne de séparation par graduation ; comme le conteneur est en `column-reverse`, le 1er tick du DOM (déjà construit en 1er) tombe visuellement en bas — la numérotation 1→10 dans l'ordre du DOM correspond donc bien à bas→haut sans rien changer côté JS.
[x] Mobile : boîtes de résolution bleues (badges d'effet) doivent wrapper si elles dépassent. → Largeur fixe 155px (pensée pour la carte desktop 167px) dépassait largement la case de grille mobile (83.5px). Réduite à 80px (`max-width`) en mobile — le texte wrappait déjà par défaut, il manquait juste une largeur qui tienne dans la case.
[ ] Mode spectateur, erreur PHP en tournoi (`ModuleDbObject->masterNodeRequest` depuis `GamePageView->generate_content`). → **Point ouvert, pas de correctif appliqué.** La stack ne contient AUCUNE frame de notre code (`Game.php`/`States/...`) — l'appel à `masterNodeRequest` part directement de `generate_content` (framework BGA), donc soit c'est un problème côté plateforme/infra du déploiement tournoi, soit l'erreur affichée est tronquée avant d'atteindre nos frames. Dis-moi : ça arrive à quel moment précis (ouverture du lien spectateur, un clic particulier, juste au chargement) ? Et est-ce que ça arrive aussi en Studio normal ou seulement sur ce serveur de tournoi ? Sans ça je ne peux pas cibler un fix côté jeu avec confiance.

**Pas testé en Studio (ni le mobile, ni le spectateur).**

## [Terminé] 26/09 (23)

[x] Le bc-player-board des autres joueurs doit être de la même largeur que le mien. → Mon plateau a des flancs+jauges (`.bc-grid-with-flanks`) que les autres n'ont pas, donc plus large. `_sizeGauges()` mesure maintenant la largeur réelle de mon plateau une fois rendu et l'applique en `style.width` à tous les autres `.bc-player-board` (ajout de `box-sizing:border-box` pour que cette largeur soit bien la largeur totale, pas juste le contenu) ; `.bc-grid-container` centre sa grille (`align-items:center`) pour que le contenu reste centré dans ce plateau élargi au lieu de coller à gauche.
[x] Le mode spectateur ne fonctionne pas. → Vrai bug trouvé : pour un spectateur, `current_player_id` (et le fallback `bga.player_id`) valent 0 — ni l'un ni l'autre n'est un vrai id joueur. Le code retombait alors sur `allPids[0]` (le 1er joueur de la partie) comme si le spectateur ÉTAIT ce joueur — or tout le reste du code (main privée, grille, actions) gate déjà correctement sur `if (!this._myPid) return`, ces gardes étaient donc toutes défaites pour rien. Pire : ce fallback cassait aussi le calcul de l'ordre des joueurs (`indexOf` sur un id qui pouvait retomber sur le mauvais siège), ce qui pouvait carrément faire disparaître le plateau d'un des vrais joueurs de l'affichage du spectateur. Corrigé : `_myPid` reste `""` pour un spectateur (les gardes jouent enfin leur rôle) ; un `anchorPid` séparé (1er siège de la partie) sert uniquement à décider quel plateau afficher en premier / avec flancs+jauges, et `_gaugeAnchorPid()` (nouveau) donne aux jauges un point de repère pour le suivi "mine/theirs" même sans vrai `_myPid`.
[x] Affichage mobile (4 points du TODO, un seul lot) — objectif : faire tenir grille + frontières rivales en largeur. Media query `@media (max-width:700px)` ajoutée (**seuil choisi arbitrairement**, dis-moi s'il ne colle pas à un vrai test sur device) :

- Deck masqué (`.bc-footer-deck{display:none}`).
- Gemmes+rage passent sous la main (`.bc-board-footer` en colonne, `order` sur les 2 zones restantes).
- Cartes de grille/frontière : n'affichent que la moitié droite du sprite, hauteur inchangée. A nécessité un petit changement de plomberie : le `background-position` des cartes (posé en inline literal un peu partout) ne peut pas être surchargé par une media query (l'inline gagne toujours) — remplacé par 2 custom properties `--sprite-x`/`--sprite-y` (posées en JS dans `setupFrontDiv`/`setupBackDiv`/`_cardHtml`, qui couvrent main+grille+frontières+pioche — pas touché les options d'upgrade ni le tooltip agrandi, hors du périmètre demandé), lues par `.bc-card-sprite{background-position:var(--sprite-x) var(--sprite-y)}` ; la media query surcharge juste `background-position-x` en `calc(var(--sprite-x) - 83.5px)` pour les cartes dans `.bc-cell`/`.bc-flank-cell` uniquement (main/pioche/tooltip non affectés).
- Jauges + jetons : images retirées en mobile, remplacées par des formes CSS pleines (jauge = barre grise unie, marqueurs = ronds de la couleur du joueur via nouvelle `--disc-hex` posée à côté de `--disc-col`, jetons = ronds jaunes unis). **Rendu volontairement simple/provisoire** — dis-moi si tu veux un style précis (formes, couleurs, affichage de la valeur du jeton en texte, etc.), je l'ajusterai.

**Pas testé en Studio, et le lot mobile spécifiquement pas testé sur device/DevTools responsive — à valider en priorité, plusieurs choix (seuil 700px, découpe 50/50 des cartes, rendu CSS des jauges/jetons) sont des paris raisonnables plutôt que des certitudes.**

## [Terminé] 26/09 (22)

[x] Fin de draft : la dernière carte flip en même temps que la première au lieu de flipper en dernier dans toute la séquence. → `notif_silverLastCardReceived()` la flippait face cachée dès son arrivée dans le deck (juste avant `notif_silverDraftComplete`). Or elle est la dernière carte ajoutée à la pile (dernier index du tableau du stock), et `notif_silverDraftComplete()` flip déjà TOUTES les cartes de la pile dans l'ordre du tableau, décalées de 100ms — elle aurait donc naturellement flip en dernier. Retiré le flip prématuré : elle reste face visible jusqu'à la séquence commune, qui la flip alors correctement en dernier.
[x] Retirer le compteur du deck de draft. → Le label `Deck (N)` affichait le nombre de cartes empilées ; changé en simple `Deck` statique (`_updateFanLabel()` et ses 3 appels supprimés, devenus inutiles).
[x] Infobulle sur les cartes du deck de draft. → Ni `_buildDeckFan()` (pile initiale), ni `_confirm()` (carte gardée qui rejoint la pile), ni `notif_silverLastCardReceived()` (dernière carte) ne posaient de tooltip sur ces cartes. Ajouté `addTooltipHtml` aux 3 endroits, même pattern que la main.
[x] Disposition : deck à gauche / main au centre / gemmes+extras à droite, largeurs alignées sur les colonnes frontière+jauge de la grille au-dessus. → Les 2 anciennes lignes empilées (`bc-components-row` puis `bc-hand-row`) remplacées par une seule `bc-board-footer` à 3 zones (`bc-footer-deck` / `bc-footer-hand` / `bc-footer-extras`). Largeur des zones gauche/droite : `calc(173px + var(--gauge-w) + 8px)` (largeur de case + jauge + gap) — `--gauge-w` était déjà posé par `_sizeGauges()` sur les gauges elles-mêmes mais pas remonté jusqu'à la racine du plateau (les variables CSS ne remontent pas aux frères) ; ajouté `grid.closest('.bc-player-board')?.style.setProperty('--gauge-w', ...)`. Le deck-pile (`_buildHand()`) cible maintenant directement `#bc-footer-deck-{pid}` au lieu de s'insérer en tête de l'ancienne `bc-hand-row`.

**Pas testé en Studio.**

## [Terminé] 26/09 (21)

[x] Fin de draft : le bloc bc-draft-deck reste affiché. → Le (20) l'avait replié (fold de hauteur) mais la suppression réelle du bloc était toujours différée à `notif_handDealt` (au tout début du Deploy suivant), donc il restait visible plié pendant toute la transition. Déplacé toute la séquence (wobble de mélange + fondu + suppression) directement dans `notif_silverDraftComplete()`, juste après le fold — `notif_handDealt` n'a plus rien à faire à ce sujet, branche retirée.
[x] Cartes de main centrées par rapport à `.bc-player-board` (alignement avec la grille). → `.bc-hand-row` : `justify-content: center` ajouté (le board est en colonne flex, donc `justify-content` sur la ligne deck+main contrôle bien l'axe horizontal).
[x] Retirer le nom de carte dans les blocs d'effet affichés sur la carte centrale (influence). → `notif_influenceResolved()` et la restauration F5 : le badge affiche maintenant juste `desc` (`textContent`), plus `<strong>nom</strong><br>`. Le nom reste dans le titre de la barre de statut (pas concerné par la demande, qui visait uniquement l'affichage "sur la carte").
[x] Effet de retournement des cartes rivales à la résolution automatique, en même temps que les cartes joueur. → Les cartes adverses en miroir de frontière (`_updateFlankMirror`) et le bot en solo (`_placeBotCard`) ne faisaient qu'un remplacement instantané de contenu (`innerHTML`), sans animation, alors que la carte du joueur se retourne en 3D via bga-cards au même instant. Nouveau `_flipFlankIn()` (rotateY + fondu, même principe que `_slideFlankIn()` du déploiement) appelé depuis `notif_cardsRevealed()` (multijoueur) et `notif_botCardRevealed()` (solo), au moment exact où `setCardVisible()` retourne ma propre carte.

**Pas testé en Studio.**

## [Terminé] 26/09 (20)

[x] Retirer le bc-deploy-ui. → Précision reçue : je cherchais un bug de fuite vers d'autres joueurs (2 tours passés, question posée) ; en fait le bloc n'a jamais fui nulle part — `beforeend` l'insère juste en dernier enfant de `gameArea`, donc il apparaît en bas de page, sous tous les plateaux joueurs. C'était bien le bon bloc ("Left: — Center: — Right: —"), juste mal placé visuellement, pas un bug de visibilité. Supprimé entièrement (JS : insertion HTML dans `_build()`, `_updateSlotDisplay()` et ses 4 appels, la ligne de teardown ; CSS : `#bc-deploy-ui`/`#bc-deploy-slots`/`.bc-deploy-slot`) — le statut Left/Center/Right restait de toute façon déjà visible via les boutons de la barre de statut et la coloration de la grille.

**Pas testé en Studio.**

## [Terminé] 26/09 (19)

[x] Dos fantômes + carte de droite non cliquable persistants après distribution des 3 cartes de main (draft OK confirmé, seule la distribution posait souci). → Vraie cause enfin isolée : `_buildHand()` appelait `cardManager.setCardVisible(cardObj, true)` (flip vers face visible) SANS l'attendre, puis lisait `getCardElement()` juste après pour poser `.bc-hand-card`/`dataset.cardId`/tooltip. `setCardVisible()` peut remplacer l'élément DOM en cours de flip (déjà vu ailleurs cette session) — sans l'`await`, cette lecture pouvait récupérer le nœud d'AVANT le flip pour la carte dont le flip se termine en dernier (typiquement la dernière traitée par la boucle interne de bga-cards → la carte de droite) : elle restait donc visuellement bloquée face cachée (dos fantôme) ET sans son dataset (donc invisible au listener délégué de clic). Corrigé avec `await Promise.all(...)`. Trouvé et corrigé le même risque (pattern identique, pas encore rapporté) dans `notif_cardsRevealed()`.
[x] Replier le `bc-draft-deck` en fin de draft. → Le conteneur du fan (`bc-draft-fan-{pid}`) gardait sa hauteur pleine (calculée pour l'étalement en éventail via marges négatives) même une fois les cartes empilées visuellement par transform — transform ne réduit pas la boîte de mise en page. Ajout d'une 3e étape dans `notif_silverDraftComplete()` : réduction animée de la hauteur du fan à celle d'une seule carte (`overflow:hidden` + transition sur `height`).

**Reste ouvert** : "retirer le bc-deploy-ui des autres joueurs" — question posée (observateur / en attente / superposé / autre), réponse "Autre chose" sans détail texte associé. Toujours aucun mécanisme trouvé dans le code qui l'afficherait pour un autre joueur (point de création unique, verrouillé par `isCurrentPlayerActive`). Aurais-tu 2-3 mots de plus sur ce que tu vois exactement (ou une capture d'écran) ? Sans ça je risque de deviner un correctif qui ne touche pas au vrai problème.

**Pas testé en Studio** (sauf le point ouvert, qui attend ta réponse).

## [Terminé] 26/09 (18)

[x] Garder affichés les écarts de points sous la jauge, visible même après un F5. → Le (17) les gardait déjà en session, mais uniquement côté DOM (perdu au reload). Ajout du même mécanisme que les badges d'effet (15) : global serveur `gauge_diff_history` (RevealAndResolve.php : `recordGaugeDiffHistory()`, appelée à chaque `combatResolved` — multijoueur et solo), renvoyé par `Game::getAllDatas()`, vidé une fois par manche dans `Upgrade::onEnteringState()`. Côté JS, la logique "calculer + ajouter une ligne" a été factorisée en `_recordGaugeDiffLine()` (partagée entre `notif_combatResolved` en direct et une boucle de restauration dans `setup()` qui rejoue l'historique dans l'ordre).
[x] Fin de phase de draft : images rémanentes de dos de cartes — bug persistait après le (17). → Trouvé une DEUXIÈME source du même problème : `notif_silverCardsReceived()` (les 2 cartes non choisies qui glissent vers le joueur suivant) posait `translateX(-80px)` + `opacity:0` sur ces cartes puis ne les réinitialisait jamais avant `handStock.removeAll()`. Or ces mêmes cartes repassent par d'autres joueurs puis reviennent parfois (la dernière carte du draft rejoint un deck) — bga-cards réutilisant le même élément DOM, elles réapparaissaient décalées de -80px, un jeton fantôme de dos de carte. Nettoyage ajouté au même endroit que les 2 autres fois (11)/(17).
[x] Noms de cartes obsolètes dans les notifs serveur (ex : "Rampart" au lieu de "Defender"). → `CardEffects::getName()` lit `$DATA[...]['name']`, qui n'avait pas suivi le renommage GLOSSARY.md appliqué côté JS (`_cardName()`) lors de la refonte Lot E. Comparé les 2 tables entièrement : **11 noms désynchronisés** trouvés et corrigés dans `$DATA` (pas que l'exemple donné) : Gambler→High Roller, Rover→Freebooter, Muscle Man→Goon, Rampart→The Defender, Bookmaker→Bookie, Lucky→Lucky Dog, Croupier→Dealer, Patron→Benefactor, Sapper→Bombardier, Plunderer→Raider, Shockfang→Shock Fang (espace). Vérifié contre `docs/CARD_EFFECTS.md` (source de vérité), qui utilisait déjà les noms JS partout — donc JS/docs étaient corrects, seul `$DATA`'s `name` PHP était à jour uniquement pour `force`/`traits`/`eclair`, pas pour l'affichage. Au passage : trouvé et supprimé un fichier `CardEffects.php.tmp.12504.89e0beb2f08d` (résidu, ni suivi par git ni référencé nulle part, contenait l'ancienne numérotation pré-refonte).
[x] "Est-ce que je peux gérer des images différentes entre FR/EN ?" → Répondu dans le chat, pas de code touché : oui, possible côté BGA Studio (classe de langue posée par BGA sur le document, ou lecture de la langue courante en JS), mais ça duplique l'asset (2 sprite sheets) et le code de sélection. Dis-moi si tu veux que je l'implémente concrètement, avec quelles images en tête.

**Reste ouvert** : "retirer le bc-deploy-ui des autres joueurs" — je n'ai pas trouvé de mécanisme dans le code qui ferait fuiter ce panneau vers un autre joueur (il n'est inséré qu'une fois, seulement quand CE viewer est actif, et nettoyé à chaque changement d'état/désactivation). Question posée dans le chat pour préciser le symptôme avant de deviner un correctif.

**Pas testé en Studio** (sauf le point ouvert, qui attend ta réponse).

## [Terminé] 26/09 (17)

[x] Fin de phase de draft : images rémanentes de dos de cartes lors de la reformation du deck. → Même famille de bug que le (11)/(16) : `notif_silverDraftComplete()` empile les cartes du fan avec un `transform: translateY(...)` jamais réinitialisé ; `notif_handDealt()` fait ensuite `fanStock.removeAll()` sans nettoyer ces styles inline, et bga-cards réutilise ces mêmes éléments DOM plus tard — ils réapparaissaient décalés/fantômes. Ajout du même nettoyage explicite (transition/transform/opacity) juste avant le `removeAll()`.
[x] Déploiement : ma carte de droite parfois non sélectionnable, F5 résout. → Cause trouvée : `.bc-hand-card`/`dataset.cardId` n'étaient posés qu'une fois à la construction de la main ; bga-cards peut recréer l'élément DOM d'une carte encore en main à chaque mutation du stock (pas seulement celle de la carte déplacée) en repositionnant les cartes restantes — la dernière carte restante (la "carte de droite", celle qui survit le plus de réorganisations) perdait alors sa classe/son dataset, donc invisible au listener délégué. Nouveau `_refreshHandCardAttrs()` qui réapplique classe+dataset+tooltip à toutes les cartes de la main, appelé après chaque mutation (`_assignSlot`, `_returnCardToHand`, arrivée de carte post-mulligan).
[x] Animation de glissement quand l'adversaire dépose sa carte de frontière (depuis la gauche sur mon flanc gauche, depuis la droite sur mon flanc droit). → `_updateFlankMirror()` prend un paramètre `animate`, nouveau `_slideFlankIn()` ; activé uniquement à `notif_cardsDeployed` (pas au reveal, où la carte se contente de se retourner).
[x] Retirer les notifications "Player's Card vs Player's Card". → `notifyCombatStart()` : message passé à `''` (le notify `combatStarted` continue de partir, le client s'en sert juste pour le rythme).
[x] Réduire les images de frontière (jauge + jeton) de 10%. → `_sizeGauges()` : `gridH * 0.8` → `gridH * 0.8 * 0.9`. Le jeton suit automatiquement (taille dérivée de la hauteur de jauge).
[x] Garder affichés les écarts de points sous la jauge, 1 ligne par tour, tour 1 en bas puis empilement vers le haut. → `.bc-gauge-diff` transformé en conteneur (`flex-direction: column-reverse`) au lieu d'une boîte unique réécrite à chaque combat ; `notif_combatResolved()` ajoute maintenant une ligne (`.bc-gauge-diff-line`) au lieu d'écraser le contenu. Elles ne sont plus effacées par `_resetGauges()` (appelé à chaque tour) — nouveau `_clearGaugeDiffHistory()` appelé uniquement à l'entrée en phase d'amélioration (fin de manche).
[x] Retirer les compteurs de cartes Bronze/Silver/Gold en bas de page. → Bloc `#bc-shared-decks` supprimé (JS + CSS), jamais mis à jour après sa création initiale de toute façon (mort après le premier rendu).
[x] Retirer le bloc "Select a card, then choose its border position." en bas. → `<p id="bc-deploy-hint">` supprimé (JS + CSS), le reste de `#bc-deploy-ui` (statut Left/Center/Right) conservé.

**Pas testé en Studio.**

## [Terminé] 26/09 (16)

[x] Fin de phase d'amélioration : les cartes disparaissent dès qu'elles quittent leur case de grille au lieu de voler visiblement jusqu'au deck. → Cause : `.bc-cell` a `overflow:hidden`, donc animer la carte réelle (qui vit dedans) via `transform: translate()` la fait clipper dès qu'elle dépasse les bords de sa case — elle semblait disparaître sur place. Corrigé dans `notif_deckShuffled()` : un clone `position:fixed` (même technique que le ghost de `_placeTokenAnimated`) porte le vol jusqu'au deck, la vraie carte est masquée (`visibility:hidden`) pendant ce temps puis réinitialisée avant réutilisation (main de la nouvelle manche).
[x] Stats table + joueur ajoutées (`stats.jsonc`) :

- **Table** : `cards_gold_total`/`cards_silver_total`/`cards_bronze_total` (rang des cartes en fin de partie, tous joueurs), `score_max`/`score_min`, `gems_spent_total` (upgrade + mulligan + reroll), `mulligans_total`, `points_gambler`/`points_brute`/`points_pirate`.
- **Joueur** : `cards_gold`/`cards_silver`/`cards_bronze` (idem par joueur), `power_max` (puissance la plus haute jamais atteinte), `faction_gambler_cards`/`faction_brute_cards`/`faction_pirate_cards` (sert à lire "faction la plus représentée" — BGA n'a pas de stat catégorielle, donc 3 compteurs plutôt qu'un seul nom de faction). `nombre de mulligan` par joueur existait déjà (`mulligans_used`), pas rajouté en double.
- Cartes par rang/faction + score max/min : calculés une seule fois dans `EndScore.php` en lisant `grid_{pid}` — la partie se termine juste après le combat du tour 3 de la manche 4 (`CheckTurn` saute Upgrade/NextRound pour la dernière manche), donc la grille finale EST la composition de deck à mesurer, pas besoin d'un instantané séparé.
- `power_max` : suivi dans `notifyCombatEffect()` (`RevealAndResolve.php`, seul point qui reçoit `$pid` + force finale pour un vrai joueur, en multijoueur et en solo).
- `gems_spent_total` : posé aux 3 endroits qui déchargent effectivement une gemme (`Deploy::actMulligan`, `UpgradeMain::actSpendGem`, `UpgradePickReplacement::actRerollOptions`).
- **`points_gambler`/`points_brute`/`points_pirate`** : portée volontairement limitée aux bonus VP directs d'effet de carte (Werewolf +3VP, Lady Fortune +1VP/carte or, etc.) — PAS aux points d'écart de combat de frontière (une marge entre 2 cartes de factions potentiellement différentes n'est pas clairement attribuable à l'une ou l'autre). Si tu veux aussi les points de combat comptés par faction, dis-le, ça demande de faire remonter la faction jusqu'à `scoreBorder()` (actuellement il ne reçoit que les résultats d'effet, pas les cartes).

**Pas testé en Studio.**

## [Terminé] 25/09 (15)

[x] Le Bouncer ne se déclenche pas au centre. → Vérifié : comportement attendu, pas un bug. Le Bouncer est une carte "carte rivale" (bonus si force du rival > 2) ; au centre (phase influence) il n'y a pas de rival (`$rivalCard = null`), donc l'effet n'a rien à évaluer — même chose pour toute autre carte basée sur `$rivalCard`. En creusant j'ai trouvé un vrai bug lié : le badge d'influence retombait sur le TEXTE GÉNÉRIQUE de la règle de la carte (`_influenceEffectDesc()`, normalement réservé à l'infobulle statique) dès que `effect_desc` valait le sentinel serveur "—" (= "aucun effet"), donc le Bouncer au centre affichait quand même "Rival strength > 2 → +6 power" comme si ça s'était produit. → `_influenceBadgeParts()` corrigé pour ne retomber sur le texte générique que si `effect_desc` est réellement absent (comme `_combatBadgeText()` le fait déjà) et pas sur le sentinel "—".
[x] Phase d'amélioration, choix 1 carte parmi 3 : sélection à une seule carte à la fois qui semblait cassée + boutons Left/Center/Right qui refuyaient encore. → Cause commune trouvée : le listener délégué posé sur `bc-hand-area-{pid}` par Deploy (ajouté au tour (13) pour fixer les cartes de main parfois non cliquables) matchait n'importe quel `.bc-card`, or `UpgradePickReplacement` affiche ses 3 options de remplacement dans ce même conteneur — chaque clic sur une option déclenchait donc EN PLUS la logique de sélection de Deploy (`_selectCard` avec un `cardId` invalide → `_showSlotButtons()` affichait Left/Center/Right, et la sélection de Deploy interférait visuellement avec la sélection propre d'`UpgradePickReplacement`). Corrigé : le listener délégué de Deploy ne matche plus que `.bc-hand-card` (classe posée uniquement sur les vraies cartes de main de Deploy), plus `.bc-card` générique.
[x] Bouton pour relancer les 3 options de remplacement (upgrade), coût 1 gemme, masqué si plus de gemme chargée. → Nouvelle action `actRerollOptions()` dans `UpgradePickReplacement.php` : décharge 1 gemme, retourne les 3 options courantes dans leur pile partagée (réutilise `returnOptionsToPile()`), retire 3 nouvelles cartes de la même pile (même rang cible que `Upgrade.php`), notifie `upgradeOptionsRerolled` avec les nouvelles options — reste dans le même state (pas de transition). `getArgs()` renvoie maintenant aussi `gems_charged`. Côté JS : bouton "Reroll (1 gem)" affiché seulement si `gems_charged > 0` (`_updateRerollButton()`), nouveau `notif_upgradeOptionsRerolled` qui reconstruit le panneau d'options comme à l'entrée du state.
[x] Soucis d'affichage persistants avec les jetons multiples. → Bug trouvé : l'id DOM de chaque jeton (`bc-token-{pid}-{pos}-{n}`) utilisait le NOMBRE de jetons actuellement sur la case comme suffixe — si un jeton est retiré puis un autre ajouté (rassemblement, cartes qui déplacent les jetons), le nouveau pouvait recycler le même id qu'un jeton encore présent (2 éléments DOM avec le même id), cassant le ciblage de l'infobulle pour l'un des deux. Corrigé : suffixe basé sur un compteur strictement croissant (`_tokenSeq`) au lieu du décompte live de la case, dans `_placeToken()` et `_placeTokenAnimated()`.

**Pas testé en Studio.**

## [Terminé] 25/09 (14)

[x] Écart de quelques px entre la jauge et la position de repos du disque. → `.bc-gauge-marker` : `bottom: -10%` → `calc(-10% - 4px)`.
[x] Affichage de l'écart de puissance sous la position de repos des disques (pas juste sous la jauge). → `.bc-gauge-diff` avait `margin-top` insuffisant : le disque déborde déjà sous la jauge de `-10%` + sa propre hauteur, la boîte pouvait chevaucher le disque au repos. `margin-top: calc(var(--disc-size) * 2 + 4px)` ajouté (couvre le débord + la hauteur du disque). `--disc-size` est posé par JS sur `#bc-gauge-{side}` uniquement (une variable CSS ne remonte pas aux frères) ; ajouté aussi sur `.bc-gauge-col` (le parent commun) dans `_sizeGauges()` pour que `.bc-gauge-diff` puisse la lire.
[x] Jetons rassemblés sur une carte (Tricheur/Poker Face) : décalage insuffisant pour les différencier + pas d'animation de déplacement lors de l'absorption. → 2 causes distinctes : (1) le rendu principal (`_placeToken`) utilisait déjà le décalage horizontal 50% depuis le (11), mais le **rebuild du miroir de frontière** dans `notif_tokensSyncPlayer()` était resté sur l'ancien décalage vertical (`top: i*40`), jamais mis à jour — corrigé pour matcher (`right: i*30`, `top` fixe). (2) Une resynchro qui contient à la fois des jetons retirés ET ajoutés (signature d'un effet de rassemblement) faisait disparaître les anciens vers le haut puis réapparaître les nouveaux depuis le haut de l'écran — remplacé par une animation de convergence (les jetons retirés glissent visuellement vers la carte cible avant de disparaître), pour que l'absorption se lise comme un seul mouvement.
[x] Bug : sélectionner une carte en phase d'amélioration affiche les boutons Left/Center/Right Border de la phase de déploiement. → Regression du fix (13) sur la grille : le listener délégué posé sur `bc-grid-{pid}` par Deploy (permanent, jamais retiré puisque le conteneur de grille est réutilisé entre les phases) reçoit aussi, par bubbling, les clics destinés aux cartes centrales de la phase d'amélioration (le listener direct d'`UpgradeMainState` sur la carte ne stoppait pas la propagation). Corrigé : `e.stopPropagation()` ajouté au listener de clic d'`UpgradeMainState` sur les cartes centrales.

**Pas testé en Studio.**

## [Terminé] 25/09 (13)

[x] Mulligan possible sur une carte de ce round déjà posée (non confirmée) et sélectionnée sur la ligne, en plus des cartes en main. → Serveur (`actMulligan`) exige `card_location = 'hand'` ; or une carte "posée" ce tour n'est déplacée qu'en client (le déplacement réel en base n'a lieu qu'à `Confirm`/`actDeployCards`), donc mulligan une carte affichée sur la grille est déjà légal côté serveur. `_updateMulliganButton()` : condition `rowEmpty` retirée (ne restait plus que gemme chargée + tour < 3 + carte sélectionnée). `_doMulligan()` : si la carte sélectionnée avait un slot assigné, il est libéré avant `actMulligan`. `notif_mulliganCard()` : cherche la carte défaussée dans `gridStock` OU `handStock` (au lieu de seulement `handStock`) pour l'animation flip+retour au deck.
[x] Renvoyer les jetons de puissance à zéro après le calcul des points. → Ajout de `_resetGauges()` en fin de `notif_combatResolved()` (VP déjà attribué serveur à ce moment) — ne plus attendre le prochain reveal/l'entrée en Upgrade pour l'annulation visuelle.
[x] Cartes parfois non sélectionnables en main pendant le déploiement. → Même famille de cause que le fix (12) sur la grille : `.onclick` posé une fois sur un nœud DOM que bga-cards peut recréer plus tard (deal initial, retour depuis la grille, pioche mulligan) perd le listener. Remplacé par un listener délégué unique sur `bc-hand-area-{pid}` (posé dans `_build()`), lu via `dataset.cardId`. Au passage, trouvé et corrigé un `await` manquant dans `_returnCardToHand()` (`handStock.addCard()` non attendu avant de relire l'élément DOM pour poser `dataset.cardId` — même bug que celui déjà corrigé sur `_assignSlot()` au tour précédent, ici sur le chemin retour grille→main) : cause probable et concrète de l'intermittence rapportée.
[x] Affichage temporaire de l'écart de puissance sous la jauge, aux couleurs du gagnant. → Nouvelle boîte `.bc-gauge-diff` sous chaque jauge (`_gaugeHtml()` enveloppé dans `.bc-gauge-col`), remplie dans `notif_combatResolved()` avec `|force gauche - force droite|` et le fond coloré à la couleur du joueur gagnant (gris si c'est le bot), effacée par `_resetGauges()` (donc en même temps que la jauge revient à 0, cf. point ci-dessus).
[x] Réduire le temps de résolution des cartes de colonnes correspondantes (paire en combat, ex: cartes de gauche de chaque joueur). → Pauses de rythme réduites 3000ms → 1500ms sur `notif_combatStarted`, `notif_combatEffectApplied`, `notif_combatResolved` (la pause de `notif_influenceResolved`, hors combat/paire, n'est pas concernée et reste à 3000ms). **Durée choisie arbitrairement** — dis-moi si 1500ms ne va pas, je réajuste.
[x] Conserver les blocs bleus de résolution (badges d'effet) même après un F5. → Ils n'étaient stockés que côté DOM/client, perdus au reload. Ajout d'un global serveur `effect_badges` (RevealAndResolve.php : nouvelle méthode `recordEffectBadge()`, appelée à chaque `influenceResolved`/`notifyCombatEffect`/`notifySoloCombatEffect`), renvoyé dans `Game::getAllDatas()`, vidé une fois par manche dans `Upgrade::onEnteringState()` (même endroit que les jetons). Côté JS, la construction du texte/HTML des badges a été factorisée (`_influenceBadgeParts()`, `_combatBadgeText()`) pour être partagée entre le rendu live (`notif_influenceResolved`/`notif_combatEffectApplied`) et une nouvelle boucle de restauration dans `setup()` (même emplacement que la restauration des jetons au F5).

**Pas testé en Studio.**

## [Terminé] 25/09 (12)

[x] Border radius 5px sur les cartes (deck/main/grille). → `.bc-card` : `10%` (posé au tour précédent) → `5px` fixe, comme demandé cette fois.
[x] Impossible de cliquer sur une carte placée ce tour (non validée) pour la déplacer — "toujours" présent malgré le fix du (9)/`await`. → Cause réelle : `_assignSlot()` faisait `movedEl.onclick = (e) => this._onGridCardClick(e)` sur l'élément DOM courant, mais bga-cards peut recréer cet élément à un mouvement/reflow ultérieur (ex: un autre `addCard` sur la même grille) — l'ancien `await` empêchait juste une lecture immédiate obsolète, pas une perte différée du listener. Remplacé par un listener délégué unique posé une fois sur `bc-grid-{pid}` (dans `_build()`), qui lit `dataset.cardId` au moment du clic au lieu de dépendre d'un `onclick` attaché à un nœud précis — survit à toute recréation d'élément. `_onGridCardClick()` supprimé (fondu dans le listener délégué), `movedEl.onclick` mis à `null` dans `_assignSlot()` (le délégué prend le relai).
[x] Mulligan : ne proposer le bouton que si une carte est sélectionnée ; cliquer dessus mulligan directement la carte sélectionnée (au lieu du mode "clique le bouton puis clique une carte cible"). → `_updateMulliganButton()` conditionne maintenant sur `_selectedCard !== null` (en plus des gardes gemme/tour/ligne vide déjà là), appelé à chaque sélection/désélection dans `_selectCard()`. Nouveau `_doMulligan()` lit `_selectedCard`, lance `actMulligan` dessus, nettoie la sélection. Ancien mode `_mulliganMode`/`_toggleMulliganMode()` retiré entièrement (plus de "clic bouton → clic carte cible" à 2 temps), classe CSS `.bc-mulligan-mode` morte retirée.

**Pas testé en Studio** (le fix de clic est un remplacement de mécanisme, pas juste un patch — à confirmer que ça règle vraiment le "toujours" du bug).

## [Terminé] 25/09 (11)

[x] Jeton Bookie affiché -1 au lieu de -2 (calcul juste, affichage faux). → `_gamblerTokenSprite()` mappait par `Math.abs(value)`, mais les paires physiques partagent une valeur absolue entre elles (abs(4) = à la fois le +4 de la paire -2/+4 ET le -4 de la paire -4/+8 ; abs(2) tombait dans le même bucket "≤2" que abs(1)). Remplacé par une table exacte valeur signée → colonne sprite.
[x] Plusieurs jetons sur la même carte : décalage horizontal avec 50% de recouvrement (au lieu d'un empilement vertical). → `_placeToken`/`_placeTokenAnimated` (+ clones flank) : `top` fixe à 3px, `right` incrémenté de 30px par jeton (30 = 50% de la largeur 60px du jeton).
[x] Border radius 10% sur chaque coin des cartes. → `.bc-card` : `border-radius: 4px` → `10%`.
[x] Fin de phase d'amélioration → nouvelle manche : 3 cartes de main affichées face visible "collées" au deck au lieu d'atterrir en main (F5 corrige). → Cause probable : mêmes ids de carte réutilisés par bga-cards (grille → deck → re-pioche en main), un id resté en dehors de toute stock pendant la manche précédente peut encore porter un `transform`/`opacity`/`z-index` inline d'une animation antérieure jamais nettoyée (même famille de bug que le shuffle de main du (9)). Ajout d'un nettoyage explicite des styles inline sur les ids de la nouvelle main juste avant `handStock.addCards()` dans `_buildHand()`, même remède que celui qui avait déjà réglé le bug de main mélangée. **Pas testé en Studio** — si le symptôme persiste après ce correctif, la cause est ailleurs (dis-le-moi, je creuserai le timing des notifs deckShuffled/handDealt).

## [Terminé] 25/09 (10) — Lot E : Silver + Gold

[x] Refonte complète de `CardEffects.php` `applyEffect`/`applyBotEffect` pour les 18 Silver + 9 Gold (les 2 switch étaient restés sur l'ancienne numérotation, cf. bug Barbare). Chaque carte réécrite ligne à ligne contre `docs/CARD_EFFECTS.md` (déjà vérifié contre `cartes.csv`), pas juste un réarrangement de clés cette fois — plusieurs mécaniques neuves ajoutées (helpers dans `CardEffects.php`) :

- `getRowCards()`, `countEffectiveRankIn()` : comptage par ligne/portée générique (First Mate, Buccaneer, Davy Jones passent en portée colonne/ligne correcte au lieu de "toute la grille").
- `countAllTokens()` : nombre de jetons total (Accomplice, Crazy 6).
- `plusValueOf()` + `gatherAndFlipTokens()` : les jetons rassemblés (Tricheur/Cheater, Poker Face) sont maintenant déplacés **individuellement** et retournés face `+` (ex: un jeton à -2 devient +4, pas juste "abs()") au lieu d'être fusionnés en un seul jeton sommé — corrige un mécanisme qui était faux dans l'ancien code.
- Bombardier (frontière, retourne la carte en dessous, +5/+3/+1 selon rang) : nouvelle logique complète (l'ancienne ne retournait rien, lisait juste le rang).
- Navigateur, Bookie (frontière droite du tour), Cheater/Poker Face (portée ligne+colonne / grille entière) : ciblage correct au lieu de "position suivante".
- Bot (`applyBotEffect`) entièrement resynchronisé sur le nouveau flag éclair (Silver : 3,4,5,6,8,10,13,14,16,17,18 · Gold : 2,4,5,9 — vérifié contre `cartes.csv`), avec adaptations pour le plateau bot (2 colonnes de 3, pas de centre) : Bombardier = toujours "frontière" côté bot ; Navigateur simplifié (jeton sur sa propre position, pas de frontière jumelle côté bot) ; First Mate/Buccaneer scannent tout le côté bot (gauche ou droite) sur ses 3 lignes.

[x] Lucky Dog relance son propre dé (pas la valeur partagée de la table). → Corrigé, `rand(1,6)` propre à la carte (joueur + bot). Nettoyage : `setLastDieRoll()`/`getLastDieRoll()` retirés (plus aucun lecteur).

**Points ouverts à surveiller en test** :

- **Crazy 6** : lance un dé par jeton en jeu (peut être 0 à N lancers) — un seul résultat de dé est remonté au client pour l'animation (le dernier lancé), le calcul de force est correct même si l'animation ne montre qu'un lancer.
- Pas re-testé en Studio (pur remap logique, aucune carte n'a changé de position sprite) — à valider partie par partie, ces 27 effets n'avaient jamais tourné avec les vrais textes/valeurs.

## [Terminé] 25/09 (9)

[x] Bug main mélangée (cartes superposées aléatoirement au-dessus de deck/main/grille, faces correctes, F5 corrige). → Cause trouvée (avec ton détail sur le symptôme) : `notif_deckShuffled()` anime les cartes vers le deck avec des styles inline (transform/opacity/z-index), puis les détache via `removeAll()` — mais bga-cards réutilise le même élément DOM par id de carte. Ces styles restaient donc collés quand la carte réapparaissait dans la nouvelle main. Ajout d'un reset explicite des styles inline juste avant `removeAll()`.
[x] Bronze upgradé direct en Or en un seul clic. → Root cause pas trouvée avec certitude (logique de tirage des options semble correcte à la lecture), donc ajout d'un garde-fou en profondeur plutôt qu'un pari : `orig_rank` mémorisé au moment du `actSpendGem`, revalidé dans `actPickReplacement` (doit être exactement rang+1, sinon exception). Corrigé aussi au passage : les cartes Or ne reçoivent plus d'options d'upgrade (aucune ne devrait, Or = rang max).

**Lot E (Silver + Gold, ~27 cartes) : confirmé pour la prochaine session dédiée** (pas celle-ci) — remap complet contre `docs/CARD_EFFECTS.md`/`cartes.csv`, même traitement que le rattrapage Bronze mais en plus gros (plusieurs mécaniques neuves à écrire : countCards par trait/rang, gather tokens ligne+colonne, flip cartes Or adverses, etc.).

## [Terminé] 25/09 (8)

[x] Dernière carte du draft : ne pas flip avant d'arriver au deck. → `notif_silverLastCardReceived()` réordonné : pause 3s face visible → slide vers le deck → flip face cachée une fois arrivée.
[x] Mulligan : titre restait "Click a card to mulligan it…" après un mulligan réussi. → reset du titre ajouté dans `_onCardClick()`'s branche mulligan.
[x] Sélection carte grille (tour en cours) : ne marchait pas + cartes des tours précédents ne doivent jamais être sélectionnables. → `_assignSlot()` ne `await`ait pas `gridStock.addCard()` avant de récupérer l'élément DOM (élément recréé par bga-cards lors d'un déplacement inter/intra-stock → référence obsolète). Ajout de l'`await`. Garde ajoutée dans `_onGridCardClick()` (`_cardSlot` vide = jamais sélectionnable) + `_confirm()` verrouille les 3 cartes juste soumises (onclick retiré, plus de fuite possible vers les phases Reveal/Upgrade suivantes).
[x] Garder les badges d'effet en permanence (effacés seulement en fin de manche). → Suppression auto (`badge.remove()` après 3s) retirée sur les 2 sites (influence + combat) ; nouvelle `_clearEffectBadges()` appelée dans `notif_upgradeMainEntered` (même point que le reset des jauges).
[x] Retirer l'annonce "⚔ Combat!". → `notif_combatStarted()` ne pose plus le titre (garde la pause de 3s pour le rythme).
[x] Actions "Left Border"/"Right Border"/Center qui fuitaient en phase d'amélioration. → Conséquence directe du bug de sélection ci-dessus (cartes de grille jamais "libérées" après confirmation) ; corrigé par le même verrouillage dans `_confirm()`.
[x] Confirmation si "Flip down for 1 gem" alors que 3 gemmes déjà chargées (action perdue). → `confirm()` natif ajouté en tête de `_onFlipDown()`, seulement quand `_gemsUncharged <= 0`.

**⚠️ Barbare / Silver-Gold** : confirmé même cause que High Roller/Berserker (CardEffects.php pas resynchro), mais PAS corrigé ce tour — c'est le Lot E complet (18 Silver + 9 Gold), plus gros que le rattrapage Bronze fait la dernière fois (beaucoup de mécaniques neuves : countCards, gather tokens, etc., pas juste un réarrangement de clés). Voir ma question.

## [Terminé] 25/09 (7)

[x] Draft : slide gauche+fade pour les 2 cartes non choisies qui passent au joueur suivant (l'entrée depuis la droite existait déjà). → `notif_silverCardsReceived()` : translateY(40px) → translateX(-80px).
[x] Draft : animation de la dernière carte (arrivée en main, pause 3s, flip face cachée, slide vers le deck). → `notif_silverLastCardReceived()` réécrit : arrive en main (slide depuis la droite si multi), pause 3s, `setCardVisible(false)`, puis slide vers le fan. Le shuffle final reste géré par `notif_silverDraftComplete` (pas dupliqué ici).
[x] Bug d'affichage main après shuffle (obligeait à F5). → Cause trouvée : `_buildHand()` pouvait être appelée deux fois en concurrence (onPlayerActivationChange + notif_handDealt arrivent parfois tous les deux pour la même donne), les deux `removeAll()`/`addCards()` se marchaient dessus sur le même stock. Ajout d'un verrou de ré-entrance (`_buildingHand`) qui ignore l'appel concurrent redondant.
[x] Déploiement : cliquer une carte déjà posée dans la ligne du tour pour la déplacer vers un autre emplacement. → Les cartes posées restent maintenant cliquables (`_onGridCardClick`), réutilisent la sélection existante ; `_assignSlot()` corrigé pour chercher la carte dans main OU grille et libérer son ancien slot (bug latent : ne cherchait qu'en main, échouait silencieusement pour un déplacement grille→grille).
[x] Mulligan proposé seulement si aucune carte posée ce tour + gemme chargée. → `_updateMulliganButton()` centralise les 2 conditions, appelé après chaque pose/retour/annulation.
[x] Impossible d'annuler le mulligan. → `_startMulligan` devenu `_toggleMulliganMode()` (re-cliquer le bouton annule), et le bouton Annuler général sort aussi du mode mulligan s'il était actif.
[x] Effet High Roller (carte incorrect). → Cause réelle : `CardEffects.php` `applyEffect`/`applyBotEffect` sont restés sur l'ANCIENNE numérotation des designs (même bug de fond que les tooltips, mais côté logique de jeu cette fois). High Roller (design 1 aujourd'hui) déclenchait l'ancien effet "jeton sur l'emplacement suivant" au lieu de "jeton sur cette carte". Corrigé : jeton posé sur `$gridPosition` (soi-même).
[x] Effet Berserker (carte incorrect, seul dans la colonne). → Même cause : Berserker (design 5) déclenchait l'ancien effet "Cabin Boy" (retourne/charge sur frontière) au lieu de la logique "force la plus grande de la colonne → charge 1 gemme" (cette logique existait déjà et gérait déjà correctement le cas "seul dans la colonne", elle était juste sur la mauvaise clé). Repositionné avec Freebooter (design 4, qui récupère la logique de bordure) — voir note ci-dessous.

**⚠️ Point important** : en corrigeant ces 2 cartes, j'ai remis d'aplomb les **6 cartes Bronze** (High Roller/Amateur/Cabin Boy/Freebooter/Berserker/Troll) — c'était un simple réarrangement de clés déjà présentes, vérifié contre `cartes.csv`. Mais ça confirme que **`applyEffect`/`applyBotEffect` pour Silver (18) et Gold (9) ont très probablement le même problème** (toujours sur l'ancienne numérotation) — pas touché ici, c'est le Lot E déjà prévu à part. Dis-moi quand tu veux qu'on l'attaque, vu que ça bloque probablement pas mal de tests en ce moment.

## [Terminé] 25/09 (6) — bug remonté hors TODO

[x] Tooltip désaligné (ex: image Mécène → tooltip Werewolf, image Pillard → tooltip Buccaneer). → Cause réelle : `_cardName`/`_cardForce`/`_cardTraits`/`_influenceEffectDesc` dans Game.js étaient restés sur l'ANCIEN jeu de cartes (numérotation design pré-refonte CardEffects.php), jamais resynchronisés. Les positions de sprite (`_spritePos`/SILVER_COL/GOLD_COL) étaient correctes — revérifiées en recadrant et relisant `cards_scoundrels.png` en haute résolution par ligne (confirmé conforme). Les 4 tables réécrites intégralement pour correspondre au `$DATA` de CardEffects.php (noms canoniques GLOSSARY.md, force/traits vérifiés vs cartes.csv, effets condensés depuis CARD_EFFECTS.md).

## [Terminé] 25/09 (5)

[x] Autoriser l'infobulle sur les cartes adverses en frontière. → `_updateFlankMirror()` et `_placeBotCard()` posent maintenant `addTooltipHtml` sur la cellule flank (id stable), en plus du rendu carte déjà en place.
[x] Noms des cartes pas alignés avec les images, template de positions. → Lu `app/img/cards_scoundrels.png` directement (pixel par pixel) : Silver/Gold ont un ordre par famille différent de celui supposé par le code (ordre id `cartes.csv`). Nouvelle table vérifiée dans ASSETS.md (`cards_scoundrels.png`) + `Game.js` `_spritePos()` corrigé avec des tables `SILVER_COL`/`GOLD_COL` explicites (remplace le calcul `%6`/`%3` qui était faux). Bronze (rouge/vert/bleu/jaune) confirmé conforme à ce que tu avais déjà précisé.

## [Terminé] 25/09 (4)

[x] Augmenter le décalage des discs : aligner de chaque côté des joueurs. → offset porté à `(gauge-w - disc-size)/2` (flush aux bords), nouvelle var `--gauge-w` posée par `_sizeGauges()`.
[x] Retirer highlight/grisé sur les jetons pendant la résolution (le déplacement suffit). → `_highlightGaugeWinner()` et ses 2 appels supprimés, classes CSS `.bc-gauge-winner`/`.bc-gauge-loser` supprimées, helper mort `_gaugeSideAndWhoFor()` retiré.
[x] Reprendre les nouveaux effets de cartes et corriger le fichier en fonction. → `docs/CARD_EFFECTS.md` vérifié ligne à ligne contre `cartes.csv` : 2 erreurs trouvées et corrigées — Werewolf et Lady Fortune gagnent des **[VP]** (points de victoire), pas du **[power]** ; ajout de l'icône `[VP]` et de l'effet atomique `gainVP(x)` manquants. Reste du fichier conforme au csv.

## [Terminé] 25/09 (3)

[x] Sur chaque frontière, léger décalage entre les deux jetons (le mien vers mon côté, l'adverse vers l'autre). → CSS `#bc-gauge-left/-right .bc-gauge-marker-mine/-theirs` (offset ±0.3×disc-size via transform).
[x] Retirer le highlight en fin de manche sur les jetons. → `_resetGauges()` (qui enlève déjà winner/loser) appelé depuis `notif_upgradeMainEntered`.
[x] À la fin de la manche, une fois les points répartis, les jetons de puissance retournent à zéro. → même appel `_resetGauges()`.
[x] Remplacer les blocs FR par les blocs EN dans le doc des effets de cartes. → `docs/CARD_EFFECTS.md` : colonnes "FR text"/"FR wording"/"FR" supprimées de toutes les tables (EN = source unique désormais).
[x] Tooltip carte : force en gras à gauche du titre (même ligne), traits en dessous, effet en dessous avec police uniforme. → `_cardTooltipHtml()` reformaté (`⚔ force` + nom / traits / effet, `font-size:12px` unique, plus de `<small>`/`<em>`).

## [Terminé] 25/09 (2)

[x] J'aimerais que les jauge de puissance fassent à peu près 80 % de la hauteur de la totalité de la grille. → `_sizeGauges()` mesure la hauteur réelle de la grille au rendu et fixe la jauge à 80% (largeur + sprite recalculés au même facteur d'échelle), rappelé au resize fenêtre.
[x] Laissez un espace pour pouvoir représenter le jeton de puissance (0/+10), toujours visible, au repos sous la jauge à 0, montant d'un cran par point gagné, retourné (+10) au-delà de 10. → `_setGaugeMarker()` ne masque plus le jeton (bottom -10% au repos), disque réel via `--disc-col`/`--disc-size` (taille = 1 cran = hauteur jauge/10), face togglée par `.bc-gauge-over10`.

## [Terminé] 25/09

[x] Implémente les images des frontières (dans boards, dernière position.) Le 1 est en bas, le 10 est en haut. → `.bc-power-gauge` utilise `boards.png` pos.7 (110×450px, offset -1400px), voir ASSETS.md.
[x] J'ai modifié le fichier pour les gemmes, renommé gems_power_discs.png. Il y a dessus les gemmes et les disques qui servent à indiquer la puissance. → CSS/JS gems.png → gems_power_discs.png (8×2), marqueurs de jauge utilisent les disques colonnes 5-8 (face "0"/"+10" via `.bc-gauge-over10`), voir ASSETS.md.
[x] Sur l'ordre des cartes bronze, j'ai changé pour avoir les mêmes ordres partout à savoir : rouge, vert, bleu, jaune → `_bronzeColorIndex()` réutilise `_colorToGemCol()` (même ordre), colonnes cards_scoundrels.png mises à jour dans ASSETS.md.

## [Terminé] 22/05 15h

[x] Lorsque je lance une partie en solo, la phase de Silver Draft consiste à piocher 5 cartes, à en choisir 3 qui rentreront dans le paquet et les 2 autres iront en dessous du deck argent. C'est à implémenter.
[x] Lors d'une partie solo, La résolution commence toujours par la carte d'influence, donc la carte centrale du joueur. Puis, c'est la carte la plus à gauche, donc du flanc gauche qui se déclenche :

- c'est-à-dire celle du bot
- la carte gauche de la grille du joueur
- la carte droite de la grille du joueur
- la carte droite du flanc droit, c'est-à-dire celle du bot

## [Terminé] 20/05 20h

[x] Faire le shuffle de carte via Bga-cards/Stock/Deck/Shuffle
[x] Lorsque je passe sur une nouvelle phase après une phase d'upgrade, le bouton Mulligan n'apparaît pas. Il devrait apparaître Si j'ai au moins une gemme chargée.
[x] Les tout types sur les cartes doivent toujours apparaître, peu importe la situation, sauf quand elles sont face cachée. C'est valable pour toutes les phases du jeu sur les cartes qui sont visibles, c'est-à-dire celles que j'ai en main, celles qui sont sur toutes les grilles, à n'importe quel moment.

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
