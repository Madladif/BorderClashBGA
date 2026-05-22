# Main game logic : Game.php

> Source : https://en.doc.boardgamearena.com/Main_game_logic:_Game.php  
> Dernière modification : 29 avril 2026

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Structure du fichier](#2-structure-du-fichier)
3. [Informations joueurs](#3-informations-joueurs)
4. [Accès à la base de données](#4-accès-à-la-base-de-données)
5. [Globals BGA (tous types)](#5-globals-bga-tous-types)
6. [Globals numériques / options de jeu](#6-globals-numériques--options-de-jeu)
7. [États de jeu et joueurs actifs](#7-états-de-jeu-et-joueurs-actifs)
   - [Joueur actif unique](#joueur-actif-unique)
   - [Joueurs multiples actifs](#joueurs-multiples-actifs)
   - [Fonctions d'état](#fonctions-détat)
   - [États privés parallèles](#états-privés-parallèles)
8. [Actions (autowired)](#8-actions-autowired)
9. [Ordre de tour des joueurs](#9-ordre-de-tour-des-joueurs)
10. [Notifications](#10-notifications)
11. [Randomisation](#11-randomisation)
12. [Statistiques de jeu](#12-statistiques-de-jeu)
13. [Scores et départage](#13-scores-et-départage)
14. [Temps de réflexion](#14-temps-de-réflexion)
15. [Undo](#15-undo)
16. [Erreurs et exceptions](#16-erreurs-et-exceptions)
17. [Mode Zombie](#17-mode-zombie)
18. [Préférences utilisateur](#18-préférences-utilisateur)
19. [Préférences de couleur joueur](#19-préférences-de-couleur-joueur)
20. [Débogage et traces](#20-débogage-et-traces)
21. [Créer d'autres classes PHP](#21-créer-dautres-classes-php)

---

## 1. Vue d'ensemble

`Game.php` est le fichier principal de la logique serveur du jeu. Il initialise la partie, persiste les données, implémente les règles et notifie l'interface client.

> **Important** : l'instance PHP n'est **pas** conservée en mémoire entre deux callbacks. À chaque requête client, une nouvelle instance est créée et le constructeur est appelé.

> **Note :** Le fichier s'appelle maintenant `Game.php`, situé dans `modules/php/`. L'ancien nom `yourgamename.game.php` à la racine est la variante legacy (sans namespaces).

---

## 2. Structure du fichier

| Méthode | Description |
|---|---|
| `__construct` | Constructeur : définition des variables globales et membres de classe |
| `setupNewGame($players, $options)` | Initialisation de la partie. `$players` est indexé par `player_id` (contient `player_name`, `player_canal`, `player_avatar`, flags admin/ai/premium/order/language/beginner) |
| `getAllDatas` | Récupération de toutes les données pour un rechargement complet. Accepte `int $currentPlayerId` ou `int $currentPlayerNo` en paramètre magique |
| `getGameProgression` | Retourne un nombre de 0 à 100 indiquant l'avancement de la partie (utilisé pour le calcul ELO et la concession) |
| `initTable` | Appelé avant tout callback PHP (sauf `arg*`). Cas avancés uniquement |
| `zombieTurn` | Ce qu'il faut faire quand c'est le tour d'un joueur zombie |
| `upgradeTableDb` | Migration de la base de données après déploiement en production |
| `getGameName` | Retourne le nom du jeu (ne pas modifier) |

```php
// getAllDatas : structure obligatoire pour 'players'
$result['players'] = $this->getCollectionFromDb(
    "SELECT `player_id` `id`, `player_score` `score`, `player_no` `no`, `player_color` `color` FROM `player`"
);
// ['players'][$player_id]['score'] est requis pour que les scores s'affichent au F5
```

---

## 3. Informations joueurs

> ⚠️ Distinction cruciale : le joueur **actif** est celui dont c'est le tour. Le joueur **courant** est celui qui a envoyé la requête. Ce ne sont **pas forcément le même**.

| Méthode | Description |
|---|---|
| `getPlayerCount()` | Nombre de joueurs (alias : `getPlayersNumber()`). Ne pas utiliser au début de `setupNewGame` — utiliser `count($players)` à la place |
| `getActivePlayerId()` | ID du joueur "actif" (ne signifie pas qu'il est actif en ce moment si état GAME ou MULTIPLE_ACTIVE_PLAYER). Préférer le paramètre magique |
| `getActivePlayerName()` | Nom du joueur actif. Éviter en état multiactif |
| `getPlayerNameById($player_id)` | Nom par ID |
| `getPlayerNameByNo($playerNo)` | Nom par numéro |
| `getPlayerColorById($player_id)` | Couleur par ID |
| `getPlayerNoById($player_id)` | `player_no` par ID |
| `getPlayerIdByNo(int $playerNo)` | ID par numéro |
| `loadPlayersBasicInfos()` | Tableau associatif `player_id => [player_name, player_color, player_no]`. Mis en cache — appels multiples sans surcoût |
| `getCurrentPlayerId()` | ID du joueur courant (celui qui a envoyé la requête). **Ne jamais utiliser dans `setupNewGame` ou `zombieTurn`** |
| `getCurrentPlayerName()` | Nom du joueur courant. Lève une exception si spectateur |
| `getCurrentPlayerColor()` | Couleur du joueur courant. Lève une exception si spectateur |
| `isCurrentPlayerZombie()` | `true` si le joueur courant est zombie |
| `isSpectator()` | `true` si l'utilisateur est spectateur |

```php
// Obtenir tous les IDs joueurs
$player_ids = array_keys($this->loadPlayersBasicInfos());

// Itérer sur les joueurs
$players = $this->loadPlayersBasicInfos();
foreach ($players as $player_id => $info) {
    $color = $info['player_color'];
}
```

---

## 4. Accès à la base de données

> ⚠️ BGA utilise les **transactions** MySQL. Les changements ne sont appliqués qu'à la fin d'une requête réussie. Lancer une exception annule **tous** les changements et notifications.

> ⚠️ Ne jamais utiliser `TRUNCATE` ou `DROP` — ils provoquent un commit implicite. Utiliser `DELETE FROM xxx` à la place.

| Méthode | Description |
|---|---|
| `DbQuery(string $sql)` | Méthode générique. Pour les SELECT, préférer les méthodes spécialisées ci-dessous |
| `getUniqueValueFromDB(string $sql)` | Retourne une valeur unique ou `null`. Lève une exception si > 1 ligne |
| `getCollectionFromDB(string $sql, bool $bSingleValue=false)` | Tableau associatif `[clé => [champs]]`. La première colonne doit être une clé primaire/unique. Peut être vide (jamais null) |
| `getNonEmptyCollectionFromDB(string $sql)` | Comme `getCollectionFromDB` mais lève une exception si vide |
| `getObjectFromDB(string $sql)` | Une seule ligne en tableau associatif, ou `null`. Lève une exception si > 1 ligne |
| `getNonEmptyObjectFromDB(string $sql)` | Comme `getObjectFromDB` mais lève une exception si aucune ligne |
| `getObjectListFromDB(string $sql, bool $bUniqueValue=false)` | Tableau simple (non associatif) de lignes |
| `getDoubleKeyCollectionFromDB(string $sql, bool $bSingleValue=false)` | Tableau associatif à deux niveaux (col1 => col2 => ...) |
| `DbGetLastId()` | Clé primaire du dernier INSERT |
| `DbAffectedRow()` | Nombre de lignes affectées par la dernière opération |
| `escapeStringForDB(string $string)` | Échapper une chaîne pour éviter les injections SQL. **Utiliser des guillemets simples autour dans le SQL** |

```php
// getCollectionFromDB — exemple résultat
$result = $this->getCollectionFromDB("SELECT `player_id` `id`, `player_name` `name`, `player_score` `score` FROM `player`");
// [1234 => ['id'=>1234, 'name'=>'user0', 'score'=>1], 1235 => [...]]

// getCollectionFromDB avec $bSingleValue=true (2 colonnes → A=>B)
$result = $this->getCollectionFromDB("SELECT `player_id` `id`, `player_name` `name` FROM `player`", true);
// [1234 => 'user0', 1235 => 'user1']

// getObjectListFromDB avec $bUniqueValue=true
$result = $this->getObjectListFromDB("SELECT `player_name` `name` FROM `player`", true);
// ['user0', 'user1']
```

---

## 5. Globals BGA (tous types)

Stockage clé/valeur JSON dans la table `bga_globals`. Accepte tout type (nombre, string, array, objet). Clé max 50 caractères.

> ⚠️ Pas de cache — chaque appel fait une requête DB.

```php
const FIRST_PLAYER_ID = "firstPlayerId";
const SELECTED_CARDS_IDS = "selectedCardsIds";
```

| Méthode | Description |
|---|---|
| `$this->bga->globals->set(string $name, $obj)` | Définit une variable globale |
| `$this->bga->globals->get(string $name, $default=null, ?string $class=null)` | Lit une variable. Retourne `null` si non définie (ou `$default`). Peut désérialiser vers une classe PHP |
| `$this->bga->globals->getAll(...$names)` | Retourne toutes les variables (ou celles listées) sous forme `key=>value` |
| `$this->bga->globals->has(string $name)` | Vérifie si la variable existe en DB |
| `$this->bga->globals->delete(...$names)` | Supprime une ou plusieurs variables |
| `$this->bga->globals->inc(string $name, int $inc)` | Incrémente une variable numérique, retourne la nouvelle valeur |

```php
// Écriture / lecture simple
$this->bga->globals->set(FIRST_PLAYER_ID, array_keys($players)[0]);
$currentFirstPlayerId = $this->bga->globals->get(FIRST_PLAYER_ID);

// Valeur par défaut
$selectedCardsIds = $this->bga->globals->get(SELECTED_CARDS_IDS, []);

// Avec classe PHP (désérialisation)
class Undo {
    public function __construct(
        public ?int $playerId = null,
        public ?array $moves = null,
    ) {}
}
$this->bga->globals->set(UNDO, new Undo($playerId, $moves));
$undo = $this->bga->globals->get(UNDO, class: Undo::class); // retourne un Undo, pas un stdClass

// extract() pour assigner plusieurs variables d'un coup
extract($this->bga->globals->getAll('endTime', 'hour', 'vipWelcome'));
// $endTime, $hour, $vipWelcome existent maintenant

// Suppression multiple
$this->bga->globals->delete(SELECTED_CARDS_IDS, UNDO, AFTER_DISCARD_RETURN_STATE);

// Incrément
$this->bga->globals->inc(PLAYED_ACTIONS_IN_CURRENT_TURN, 1);
```

---

## 6. Globals numériques / options de jeu

Ancienne API (entiers uniquement). Stockés dans la table `global`. Toujours utile pour accéder aux options de jeu (IDs 100–199).

```php
function __construct() {
    parent::__construct();
    $this->initGameStateLabels([
        "my_first_global"  => 10,   // IDs 10-89 pour les globals jeu
        "my_second_global" => 11,
        "my_game_variant"  => 100,  // IDs 100-199 pour les options
    ]);
}
```

| Méthode | Description |
|---|---|
| `initGameStateLabels(array $labelsMap)` | À appeler dans `__construct`. Définit jusqu'à 80 globals (IDs 10–89) et les options (IDs 100–199) |
| `setGameStateInitialValue(string $label, int $value)` | Initialise une valeur (dans `setupNewGame`). Optionnel si 0 convient |
| `getGameStateValue(string $label, int $default=0)` | Lit la valeur. ⚠️ Ne pas utiliser juste après `undoRestorePoint()` sans changer d'état |
| `setGameStateValue(string $label, int $value)` | Définit la valeur |
| `incGameStateValue(string $label, int $increment)` | Incrémente (ou décrémente si négatif). Retourne la valeur finale |

```php
$value = $this->getGameStateValue('my_first_global');
$this->setGameStateValue('my_first_global', 42);
$value = $this->incGameStateValue('my_first_global', 1);
```

### Globals BGA prédéfinis (ne pas modifier directement)

| ID | Label | Signification |
|---|---|---|
| 1 | | État courant |
| 2 | | ID du joueur actif |
| 3 | `next_move_id` | Numéro du prochain mouvement |
| 4 | | ID du jeu |
| 5 | | ID du créateur de table |
| 6 | `playerturn_nbr` | Numéro du tour joueur |
| 7 | `gameprogression` | Progression du jeu |
| 8 | `initial_reflexion_time` | Temps de réflexion initial |
| 9 | `additional_reflexion_time` | Temps de réflexion additionnel |
| 200 | `reflexion_time_profile` | Vitesse du jeu (0-2 temps réel, 10-20 tour par tour) |
| 201 | `bgaranking_mode` | Mode : 0=Normal, 1=Friendly, 2=Arena |
| 207 | `game_language` | Langue du jeu |
| 300 | `game_db_version` | Version du jeu en production |
| 301 | `game_result_neutralized` | Résultat neutralisé |
| 302 | `neutralized_player_id` | ID du joueur neutralisé |
| 304 | `undo_moves_stored` | Moves undo stockés |
| 305 | `undo_moves_player` | Joueur concerné par l'undo |
| 306 | `lock_screen_timestamp` | Timestamp du verrou écran |

---

## 7. États de jeu et joueurs actifs

### Joueur actif unique

| Méthode | Description |
|---|---|
| `$this->activeNextPlayer()` | Passe au joueur suivant dans l'ordre naturel. Nécessite une transition d'état pour notifier le front |
| `$this->activePrevPlayer()` | Passe au joueur précédent |
| `$this->gamestate->changeActivePlayer($player_id)` | Rend n'importe quel joueur actif. Nécessite une transition d'état |
| `$this->getActivePlayerId()` | ID du joueur actif (préférer le paramètre magique) |

### Joueurs multiples actifs

| Méthode | Description |
|---|---|
| `$this->gamestate->setAllPlayersMultiactive()` | Rend tous les joueurs actifs. Envoie la notification `onUpdateActionButtons` |
| `$this->stMakeEveryoneActive()` | Alias de `setAllPlayersMultiactive()` pour utilisation comme méthode `st` dans la déclaration d'état |
| `$this->gamestate->setAllPlayersNonMultiactive($next_state)` | Désactive tous les joueurs et transition vers `$next_state` (nom de transition ou classe) |
| `$this->gamestate->setPlayersMultiactive($players, $next_state, $bExclusive=false)` | Active une liste spécifique de joueurs. Si `$players` vide → transition vers `$next_state`. `$bExclusive=true` désactive les autres |
| `$this->gamestate->setPlayerNonMultiactive($player_id, $next_state)` | Désactive un joueur. Si dernier actif → transition vers `$next_state`. Retourne `true` si transition |
| `$this->gamestate->getActivePlayerList()` | Liste des IDs des joueurs actifs |
| `$this->gamestate->updateMultiactiveOrNextState($next_state)` | À appeler après une modification manuelle DB des joueurs multiactifs |
| `$this->gamestate->isPlayerActive($player_id)` | `true` si le joueur est actif en ce moment (tient compte du type d'état) |

```php
// Pattern standard : action joueur en multiactif
function actPlayCard(int $currentPlayerId) {
    $this->checkAction('actPlayCard');
    // ... logique ...
    $this->gamestate->setPlayerNonMultiactive($currentPlayerId, 'next');
}

// Modification manuelle DB (avancé) + notification
$sql = "UPDATE `player` SET `player_is_multiactive` = '1' WHERE `player_team` = '$team'";
$this->DbQuery($sql);
$this->gamestate->updateMultiactiveOrNextState('error');
```

### Fonctions d'état

| Méthode | Description |
|---|---|
| `$this->gamestate->nextState($transition)` | Transition vers un état. `$transition` = nom de transition ou classe d'état. Avec State classes, préférer `return NextState::class` |
| `$this->gamestate->jumpToState($stateNum)` | Saute directement vers un état par ID. **Méthode avancée — usage rare** |
| `$this->checkAction($actionName, $bThrowException=true)` | Vérifie que l'action est valide pour le joueur courant. **À appeler en premier dans toute action sans autowiring** |
| `$this->gamestate->checkPossibleAction($action)` | Comme `checkAction` mais sans vérifier si le joueur est actif. ⚠️ Ne vérifie pas spectateur/éliminé |
| `$this->gamestate->getCurrentMainState()` | État principal courant (hors private). `.name` pour le nom, `.toArray()` pour le tableau |
| `$this->gamestate->getCurrentMainStateId()` | ID de l'état principal courant |
| `$this->gamestate->getCurrentState(int $playerId)` | État courant d'un joueur (private si applicable) |
| `$this->gamestate->getCurrentStateId(int $playerId)` | ID de l'état courant d'un joueur |
| `$this->gamestate->isMultiactiveState()` | `true` si état `MULTIPLE_ACTIVE_PLAYER` |

```php
// checkPossibleAction — exemple : joueur non actif qui change d'avis
function actUnpass(int $currentPlayerId) {
    $this->gamestate->checkPossibleAction('actUnpass');
    $this->gamestate->setPlayersMultiactive([$currentPlayerId], 'error', false);
}
```

### États privés parallèles

Utiles pour les états `MULTIPLE_ACTIVE_PLAYER` complexes où chaque joueur progresse de façon indépendante.

| Méthode | Description |
|---|---|
| `$this->gamestate->initializePrivateStateForAllActivePlayers()` | Initialise l'état privé pour tous les joueurs actifs (vers `initialprivate` de l'état maître) |
| `$this->gamestate->initializePrivateStateForPlayers($playerIds)` | Idem pour une liste de joueurs |
| `$this->gamestate->initializePrivateState($playerId)` | Idem pour un joueur |
| `$this->gamestate->nextPrivateStateForAllActivePlayers($transition)` | Transition de tous les joueurs actifs vers l'état privé suivant |
| `$this->gamestate->nextPrivateStateForPlayers($playerIds, $transition)` | Idem pour une liste de joueurs |
| `$this->gamestate->nextPrivateState($playerId, $transition)` | Idem pour un joueur |
| `$this->gamestate->unsetPrivateStateForAllPlayers()` | Remet à null l'état privé de tous les joueurs |
| `$this->gamestate->unsetPrivateStateForPlayers($playerIds, $transition)` | Idem pour une liste |
| `$this->gamestate->unsetPrivateState($playerId)` | Idem pour un joueur |
| `$this->gamestate->setPrivateState($playerId, $newStateId)` | Force un état privé sans passer par les transitions (cas très avancé) |
| `$this->gamestate->getPrivateState($playerId)` | Retourne l'état privé ou `null` |

```php
// Pattern standard d'initialisation
function stStartPlayerTurn() {
    $this->gamestate->setAllPlayersMultiactive();
    $this->gamestate->initializePrivateStateForAllActivePlayers();

    if ($someCondition) {
        $this->gamestate->nextPrivateStateForAllActivePlayers("some_transition");
    }
}

// Args spécifiques par joueur en état privé
function argMyPrivateState($player_id) {
    return ['my_data' => $this->getPlayerSpecificData($player_id)];
}

// Nettoyage à la fin du round
function stNextRound() {
    $this->gamestate->unsetPrivateStateForAllPlayers();
}
```

> **Joueurs inactifs en private states** : ils sont gérés par l'état maître `MULTIPLE_ACTIVE_PLAYER`. Le client doit gérer cet état pour afficher un message d'attente ou des boutons pour "rejoindre".

---

## 8. Actions (autowired)

Les fonctions préfixées `act` dans `Game.php` sont **automatiquement câblées** — plus besoin de `action.php`. Les paramètres front sont mappés par nom et type.

```php
// PHP
public function actPlayCard(int $cardId) { ... }

// JS
this.bga.actions.performAction('actPlayCard', { cardId: this.selectedCardId });
```

> ⚠️ Si la fonction est aussi déclarée dans `action.php`, `action.php` a priorité.

### Attributs de paramètres disponibles

**`BoolParam(?string $name = null)`**
```php
use \Bga\GameFramework\Actions\Types\BoolParam;

public function actRaiseBet(#[BoolParam(name: 'raise')] bool $raiseBet) { ... }
```

**`IntParam(?string $name = null, ?int $min = null, ?int $max = null)`**
```php
use \Bga\GameFramework\Actions\Types\IntParam;

public function actPlayCard(#[IntParam(name: 'id')] int $cardId) { ... }
public function actSpendGold(#[IntParam(min: 1)] int $gold) { ... }
public function actPlaceCard(int $cardId, #[IntParam(min: 1, max: 5)] int $spot) { ... }
```

**`FloatParam`** — même fonctionnement qu'`IntParam`.

**`StringParam(?string $name = null, ?bool $alphanum = false, ?bool $alphanum_dash = false, ?bool $base64 = false, ?array $enum)`**
```php
use \Bga\GameFramework\Actions\Types\StringParam;

public function actSubmitWord(#[StringParam(alphanum: true)] string $word) { ... }
public function actChooseAction(#[StringParam(enum: ['move', 'attack', 'pass'])] string $action) { ... }
```

**`IntArrayParam(?string $name = null, ?int $min = null, ?int $max = null)`**
```php
use \Bga\GameFramework\Actions\Types\IntArrayParam;

public function actDiscardCards(#[IntArrayParam(min: 2, max: 8)] array $ids) { ... }
// min/max = longueur du tableau, pas valeur des éléments
```
```js
// JS
this.bga.actions.performAction('actDiscardCards', { ids: [8, 12, 25] });
```

**`JsonParam(?string $name = null, ?bool $associative = true, ?bool $alphanum = true)`**
```php
use \Bga\GameFramework\Actions\Types\JsonParam;

public function actPlanComplexStuff(#[JsonParam()] array $answer) {}         // array
public function actPlanComplexStuff(#[JsonParam(associative: false)] object $answer) {} // object

// Désérialisation vers une classe PHP
class Answer {
    public function __construct(
        public int $a,
        public string $b,
        public array $c,
    ) {}
}
public function actPlanComplexStuff(#[JsonParam(class: Answer::class)] $answer) {}
public function actPlanComplexStuff(#[JsonParam] Answer $answer) {} // détecté automatiquement
public function actPlanMultiple(#[JsonParam(class: Answer::class)] array $answers) {} // tableau de Answer
```
```js
// JS
this.bga.actions.performAction("actPlanComplexStuff", {
    answer: JSON.stringify({ a: 2, b: "string", c: [1, 2, 4] })
});
```

### Désactiver checkAction (hors-tour)

```php
use \Bga\GameFramework\Actions\CheckAction;

#[CheckAction(false)]
public function actSetAutopass(bool $autopass) { ... }

#[CheckAction(false)]
public function actCancelChooseAction() {
    $this->gamestate->checkPossibleAction('actCancelChooseAction');
    // ...
}
```

> Si `checkAction` est désactivé, appeler `checkPossibleAction` manuellement. Le préfixe `act` protège le code : seules les fonctions explicitement préfixées sont exposables depuis le front.

---

## 9. Ordre de tour des joueurs

L'ordre naturel (`player_no`) est attribué aléatoirement à la création de la table et est **en lecture seule**. Pour un ordre personnalisé, utiliser une structure de données séparée.

| Méthode | Description |
|---|---|
| `getNextPlayerTable()` | Tableau associatif `player_id => next_player_id`. Clé `0` = premier joueur |
| `getPrevPlayerTable()` | Idem vers le joueur précédent (pas de clé `0`) |
| `getPlayerAfter($player_id)` | Joueur suivant dans l'ordre naturel |
| `getPlayerBefore($player_id)` | Joueur précédent dans l'ordre naturel |
| `createNextPlayerTable($players, $bLoop=true)` | Crée un tableau next à partir d'un tableau de IDs dans un ordre personnalisé. Ne modifie **pas** la DB |

```php
// Exemple getNextPlayerTable avec 3 joueurs (1000, 2000, 3000)
// [1000 => 2000, 2000 => 3000, 3000 => 1000, 0 => 1000]

// createNextPlayerTable avec bLoop=false
$table = $this->createNextPlayerTable([3000, 2000, 1000], false);
// [3000 => 2000, 2000 => 1000, 1000 => null, 0 => 3000]
```

---

## 10. Notifications

> Les notifications sont **mises en file** et envoyées à la fin de l'action, seulement si elle se termine normalement (pas d'exception).

**Où les notifications peuvent être envoyées :**
- Handlers d'actions (`act*` dans State classes ou Game.php)
- Transitions d'état (`onEnteringState`)
- `setupNewGame` (après initialisation de la table joueurs)

**Où elles ne peuvent PAS être envoyées :**
- `.view.php`, `.action.php`, `material.inc.php`, constructeur de `Game.php`, méthodes `arg*`

> ⚠️ Taille totale limitée à **128K** (bundle complet incluant toutes les transitions d'état qui suivent).

### notify->all — Notification publique

```php
$this->bga->notify->all(
    "playDisc",
    clienttranslate('${player_name} joue un disque et retourne ${returned_nbr} disque(s)'),
    [
        'player_id'    => $player_id,
        'player_name'  => $this->getPlayerNameById($player_id),
        'returned_nbr' => count($turnedOverDiscs),
        'x'            => $x,
        'y'            => $y,
    ]
);
```

> ⚠️ Pas de données privées dans `notify->all` — un tricheur peut les lire.  
> ⚠️ En rechargement (F5), les arguments sont purgés sauf `i18n`, `player_id` et ceux dans le message. Utiliser `'preserve' => ['x', 'y']` pour conserver des arguments supplémentaires (uniquement si nécessaire pour le rendu du log).

> ⚠️ Si notifications publiques **et** privées sont envoyées dans la même action, au rechargement les notifications privées apparaissent **avant** les publiques dans le log.

### Notifications récursives

```php
$this->bga->notify->all('message', clienttranslate('Déplace ${token_name_rec}'), [
    'token_name_rec' => [
        'log'  => '${token_name} #${token_number}',
        'args' => ['token_name' => clienttranslate('Boo'), 'token_number' => $number, 'i18n' => ['token_name']]
    ]
]);
```

### Données privées dans notify->all

```php
use Bga\GameFramework\NotificationMessage;

$this->bga->notify->all('cardPicked', clienttranslate('${player_name} prend une carte secrète'), [
    'playerId'    => $playerId,
    'player_name' => $this->getPlayerNameById($playerId),
    '_private'    => [
        $playerId => new NotificationMessage(
            clienttranslate('Vous prenez ${_private.card_name}'),
            ['card' => $card, 'card_name' => $this->getCardName($card), 'i18n' => ['card_name']]
        ),
    ],
]);
// Pour fusionner dans args au lieu de args._private : ajouter '_merge_private' => true
// Pour toujours fusionner : $this->bga->notify->alwaysMergePrivate() dans le constructeur
```

### Noms de joueurs dans les notifications

```php
// Variables spéciales pour coloration automatique dans le log
// ${player_name} + player_id requis
// ${player_name2} + player_id2 pour un deuxième joueur, etc.

$this->bga->notify->all('buyAndPassCard',
    clienttranslate('${player_name} achète ${card_name} et le passe à ${player_name2}'),
    [
        'player_id'   => $player1['id'],
        'player_name' => $player1['name'],   // ne pas mettre dans i18n
        'player_id2'  => $player2['id'],
        'player_name2'=> $player2['name'],
    ]
);
```

### notify->player — Notification privée

```php
$this->bga->notify->player($player_id, 'message',
    clienttranslate('Vous piochez ${card_name}'),
    ['card_name' => $cardName, 'i18n' => ['card_name']]
);
```

> Les spectateurs ne peuvent pas recevoir `notify->player` (utiliser `notify->all`).

### Décorateurs de notifications

Évitent de dupliquer `player_name` dans tous les args :

```php
// Dans __construct
$this->bga->notify->addDecorator(fn(string $message, array $args) => $this->decoratePlayerName($message, $args));

public function decoratePlayerName(string $message, array $args): array {
    if (isset($args['player_id']) && !isset($args['player_name']) && str_contains($message, '${player_name}')) {
        $args['player_name'] = $this->getPlayerNameById($args['player_id']);
    }
    return $args;
}

// Utilisation : plus besoin de passer player_name explicitement
$this->bga->notify->all("pass", clienttranslate('${player_name} passe'), ["player_id" => $player_id]);
```

---

## 11. Randomisation

Du plus sûr au moins sûr :

### Dés → bga_rand (obligatoire)

```php
$result = \bga_rand(1, 6); // cryptographiquement sûr (basé sur random_int)
```

> ⚠️ **Obligatoire pour les dés**. `rand()` et `mt_rand()` sont dépréciés sur BGA.

### Arrays → random_int

`array_rand()` et `shuffle()` PHP ne sont pas cryptographiquement sûrs. Utiliser :

```php
// Clé aléatoire
private function getRandomKey(array $array) {
    $size = count($array);
    if ($size == 0) { return null; }
    $rand = random_int(0, $size - 1);
    $slice = array_slice($array, $rand, 1, true);
    foreach ($slice as $key => $value) { return $key; }
}

// Valeur aléatoire
private function getRandomValue(array $array) { ... } // même structure, return $value

// Tranche aléatoire (préserve les clés)
private function getRandomSlice(array $array, int $count) { ... }
```

### Mélange de cartes → composant Deck BGA

```php
// La méthode shuffle() du composant Deck est la méthode recommandée
$this->cards->shuffle('deck');
```

> MySQL `RAND()` n'est **pas** acceptable pour la randomisation sur BGA.

---

## 12. Statistiques de jeu

Deux types : `tableStats` (globale) et `playerStats` (par joueur).

| Méthode | Description |
|---|---|
| `$this->bga->tableStats->init(string\|array $names, $value)` | Initialise une stat table (dans `setupNewGame`) |
| `$this->bga->playerStats->init(string\|array $names, $value, bool $updateTableStat=false)` | Initialise une stat joueur. `$updateTableStat=true` initialise aussi la stat table du même nom |
| `$this->bga->tableStats->set(string $name, $value)` | Définit la valeur d'une stat table |
| `$this->bga->playerStats->set(string $name, $value, int $player_id)` | Définit la valeur d'une stat joueur |
| `$this->bga->playerStats->setAll(string $name, $value)` | Définit pour tous les joueurs |
| `$this->bga->tableStats->inc(string $name, $delta)` | Incrémente une stat table |
| `$this->bga->playerStats->inc(string $name, $delta, int $player_id, bool $updateTableStat=false)` | Incrémente une stat joueur |
| `$this->bga->playerStats->incAll(string $name, $delta)` | Incrémente pour tous les joueurs |
| `$this->bga->tableStats->get(string $name)` | Lit une stat table |
| `$this->bga->playerStats->get(string $name, int $player_id)` | Lit une stat joueur |
| `$this->bga->playerStats->getAll(string $name)` | Retourne `[player_id => valeur]` pour tous les joueurs |

> ⚠️ Si une stat n'est jamais initialisée ni mise à jour, elle sera ignorée en fin de partie (comportement souhaitable si la stat ne s'applique pas à cette partie).

---

## 13. Scores et départage

### Score normal

```php
$this->bga->playerScore->inc($activePlayerId, 2);  // +2 points
$this->bga->playerScore->set($activePlayerId, 5);  // score = 5
```

> `bga->playerScore` est un [PlayerCounter](https://en.doc.boardgamearena.com/PlayerCounter_and_TableCounter).

### Départage (tie breaker)

```php
$this->bga->playerScoreAux->inc($playerId, 1);
```

```jsonc
// Dans gameinfos.jsonc
"tie_breaker_description": "Description de la formule de départage",
```

### Score inversé (le plus bas gagne)

Dans l'état final, au lieu de retourner `99`, retourner un objet `GameResult` :

```php
use Bga\GameFramework\GameResult\GameResult;
use Bga\GameFramework\GameResult\Player;

public function onEnteringState() {
    $playersDb = $this->game->getCollectionFromDb("SELECT * FROM `player`");
    $players = Player::fromPlayersDb($playersDb);
    return GameResult::individualRanking($players, reverseScore: true);
    // Pour départage inversé : reverseScoreAux: true
}
```

### Cas de scoring particuliers

| Cas | Configuration |
|---|---|
| **Jeu coopératif** | `"is_coop": 1` dans `gameinfos.jsonc`. Score 0 = défaite, score > 0 identique = victoire |
| **Semi-coop** | Si tout le monde perd : score 0 pour tous |
| **Gagnants / Perdants uniquement** | `"losers_not_ranked": true` dans `gameinfos.jsonc`. Meilleur score = gagnant, même score inférieur = perdants égaux |
| **Solo** | Score ≤ 0 = défaite, score > 0 = victoire |

### Élimination de joueur

```php
$this->eliminatePlayer($player_to_eliminate_id);
// Le joueur éliminé ne doit plus être actif à la fin de l'action
// Si dernier joueur éliminé → s'assurer de transitionner vers l'état de fin
```

> ⚠️ Ne pas utiliser pour un joueur zombie (qui a quitté le jeu) sauf si les règles l'éliminent.

### Concession

```php
function onConcede() {
    // Limiter à du calcul de stats, pas de changement d'état
    $this->bga->notify->all('test', 'Action quand un joueur concède');
}

function onConcede($concederTeam) {
    $concederId = $concederTeam->players[0]->id;
}
```

---

## 14. Temps de réflexion

```php
// Donner du temps supplémentaire (temps réel uniquement, pas tour par tour)
$this->giveExtraTime($player_id);
$this->giveExtraTime($player_id, 30); // 30 secondes spécifiques (rarement utile)
```

> Le temps total ne peut pas dépasser le maximum du tour. Inutile d'appeler cette fonction en début de tour.  
> Le temps standard est doublé automatiquement pour les débutants.

```php
$this->bga->tableOptions->isTurnBased(): bool  // true si jeu au tour par tour
$this->bga->tableOptions->isRealTime(): bool   // true si jeu en temps réel
```

---

## 15. Undo

> Lire la [BGA Undo policy](https://en.doc.boardgamearena.com/BGA_Undo_policy) avant d'implémenter.

**Prérequis dans `gameinfos.inc.php` :**
```php
'db_undo_support' => true
```

```php
// Sauvegarder un point de restauration
function undoSavepoint() { ... }
// Il n'existe qu'UN seul point de restauration.
// Ne peut pas être utilisé en état multiactif ou si le prochain état est multiactif.
// Le snapshot est pris APRÈS la fin de la transaction (avant les notifications).

// Restaurer le point
function actUndo() {
    $this->undoRestorePoint();
    return PlayTurn::class; // transition vers l'état de début de tour
}
// ⚠️ Après undoRestorePoint(), changer d'état immédiatement OU appeler
// $this->gamestate->reloadState() pour rafraîchir le cache des globals.
```

### Suppression manuelle de logs (undo custom avancé)

```php
// Pendant l'action, stocker le move_id
$this->bga->globals->set(UNDO_ACTION, new Undo(
    movedTiles: $tiles,
    moveId: $this->bga->logs->getCurrentMoveId(),
));
return ConfirmAction::class;

// Pendant l'undo, supprimer les logs et ne rien faire après
$undo = $this->bga->globals->get(UNDO_ACTION);
$this->bga->logs->remove($undo->moveId);
// Aucune action/notification après remove()
return PlayAction::class;
```

---

## 16. Erreurs et exceptions

> Lancer une exception annule **tous** les changements DB et **toutes** les notifications.

| Exception | Usage |
|---|---|
| `throw new UserException($message)` | Erreur liée à une action non autorisée du joueur. Message traduit affiché en rouge. **Non tracée** dans les logs BGA |
| `throw new SystemException($message)` | Exception système. Message caché à l'utilisateur, visible dans les logs |
| `throw new VisibleSystemException($message)` | Erreur inattendue affichée comme "Unexpected error". Tracée dans les logs BGA. Message non traduit |

```php
use Bga\GameFramework\UserException;

throw new UserException(clienttranslate("Il y a déjà une pierre ici, vous ne pouvez pas jouer là"));

// Avec arguments traduits
throw new UserException(new NotificationMessage(
    clienttranslate('Vous devez jouer une carte supérieure à ${min}'),
    ['min' => $minCardValue]
));
```

---

## 17. Mode Zombie

Quand un joueur quitte la partie, il devient "zombie". Implémenter la gestion zombie est **obligatoire**.

```
Voir : https://en.doc.boardgamearena.com/Zombie_Mode
```

> Implémenté via la méthode `zombie()` dans chaque State class (voir doc State classes).

---

## 18. Préférences utilisateur

```php
// Lire la préférence d'un joueur
$value = $this->bga->userPreferences->get($playerId, $prefId);
```

---

## 19. Préférences de couleur joueur

Les utilisateurs premium BGA peuvent choisir leur couleur favorite.

**Activation dans `gameinfos.jsonc` :**
```jsonc
"favorite_colors_support": true,
```

**Dans `setupNewGame` :**
```php
$gameinfos = $this->getGameinfos();
if ($gameinfos['favorite_colors_support']) {
    $this->reattributeColorsBasedOnPreferences($players, $gameinfos['player_colors']);
}
$this->reloadPlayersBasicInfos();
```

> ⚠️ Ne pas utiliser si la couleur a une influence mécanique (ex: avantage au premier joueur).  
> ⚠️ La logique ne doit jamais présupposer qu'un ordre de joueur implique une couleur donnée.

### Assignations de couleurs personnalisées

```php
function getSpecificColorPairings(): array {
    return [
        "ff0000" /* Rouge  */ => ['990000', 'aa1122'], // premier disponible dans la liste
        "0000ff" /* Bleu   */ => "000099",             // couleur unique
        "008000" /* Vert   */ => null,                 // comportement par défaut
        "ffa500" /* Jaune  */ => null,
    ];
}
```

---

## 20. Débogage et traces

```php
// Tracer dans les logs BGA Studio
$this->dump('label', $variable);

// Logger une chaîne
$this->error("Message d'erreur");

// Trace visible dans l'UI Studio (mode debug uniquement)
$this->debugConsole("Message debug");
```

> Voir [Practical debugging](https://en.doc.boardgamearena.com/Practical_debugging) pour les techniques de débogage avancées.

---

## 21. Créer d'autres classes PHP

Il est possible de créer des classes PHP supplémentaires et de les organiser en sous-dossiers dans `modules/php/`. Les namespaces doivent refléter la structure de dossiers pour l'autoloading.

```php
namespace Bga\Games\MyGame\Utils;

class CardHelper {
    public static function getPlayableCards(array $hand, int $minValue): array {
        // ...
    }
}
```

```php
// Dans Game.php ou une State class
use Bga\Games\MyGame\Utils\CardHelper;

$playable = CardHelper::getPlayableCards($hand, $minValue);
```

---

*Source : [en.doc.boardgamearena.com/Main_game_logic:_Game.php](https://en.doc.boardgamearena.com/Main_game_logic:_Game.php)*
