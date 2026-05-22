# State classes : State directory

> Source : https://en.doc.boardgamearena.com/State_classes:_State_directory  
> Dernière modification : 29 avril 2026

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Exemple de classe d'état](#2-exemple-de-classe-détat)
3. [Paramètres du constructeur](#3-paramètres-du-constructeur)
   - [id](#id)
   - [type](#type)
   - [name](#name)
   - [description](#description)
   - [descriptionMyTurn](#descriptionmyturn)
   - [transitions](#transitions)
   - [updateGameProgression](#updategameprogression)
   - [initialPrivate](#initialprivate)
4. [État initial](#4-état-initial)
5. [Fonction getArgs](#5-fonction-getargs)
   - [Données privées dans args](#données-privées-dans-args)
   - [Flag _no_notify](#flag-_no_notify)
6. [Fonction onEnteringState](#6-fonction-onenteringstate)
7. [Fonctions act*](#7-fonctions-act)
8. [Fonction zombie](#8-fonction-zombie)
9. [Notes d'implémentation](#9-notes-dimplémentation)
10. [Migration depuis states.inc.php / Game.php](#10-migration-depuis-statesincphp--gamephp)

---

## 1. Vue d'ensemble

Les fichiers du dossier `php/States/` décrivent la machine à états du jeu (propriétés de chaque état et transitions entre états).

> 📖 Lecture recommandée avant de commencer : [Focus on BGA game state machine](http://www.slideshare.net/boardgamearena/bga-studio-focus-on-bga-game-state-machine) (ignorer les extraits de code, ils sont obsolètes)

**Avantage des State classes** : l'IDE comprend la structure et propose l'autocomplétion + la détection d'erreurs — contrairement aux Traits.

---

## 2. Exemple de classe d'état

Fichier : `modules/php/States/PlayerTurn.php`

```php
<?php
declare(strict_types=1);

namespace Bga\Games\<MyGameName>\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\<MyGameName>\Game;

class PlayerTurn extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 2,
            type: StateType::ACTIVE_PLAYER,

            // optionnel
            description: clienttranslate('${actplayer} must play a card or pass'),
            descriptionMyTurn: clienttranslate('${you} must play a card or pass'),
            transitions: [],
            updateGameProgression: false,
            initialPrivate: null,
        );
    }

    public function getArgs(): array
    {
        // données envoyées au front en entrant dans l'état
        return [];
    }

    function onEnteringState(int $activePlayerId) {
        // code à exécuter en entrant dans l'état
    }

    #[PossibleAction]
    public function actPlayCard(int $cardId, int $activePlayerId, array $args): string
    {
        // code déclenché quand le joueur appelle bgaPerformAction('actPlayCard')
    }

    function zombie(int $playerId): string {
        // code à exécuter quand le joueur est un zombie
    }
}
```

> La classe doit étendre `Bga\GameFramework\States\GameState` et respecter la signature du `__construct`.

---

## 3. Paramètres du constructeur

Seuls `game`, `id` et `type` sont **obligatoires**. Le paramètre `name` prend par défaut le nom de la classe.

---

### id

**Obligatoire**

Identifiant numérique unique de l'état.

- Doit être un entier positif
- `1` est réservé à l'état initial → ne pas utiliser
- `99` est réservé à l'état final (fin de partie) → ne pas modifier
- Tout autre entier est valide, même > 100

> ⚠️ En production, changer l'ID d'un état rendra le comportement de toutes les parties actives imprévisible.

---

### type

**Obligatoire**

| Constante | Ancienne notation | Description |
|---|---|---|
| `StateType::ACTIVE_PLAYER` | `'activeplayer'` | Un seul joueur actif doit jouer |
| `StateType::MULTIPLE_ACTIVE_PLAYER` | `'multipleactiveplayer'` | Plusieurs joueurs actifs simultanément |
| `StateType::PRIVATE` | `'private'` | État privé parallèle dans un état multiactif |
| `StateType::GAME` | `'game'` | Aucun joueur actif — état de transition automatique |

---

### name

Identifie l'état dans la logique du jeu. Par défaut : nom de la classe (tel quel).

Plusieurs états peuvent partager le même nom (non recommandé). Pas d'espaces ni de caractères spéciaux.

```php
// PHP
$state = $this->gamestate->getCurrentMainState();
if ($state['name'] == 'myGameState') { ... }
```

```js
// JS
onEnteringState: function(stateName, args) {
    switch (stateName) {
        case 'myGameState':
            // ...
            break;
    }
}
```

---

### description

Texte affiché dans la barre d'action **pour tous les joueurs sauf le joueur actif**.

```php
description: clienttranslate('${actplayer} must play a card or pass')
```

Variables disponibles :
- `${actplayer}` → nom du joueur actif
- `${otherplayer}` → autre joueur (nécessite `otherplayer_id` dans les args)
- Toute clé retournée par `getArgs()`

```php
// Exemple avec argument dynamique
clienttranslate('${actplayer} must choose ${nbr} identical energies')

function getArgs(): array {
    return ['nbr' => 2]; // ${nbr} sera remplacé par "2"
}
```

> 💡 Généralement vide pour les états `GAME`, sauf si des notifications synchrones maintiennent le client sur cet état.

---

### descriptionMyTurn

**Obligatoire** pour les types `ACTIVE_PLAYER` et `MULTIPLE_ACTIVE_PLAYER`.

Même rôle que `description`, mais affiché **au(x) joueur(s) actif(s)**.

```php
description: clienttranslate('${actplayer} can take some actions'),
descriptionMyTurn: clienttranslate('${you} can take some actions'),
```

```php
// Avec référence à un autre joueur
clienttranslate('${you} can follow action of ${otherplayer}')

function getArgs(): array {
    return [
        'otherplayer'    => $this->getLeaderPlayerName(),
        'otherplayer_id' => $this->getLeaderPlayerId(),
    ];
}
```

---

### transitions

Déclare les états cibles accessibles depuis cet état.

```php
transitions: [
    'nextPlayer' => 27,  // "nextPlayer" = nom de la transition, 27 = ID de l'état cible
    'endRound'   => 39,
]
```

```php
// Pour déclencher une transition depuis une action
actPlayCard() {
    // ...
    return 'nextPlayer';
}
```

> Si une seule transition existe, une chaîne vide `''` est acceptée comme nom.

---

### updateGameProgression

Défaut : `false`

Si `true`, `getGameProgression()` est appelée au début de cet état pour mettre à jour la progression.

> Au moins un état doit avoir `updateGameProgression: true`.

---

### initialPrivate

Défaut : `null`

Active les états privés parallèles dans un état multiactif. Doit pointer vers le premier état privé d'un joueur.

```php
initialPrivate: PlaceCard::class  // accepte aussi un int ou null
```

---

## 4. État initial

Dans `Game.php`, retourner la classe du premier état depuis `setupNewGame` :

```php
protected function setupNewGame($players, $options = []) {
    // ... initialisation du jeu
    return GameDispatch::class; // premier état
}
```

> Si rien n'est retourné, l'état 2 est utilisé par défaut (à confirmer).

---

## 5. Fonction getArgs

Retourne les données envoyées au front en entrant dans l'état.

**Paramètres "magiques"** auto-remplis par le framework :

| Paramètre | Usage |
|---|---|
| `int $activePlayerId` / `int $active_player_id` | ID du joueur actif — états `ACTIVE_PLAYER` uniquement |
| `int $activePlayerNo` / `int $active_player_no` | Numéro du joueur actif — états `ACTIVE_PLAYER` uniquement |
| `int $playerId` / `int $player_id` / `int $currentPlayerId` | ID du joueur dans l'état `PRIVATE` |
| `int $playerNo` / `int $player_no` / `int $currentPlayerNo` | Numéro du joueur dans l'état `PRIVATE` |

---

### Données privées dans args

Par défaut, toutes les données de `getArgs` sont **publiques**. Pour envoyer des données privées :

```php
function getArgs(int $activePlayerId): array {
    return [
        '_private' => [
            $activePlayerId => [
                'somePrivateData' => $this->getSomePrivateData($activePlayerId),
            ]
        ],
        'possibleMoves' => $this->getPossibleMoves(), // public
    ];
}
```

Côté JS : `args.args._private.somePrivateData`

Pour fusionner les données privées directement dans `args.args` :
- Ajouter `_merge_private => true` dans l'array `_private`
- Ou appeler `$this->bga->notify->alwaysMergePrivate()` dans le constructeur de `Game`

> ⚠️ Impact performance notable en état `MULTIPLE_ACTIVE_PLAYER` — n'utiliser que si nécessaire.

---

### Flag _no_notify

Permet de désactiver la notification front pour les états automatiquement passés (évite le clignotement).

```php
function getArgs(int $activePlayerId): array {
    $playableCardsIds = ...;
    return [
        'playableCardsIds' => $playableCardsIds,
        '_no_notify' => count($playableCardsIds) === 0,
    ];
}

function onEnteringState(int $activePlayerId, array $args): void {
    if ($args['_no_notify']) {
        return $this->actPass($activePlayerId); // OBLIGATOIRE : rediriger !
    }
}
```

> ⚠️ Si `_no_notify` est utilisé, `onEnteringState` **doit** rediriger vers un autre état.

---

## 6. Fonction onEnteringState

Déclenchée à l'entrée dans l'état. Peut effectuer une redirection.

**Paramètres "magiques"** (mêmes que `getArgs`, plus `array $args`).

**Valeurs de retour possibles :**

```php
return NextPlayer::class;          // redirige vers la classe d'état
return StateConstants::ST_END_GAME; // redirige vers l'ID (doit être un int)
return 99;                          // redirige vers l'état 99
return 'nextPlayer';                // utilise une transition déclarée
```

```php
// Exemple typique pour un état GAME
function onEnteringState(int $active_player_id) {
    $next_player_id = (int)$this->getPlayerAfter($active_player_id);
    $this->giveExtraTime($next_player_id);
    $this->incStat(1, 'turns_number', $next_player_id);
    $this->incStat(1, 'turns_number');
    $this->gamestate->changeActivePlayer($next_player_id);
    return 'next';
}
```

```php
// Exemple pour un état MULTIPLE_ACTIVE_PLAYER
function onEnteringState() {
    $this->gamestate->setAllPlayersMultiactive();
    return; // pas de valeur
}
```

> ⚠️ Ne jamais surcharger `stGameEnd()` et `argGameEnd()` dans `Game.php` — la partie ne se terminerait jamais.

---

## 7. Fonctions act*

Déclenchées depuis le front via `bgaPerformAction`. **Préfixe obligatoire : `act`**.

Chaque action normale doit être annotée `#[PossibleAction]`.

**Paramètres "magiques"** :

| Paramètre | Description |
|---|---|
| `array $args` | Résultat de `getArgs()` |
| `int $activePlayerId` | ID du joueur actif (pas forcément celui qui déclenche) |
| `int $activePlayerNo` | Numéro du joueur actif |
| `int $currentPlayerId` | ID du joueur qui a déclenché l'action |
| `int $currentPlayerNo` | Numéro du joueur qui a déclenché l'action |

La valeur de retour fonctionne comme `onEnteringState`.

```php
#[PossibleAction]
public function actPlayCard(int $cardId, int $activePlayerId)
{
    $game = $this->game;
    $currentCard = $game->cards->getCard($cardId);

    if (!$currentCard) {
        throw new \BgaSystemException("Invalid move $cardId");
    }

    $playable_cards = $game->getPlayableCards($activePlayerId);
    if (!in_array($cardId, $playable_cards)) {
        throw new \BgaUserException(clienttranslate("You cannot play this card now"));
    }

    $game->cards->moveCard($cardId, 'cardsontable', $activePlayerId);

    $game->notify->all(
        'playCard',
        clienttranslate('${player_name} plays ${value_displayed} ${color_displayed}'),
        [
            'i18n'            => ['color_displayed', 'value_displayed'],
            'card'            => $currentCard,
            'player_id'       => $activePlayerId,
            'player_name'     => $game->getActivePlayerName(),
            'value_displayed' => $game->card_types['types'][$currentCard['type_arg']]['name'],
            'color_displayed' => $game->card_types['suites'][$currentCard['type']]['name'],
        ]
    );

    return NextPlayer::class;
}
```

> Si la fonction n'est pas déclarée dans l'état, le framework cherche dans `Game.php` (pour les actions disponibles à tout moment).

---

## 8. Fonction zombie

**Obligatoire** dans tous les états non-`GAME`. Gère le cas d'un joueur "zombifié" (déconnecté/AFK).

```php
public function zombie(int $playerId)
{
    $playable_cards = $this->game->getPlayableCards($playerId);
    if (count($playable_cards) == 0) {
        return NextPlayer::class;
    }
    $zombieChoice = $this->getRandomZombieChoice($playable_cards);
    return $this->actPlayCard((int)$zombieChoice, $playerId);
}
```

- Premier paramètre `int $playerId` → ID du joueur zombifié
- Si nommé `int $playerNo` / `int $player_no` → reçoit le numéro du joueur
- Accepte aussi `array $args` (résultat de `getArgs()`)
- Valeur de retour : identique à `onEnteringState`

---

## 9. Notes d'implémentation

### État de score final

Impossible de modifier l'état `endGame`. Recommandation : créer un état juste avant pour les calculs de score et statistiques.

---

### Sous-dossiers dans States/

Si des classes sont dans des sous-dossiers, le namespace doit refléter la structure pour que l'autoloading fonctionne.

---

### États privés parallèles

Utiles quand plusieurs joueurs sont actifs et leur tour est complexe. Chaque joueur peut être dans un état indépendant.

```php
// Entrée dans l'état maître MULTIPLE_ACTIVE_PLAYER
function onEnteringState() {
    $this->gamestate->setAllPlayersMultiactive();
    $this->gamestate->initializePrivateStateForAllActivePlayers();

    if ($someCondition) {
        $this->gamestate->nextPrivateStateForAllActivePlayers("chooseSecond");
        return;
    }
    if ($other_condition) {
        $this->gamestate->nextPrivateState($specificPlayerId, "chooseSecond");
        return;
    }
}

// Depuis une action, déplacer un joueur vers l'état suivant
function actToSecond() {
    $this->gamestate->nextPrivateState($this->getCurrentPlayerId(), "chooseSecond");
}
```

---

### Client States

Les Client States simulent une expérience similaire aux états privés serveur, sans changer l'état côté serveur.

> ⚠️ En `MULTIPLE_ACTIVE_PLAYER`, les changements d'état des autres joueurs déclenchent `onUpdateActionButtons` — prévoir des mesures pour préserver le client state.

Voir : [BGA Studio Cookbook – Client States](https://en.doc.boardgamearena.com/BGA_Studio_Cookbook#Multi_Step_Interactions:_Select_Worker.2FPlace_Worker_-_Using_Client_States)

---

### Constantes nommées pour les états

```php
<?php
declare(strict_types=1);

namespace Bga\Games\euro;

class StateConstants {
    const STATE_MULTI_PLAYER_TURN    = 4;
    const STATE_PLAYER_TURN_OP       = 12;
    const STATE_GAME_DISPATCH        = 13;
    const STATE_MULTI_PLAYER_TURN_OP = 14;
    const STATE_PLAYER_TURN_CONF     = 15;
    const STATE_MACHINE_HALTED       = 42;
    const STATE_END_GAME             = 99;
}
```

```php
parent::__construct($game,
    id: StateConstants::STATE_PLAYER_TURN_OP,
    type: StateType::ACTIVE_PLAYER,
    // ...
);
```

---

### Différence ACTIVE_PLAYER vs MULTIPLE_ACTIVE_PLAYER

| | `ACTIVE_PLAYER` | `MULTIPLE_ACTIVE_PLAYER` |
|---|---|---|
| Changement de joueur actif | ❌ Impossible pendant l'état | ✅ Possible à tout moment |
| Définir le joueur actif | Avant d'entrer dans l'état | Pendant l'état (dans `onEnteringState`) |
| Ordre JS (gameplay) | `onUpdateActionButtons` **avant** `onEnteringState` | `onEnteringState` : joueurs **pas encore actifs** |
| Usage de `onUpdateActionButtons` | Standard | Obligatoire pour les opérations dépendant du statut actif/inactif |

---

### Conception des états

**Règle générale** : la machine à états doit ressembler au "déroulement du tour" du livre de règles.

**Jeu simple (ex: échecs)** : 2 états suffisent — `playerTurn` + `gameTurn`.

**Jeu euro complexe** :
- Phase 1 (tout le monde piocher/défausser) → état `MULTIPLE_ACTIVE_PLAYER`
- Phase 2 (tour par joueur) → paire `ACTIVE_PLAYER` + `GAME`
- Phase 3 (résolution) → paire `ACTIVE_PLAYER` + `GAME`
- Fin de manche → état `GAME`

---

## 10. Migration depuis states.inc.php / Game.php

### Éléments déplacés

| Ancien emplacement | Nouveau |
|---|---|
| `"args" => "argXXX"` dans `states.inc.php` | Méthode `getArgs()` de la classe |
| `"action" => "stXXX"` dans `states.inc.php` | Méthode `onEnteringState()` de la classe |
| `zombie($state, $playerId)` | `zombie(int $playerId)` (sans le paramètre `$state`) |
| Tableau `possibleactions` dans `states.inc.php` | Attribut `#[PossibleAction]` sur chaque méthode |
| `$this->montrucDuGame` dans `Game.php` | `$this->game->montrucDuGame` depuis la State class |

### Éléments nouveaux

- Les fonctions `getArgs`, `onEnteringState`, `actXXX` et `zombie` acceptent les **paramètres magiques** auto-remplis.
- Ces mêmes fonctions peuvent **retourner une redirection** vers un état.
  > ⚠️ Si ce mécanisme est utilisé, supprimer tout appel à `$this->gamestate->nextState` pour éviter une double redirection.
- `initialPrivate` accepte désormais un nom de classe : `initialPrivate: PlaceCard::class`
- `GameStateBuilder::gameSetup(PlayDisc::class)->build()` accepte une classe d'état.
- Les fonctions comme `nextPrivateState` et `setPlayerNonMultiactive` acceptent aussi un nom de classe :
  ```php
  $this->gamestate->nextPrivateState(ConfirmTurn::class)
  $this->gamestate->setPlayerNonMultiactive($currentPlayerId, EndRound::class)
  ```
- Si toutes les classes sont migrées, `states.inc.php` peut être supprimé.

---

*Source : [en.doc.boardgamearena.com/State_classes:_State_directory](https://en.doc.boardgamearena.com/State_classes:_State_directory)*
