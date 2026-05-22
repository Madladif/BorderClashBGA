# Game interface logic : Game.js

> Source : https://en.doc.boardgamearena.com/Game_interface_logic:_Game.js  
> Dernière modification : 29 avril 2026

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Sous-composants du framework](#2-sous-composants-du-framework)
3. [Structure du fichier](#3-structure-du-fichier)
4. [États (States)](#4-états-states)
   - [JS State classes](#js-state-classes)
   - [Client states](#client-states)
5. [Framework Dojo](#5-framework-dojo)
6. [Minification JavaScript](#6-minification-javascript)
7. [Informations joueurs](#7-informations-joueurs)
8. [Accès et manipulation du DOM](#8-accès-et-manipulation-du-dom)
9. [Animations](#9-animations)
10. [Inputs joueurs](#10-inputs-joueurs)
11. [Notifications](#11-notifications)
12. [Tooltips](#12-tooltips)
13. [Banners](#13-banners)
14. [Messages d'avertissement](#14-messages-davertissement)
15. [Dialogues](#15-dialogues)
16. [Traductions](#16-traductions)
17. [Panneaux joueurs](#17-panneaux-joueurs)
18. [Boutons BGA](#18-boutons-bga)
19. [Chargement des images](#19-chargement-des-images)
20. [Sons](#20-sons)
21. [Barre de statut](#21-barre-de-statut)
22. [Préférences utilisateur](#22-préférences-utilisateur)
23. [Inclure des classes externes](#23-inclure-des-classes-externes)
24. [Divers](#24-divers)

---

## 1. Vue d'ensemble

`Game.js` est le fichier principal de l'interface du jeu. Il définit :

- Les actions sur la page qui génèrent des appels au serveur
- Ce qui se passe à la réception d'une notification serveur
- La mise en place de l'interface utilisateur

> **Note :** Ce fichier est désormais `Game.js`, situé dans `modules/js/`. L'ancien nom `yourgamename.js` à la racine est la variante legacy. La nouvelle version exporte une classe ES Module (pas d'extension de `gameui`). Pour accéder à des éléments de `gameui` non disponibles dans les sous-composants, utiliser `this.gameui.xx`.

---

## 2. Sous-composants du framework

Le framework est découpé en sous-composants accessibles via l'objet `bga` passé au constructeur :

`statusBar` · `sounds` · `gameArea` · `playerPanels` · `images` · `userPreferences` · `players` · `actions` · `notifications` · `dialogs`

```js
constructor(bga) {
    this.bga = bga;
    // Accès : this.bga.players.getCurrentPlayerId(), etc.
}
```

---

## 3. Structure du fichier

| Méthode | Description |
|---|---|
| `constructor` | Variables globales de l'interface |
| `setup(gamedatas)` | Mise en place de l'interface (appelé à chaque chargement/F5/undo) |
| `onEnteringState(stateName, args)` | Appelé à chaque entrée dans un état. *Optionnel si JS State classes utilisées.* |
| `onLeavingState(stateName)` | Appelé à chaque sortie d'un état. Nettoyage. *Optionnel si JS State classes utilisées.* |
| `onUpdateActionButtons(stateName, args)` | Gestion des boutons dans la barre de statut. *Optionnel si JS State classes utilisées.* |
| `setupNotifications()` | Association notifications → handlers JS |
| *(méthodes utilitaires)* | Helpers internes |
| *(handlers d'actions joueur)* | Réponses aux clics/interactions |
| *(handlers de notifications)* | Mise à jour de l'interface sur événements serveur |

### Détails des méthodes principales

**`setup(gamedatas)`** — Appelé quand :
- Le jeu démarre
- Un joueur ouvre la partie dans le navigateur
- F5 (rechargement)
- Undo côté serveur

**`onEnteringState(stateName, args)`**
- `args?.args` pour accéder aux arguments de l'état PHP
- Utiliser `this.bga.players.isCurrentPlayerActive()` pour cibler le joueur actif
- ⚠️ En `MULTIPLE_ACTIVE_PLAYER` : les joueurs ne sont **pas encore actifs** → utiliser `onUpdateActionButtons` à la place

**`onUpdateActionButtons(stateName, args)`**
- `args` peut être `null` (états `GAME` ou sans args)
- En `ACTIVE_PLAYER` : appelé **avant** `onEnteringState`
- En `MULTIPLE_ACTIVE_PLAYER` : ordre d'appel variable selon transition ou F5

---

## 4. États (States)

### JS State classes

Permet de découper le code par état. S'enregistre dans le constructeur :

```js
this.bga.states.register('PlayerTurn', new PlayerTurn(this, this.bga));
```

Structure d'une JS State class :

```js
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }

    // Appelé à l'entrée dans l'état
    onEnteringState(args, isCurrentPlayerActive) {}

    // Appelé à la sortie de l'état
    onLeavingState(args, isCurrentPlayerActive) {}

    // Appelé quand le joueur devient actif/inactif en MULTIPLE_ACTIVE_PLAYER
    // Peut aussi être appelé manuellement en fin de onEnteringState :
    // this.onPlayerActivationChange(args, isCurrentPlayerActive)
    onPlayerActivationChange(args, isCurrentPlayerActive) {}
}
```

**API des states :**

| Méthode | Description |
|---|---|
| `this.bga.states.register(stateIdOrName, stateClass)` | Enregistre une classe d'état |
| `this.bga.states.getCurrentMainStateName()` | Nom de l'état principal actuel (hors private) |
| `this.bga.states.getCurrentPlayerStateName()` | Nom de l'état du joueur actuel (private inclus) |
| `this.bga.states.getStateClass(stateName)` | Instance de la classe par nom |
| `this.bga.states.getCurrentMainStateClass()` | Instance de l'état principal actuel |
| `this.bga.states.getCurrentPlayerStateClass()` | Instance de l'état joueur actuel |
| `this.bga.states.getStateClasses()` | Toutes les classes enregistrées |
| `this.bga.states.logger = console.log` | Debug des changements d'état (à retirer en prod !) |

---

### Client states

Simule une transition d'état sans aller au serveur — utile pour les interactions multi-étapes.

```js
this.bga.states.setClientState("client_playerPicksLocation", {
    descriptionmyturn: _("${you} must select location"),
    args: { card_number: 5 }, // interpolation personnalisée
});
```

| Méthode | Description |
|---|---|
| `this.bga.states.setClientState(stateName, args)` | Entre dans un état client |
| `this.bga.states.restoreServerGameState()` | Retour à l'état serveur (undo léger) |
| `this.bga.states.isOnClientState()` | Retourne si on est dans un état client |

---

## 5. Framework Dojo

BGA utilise [Dojo](http://dojotoolkit.org/) en interne. Pour les nouveaux projets, **le JS natif est préféré**. Les exemples Dojo sont conservés pour lire les anciens jeux.

---

## 6. Minification JavaScript

Le JS est minifié avec **terser** à chaque déploiement. Depuis la page "Manage game", une version minifiée peut être testée sur le studio.

> ⚠️ Bug connu : problème avec les valeurs de pourcentage pour l'opacité.

---

## 7. Informations joueurs

| Méthode | Retour | Description |
|---|---|---|
| `this.bga.players.getCurrentPlayerId()` | `number` | ID du joueur qui regarde |
| `this.bga.players.getCurrentPlayerNo()` | `number \| null` | Numéro du joueur (null si spectateur) |
| `this.bga.players.isCurrentPlayerSpectator()` | `boolean` | Vrai si spectateur |
| `this.bga.players.isCurrentPlayerActive()` | `boolean` | Vrai si c'est le tour du joueur |
| `this.bga.players.getActivePlayerId()` | `number \| null` | ID du joueur actif (null si pas ACTIVE_PLAYER) |
| `this.bga.players.getActivePlayerNo()` | `number \| null` | Numéro du joueur actif |
| `this.bga.players.getActivePlayerIds()` | `number[]` | IDs de tous les joueurs actifs |
| `this.bga.players.getFormattedPlayerName(playerId, params?)` | `string` | Nom du joueur en HTML coloré. `{ replaceByYou: true }` affiche "You" |
| `this.bga.players.getPlayerById(playerId)` | `object` | Données du joueur depuis `gamedatas.players` |
| `this.bga.players.getPlayerByNo(playerNo)` | `object` | Idem par numéro |
| `this.bga.players.getActivePlayer()` | `object` | Données du joueur actif |
| `this.bga.players.getCurrentPlayer()` | `object` | Données du joueur courant |
| `this.bga.players.getPlayerAvatarUrl(playerId, size)` | `string` | URL avatar (size: 32, 50, 92 ou 184) |
| `this.bga.players.getPlayerNoById()` | `number \| null` | Numéro par ID |
| `this.bga.players.getPlayerIdByNo()` | `number` | ID par numéro |
| `this.gamedatas` | `object` | Données initiales du jeu (éviter de modifier la structure) |

```js
// Détecter mode lecture seule (spectateur, replay, archive)
isReadOnly() {
    return this.bga.players.isCurrentPlayerSpectator()
        || typeof g_replayFrom != 'undefined'
        || g_archive_mode;
}
```

> Pour masquer un élément aux spectateurs, utiliser la classe CSS `spectatorMode`.

---

## 8. Accès et manipulation du DOM

### Zone de jeu principale

```js
// Ajouter du HTML dans la zone de jeu
this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', html);
```

### Sélection d'éléments

```js
// BGA $ (équivalent getElementById avec vérifications)
$('mon_element').innerHTML = "valeur";

// JS natif (préféré)
document.getElementById('mon_element');
document.querySelector(".hand .card");           // premier résultat ou null
document.querySelectorAll(".hand .card");        // tous les résultats
document.getElementById('hand').querySelectorAll(".card");
```

### Styles

```js
// JS natif (préféré)
document.getElementById('elem').style.display = 'none';
document.getElementById('elem').style.removeProperty('display');

// BGA (pour toute une classe CSS)
this.bga.gameui.addStyleToClass('maClasse', 'display', 'none');

// Dojo (déprécié)
dojo.style('elem', 'display', 'none');
```

### Classes CSS

```js
document.getElementById(id).classList.add('possibleMove');
document.getElementById(id).classList.remove('possibleMove');
document.getElementById(id).classList.toggle('possibleMove');
document.getElementById(id).classList.toggle('possibleMove', condition); // add/remove selon booléen
document.querySelectorAll(".hand .card").forEach(e => e.classList.add('possibleMove'));
```

### Data attributes

```js
document.getElementById(token).dataset.tokenColor = 'red';
// Sélecteur CSS : .token[data-token-color="red"] { ... }
// Avantage : une seule valeur possible (set rouge efface automatiquement vert)
```

### Création / Suppression d'éléments

```js
// Dojo (encore utilisé couramment)
dojo.empty('ma_main');           // supprime tous les enfants
dojo.destroy('mon_token');       // supprime l'élément
dojo.query(".green", node).forEach(dojo.destroy); // supprime tous les .green dans node
dojo.create("div", { class: "yellow_arrow" }, parent); // crée et attache
```

```js
// BGA — formatage de blocs (templates .tpl)
var div = this.bga.gameui.format_block('jstpl_player_board', player);
var div = this.bga.gameui.format_string('<div color="${player_color}"></div>', { player_color: '#ff0000' });
// Équivalent moderne avec template literal :
const div = `<div color="${player_color}"></div>`;
```

### Déplacement d'éléments

**`dojo.place(node, refNode, pos?)`**

```js
dojo.place("<div class='foo'></div>", "conteneur");  // par défaut en dernier enfant
dojo.place($('mon_node'), "conteneur", "only");       // remplace tous les enfants
// pos : "before" | "after" | "replace" | "only" | "first" | "last" | number
```

**`this.bga.gameui.placeOnObject(mobile, target)`** — Positionne immédiatement (sans animation) `mobile` par-dessus `target` (centré). Souvent utilisé avant un `slideToObject`.

**`this.bga.gameui.placeOnObjectPos(mobile, target, x, y)`** — Idem avec offset (x,y) en px depuis le centre de `target`.

**`this.bga.gameui.attachToNewParent(mobile, target)`** — Change le parent HTML sans déplacer visuellement l'élément. Recalcule la position relative.  
> ⚠️ Détruit l'objet original et crée un clone → casse toutes les références existantes (ex: `dojo.connect`).

---

## 9. Animations

> 💡 **Recommandé** : utiliser la lib **[BgaAnimations](https://en.doc.boardgamearena.com/BgaAnimations)** en priorité.

### Vérifier si les animations sont actives

```js
if (this.bga.gameui.bgaAnimationsActive()) {
    // jouer une animation
} else {
    // appliquer directement l'état final
}
```

> Les fonctions d'animation BGA gèrent déjà ce check en interne.

### Sliding

**`this.bga.gameui.slideToObject(mobile, target, duration?, delay?)`** → Animation  
Fait glisser `mobile` vers `target`. Retourne une animation Dojo → **`.play()` obligatoire**.

```js
this.bga.gameui.slideToObject("un_token", "une_case").play();
```

**`this.bga.gameui.slideToObjectPos(mobile, target, x, y, duration?, delay?)`** → Animation  
Idem avec offset (x,y) en px par rapport au centre de `target`.

**`this.bga.gameui.slideTemporaryObject(html, parent, from, to, duration?, delay?)`** → Animation  
Crée un objet temporaire, le fait glisser, puis le détruit. **`.play()` non nécessaire.** Retourne une animation avec `.promise`.

```js
this.bga.gameui.slideTemporaryObject('<div class="token_icon"></div>', 'tokens', 'origine', 'cible');
// ou :
await this.bga.gameui.slideTemporaryObject(...).promise;
```

### Destroy

**`this.bga.gameui.slideToObjectAndDestroy(mobile, target, duration?, delay?)`** — Glisse puis détruit. **`.play()` non nécessaire.** Supporte `.promise`.

**`this.bga.gameui.fadeOutAndDestroy(node, duration?, delay?)`** — Fondu de sortie puis détruit. **`.play()` non nécessaire.** Supporte `.promise`.

> ⚠️ L'objet existe encore quelques ms après la fin de l'animation — ne pas recréer le même objet pendant ce temps.

### Rotation

```js
// Dojo Animation personnalisée (CSS transform)
var anim = new dojo.Animation({
    curve: [fromDegree, toDegree],
    onAnimate: (v) => { node.style.transform = `rotate(${v}deg)`; }
});
anim.play();

// BGA (additif : chaque appel ajoute au degré précédent)
this.bga.gameui.rotateTo(node, 90);         // animé
this.bga.gameui.rotateInstantTo(node, 90);  // instantané
```

### Callbacks d'animation

```js
var anim = this.bga.gameui.slideToObject(mobile, target, 500);
dojo.connect(anim, 'onEnd', () => { /* code après fin */ });
anim.play();

// Avec await (plus moderne)
const anim = this.bga.gameui.slideToObject(`disc_${x}${y}`, `square${x}_${y}`);
await this.bga.gameui.bgaPlayDojoAnimation(anim);
```

**`await this.bga.gameui.wait(delay)`** — Attend N millisecondes (résout instantanément si animations désactivées).

---

## 10. Inputs joueurs

### Connexion d'événements

```js
// Dojo connect (handler à stocker pour pouvoir déconnecter)
var handler = dojo.connect($('mon_elem'), 'onclick', this, 'onMonHandler');
dojo.disconnect(handler);

// BGA connect (stocke le handler automatiquement — pour éléments permanents)
this.bga.gameui.connect($('mon_elem'), 'onclick', 'onMonHandler');
this.bga.gameui.connect($('mon_elem'), 'onclick', (e) => { console.log('boo'); });
this.bga.gameui.connectClass('pet', 'onclick', 'onPet'); // tous les éléments .pet
this.bga.gameui.disconnect($('mon_elem'), 'onclick');
this.bga.gameui.disconnectAll();
```

> ⚠️ Si l'élément connecté via `this.bga.gameui.connect` est détruit, appeler `disconnect()` pour éviter les fuites mémoire.

Structure typique d'un handler :

```js
onPet(event) {
    var id = event.currentTarget.id;
    dojo.stopEvent(event);
    if (this.gamedatas.gamestate.name == 'playerTurnPet') {
        this.bga.actions.performAction('actPlayPet', { card: id });
    } else {
        this.bga.dialogs.showMoveUnauthorized();
    }
}
```

### Actions

**`this.bga.actions.performAction(action, args?, options?)`** → `Promise<void>`

Envoie une action au serveur PHP. **À utiliser uniquement en réaction à une action utilisateur** (jamais dans une boucle, callback, notification ou handler d'état).

Options par défaut : `{ lock: true, checkAction: true }`

```js
// Appel simple
this.bga.actions.performAction('pass');

// Avec args
this.bga.actions.performAction('actPlayCard', { id: this.selectedCardId });

// Sans vérification de joueur actif (multiactive)
this.bga.actions.performAction('actChangeMind', {}, { checkAction: false, checkPossibleActions: true });

// Sans lock
this.bga.actions.performAction('actSetAutoBid', { alwaysBidUntil: 500 }, { lock: false, checkAction: false });

// Tableau d'IDs (pour #[IntArrayParam] côté PHP)
this.bga.actions.performAction('actPlayCards', { ids: this.selectedCardIds });

// JSON complexe (pour #[JsonParam] côté PHP)
this.bga.actions.performAction('actPlanComplexStuff', { answer: JSON.stringify(obj) });

// Avec gestion d'erreur
this.bga.actions.performAction('actPlayCard', { id: id }).catch(() => { this.selectedCardId = undefined; });

// Avec callback succès
this.bga.actions.performAction('actPlayCard', { id: id }).then(() => { this.unselectAll(); });
```

> Noms d'args interdits : `$args`, `$activePlayerId`, `$active_player_id`, `$currentPlayerId`, `$current_player_id`

**`this.bga.actions.checkAction(action, nomessage?)`** → `boolean`  
Vérifie si l'action est possible (interface non verrouillée + joueur actif + action dans la liste).

**`this.bga.actions.checkPossibleActions(action)`** → `boolean`  
Comme `checkAction` mais indépendant du statut actif — utile en états multiactifs.

**`this.bga.gameui.checkLock(nomessage?)`** → `boolean`  
Vérifie si l'interface est verrouillée (cas avancés uniquement).

---

## 11. Notifications

### Auto-enregistrement (méthode recommandée)

**`this.bga.notifications.setupPromiseNotifications(params?)`**

Détecte automatiquement toutes les fonctions préfixées `notif_` et les enregistre.

```js
setupNotifications() {
    this.bga.notifications.setupPromiseNotifications();
}

// Handler async (la notification attend la fin de la Promise)
async notif_playedCard(args) {
    await this.getPlayerTable(args.playerId).playCard(args.card);
}

// Accès aux données complètes de la notification
async notif_playedCard(args, notif) {
    const message = notif.log;
}
```

Paramètres disponibles :

```js
this.bga.notifications.setupPromiseNotifications({
    prefix: 'notif_',          // préfixe des fonctions (défaut: 'notif_')
    minDuration: 500,          // durée minimale avec texte (défaut: 500ms)
    minDurationNoText: 1,      // durée minimale sans texte
    handlers: [this, ...this.bga.states.getStateClasses()], // sources des handlers
    logger: console.log,       // debug (null par défaut, retirer en prod)
    ignoreNotifications: ['updateAutoPlay'], // notifs ignorées par setup auto
    onStart: (name, msg, args) => {},
    onEnd: (name, msg, args) => {},
});
```

> ⚠️ Si le même `notif_xxx` est défini dans Game.js **et** dans une State class, les **deux** seront appelés.

### Enregistrement manuel

```js
setupNotifications() {
    dojo.subscribe('playDisc', this, "notif_playDisc");
    this.bga.gameui.notifqueue.setSynchronous('playDisc', 500); // délai après exécution
}

notif_playDisc(notif) {
    this.addDiscOnBoard(notif.args.x, notif.args.y, notif.args.player_id);
}
```

### Objet notification reçu côté client

| Propriété | Description |
|---|---|
| `type` | Type de la notification |
| `log` | Chaîne de log passée depuis PHP |
| `args` | Arguments passés depuis PHP |
| `bIsTableMsg` | `true` si `notify->all` (false si `notify->player`) |
| `channelorig` | Info table (`/table/t[TABLE_NUMBER]`) |
| `gamenameorig` | Nom du jeu |
| `move_id` | ID du mouvement associé |
| `table_id` | ID de la table (string) |
| `time` | Timestamp UNIX GMT |
| `uid` | Identifiant unique de la notification |

### Durée synchrone dynamique

```js
setupNotifications() {
    dojo.subscribe('cardPlayed', this, 'notif_cardPlayed');
    this.bga.gameui.notifqueue.setSynchronous('cardPlayed'); // durée dynamique
}

notif_cardPlayed(notif) {
    // OBLIGATOIRE : appeler setSynchronousDuration, sinon le jeu se fige !
    this.bga.gameui.notifqueue.setSynchronousDuration(notif.args.duration);
}
```

> ⚠️ Si une notification est **à la fois synchrone dynamique ET ignorable** conditionnellement → définir une valeur fixe suffisamment grande :  
> `this.bga.gameui.notifqueue.setSynchronous('myNotif', 5000);`

### Ignorer des notifications

```js
this.bga.gameui.notifqueue.setIgnoreNotificationCheck(
    'dealCard',
    (notif) => notif.args.player_id == this.bga.players.getCurrentPlayerId()
);
```

> ⚠️ La notification est reçue côté client même ignorée — ne pas l'utiliser pour cacher des informations sensibles.

### Types pré-définis

| Type | Usage |
|---|---|
| `tableWindow` | Affiche un dialogue de scoring (voir section Dialogues) |
| `message` | Log uniquement, aucun effet visuel |
| `simplePause` | Délai entre notifications (`time` en ms requis) |

```php
// PHP
$this->bga->notify->all('message', clienttranslate('hello'), []);
$this->bga->notify->all('simplePause', '', ['time' => 500]);
```

---

## 12. Tooltips

### Tooltips simples

```js
// Texte simple
this.bga.gameui.addTooltip('cardcount', _('Nombre de cartes en main'), '');

// HTML
this.bga.gameui.addTooltipHtml('card_42', '<div class="card-tooltip">...</div>');

// Sur toute une classe CSS
this.bga.gameui.addTooltipToClass('meeple', _('Ceci est un Meeple'), _('Cliquer pour interagir'));
this.bga.gameui.addTooltipHtmlToClass('meeple', html);

// Suppression
this.bga.gameui.removeTooltip('mon_element');
```

> ⚠️ Tous les nœuds concernés doivent exister et avoir un ID.  
> ⚠️ Les tooltips sont peu fiables sur mobile → prévoir une alternative (mode Aide, zone cliquable).

### Forcer l'ouverture d'un tooltip

```js
this.bga.gameui.tooltips[id].open(id);
```

---

## 13. Banners

### Dernière manche

```js
this.bga.gameArea.addLastTurnBanner(_('Dernier tour ! (pioche vide)'));
this.bga.gameArea.removeLastTurnBanner(); // si l'action déclenchante est annulée
```

### Condition de victoire

```js
const text = _('${player_name} atteint la case Victoire et gagne !');
this.bga.gameArea.addWinConditionBanner(
    text,
    { 'player_name': this.bga.players.getFormattedPlayerName(winnerId) }
);
```

---

## 14. Messages d'avertissement

**`this.bga.dialogs.showMessage(msg, type)`**

Affiche un message en haut de l'écran (disparaît après quelques secondes).

| `type` | Effet |
|---|---|
| `'info'` | Message informatif sur fond blanc |
| `'error'` | Message d'erreur sur fond rouge + ajout au log |
| `'only_to_log'` | Ajouté au log uniquement, sans popup |
| Chaîne custom | Transparent (définir `.head_xxx` en CSS) |

```js
this.bga.dialogs.showMessage(_('Ce n\'est pas votre tour !'), 'error');
```

> ⚠️ À utiliser avec parcimonie — le log de jeu est la voie normale.

**`this.bga.dialogs.showMoveUnauthorized()`** — Affiche l'erreur standard "action non autorisée".

---

## 15. Dialogues

### Confirmation

```js
this.bga.dialogs.confirmation(_("Voulez-vous vraiment passer ?")).then(result => {
    if (result) { this.passerMonTour(); }
});
return; // rien après cet appel
```

> ⚠️ Utiliser **très rarement** (actions irréversibles et rares uniquement).

### Choix multiple

```js
const keys = ["0", "1", "5", "10"];
this.bga.dialogs.multipleChoice(_("Combien de bugs corriger ?"), keys).then(choice => {
    if (choice === null) return; // annulé
    this.bga.actions.performAction("fixBugs", { number: keys[choice] });
});
return;
```

### Dialogue générique

```js
this.myDlg = new ebg.popindialog();
this.myDlg.create('myDialogUniqueId');
this.myDlg.setTitle(_("Titre de la fenêtre"));
this.myDlg.setMaxWidth(500);

var html = this.bga.gameui.format_block('jstpl_myTemplate', { arg1: val1 });
this.myDlg.setContent(html); // avant show() pour calculer la taille
this.myDlg.show();

// Connecter les éléments du dialogue après l'affichage
dojo.connect($('mon_bouton_ok'), 'onclick', this, (e) => {
    e.preventDefault();
    this.myDlg.destroy();
});

// Masquer/remplacer l'icône de fermeture
this.myDlg.hideCloseIcon();
this.myDlg.replaceCloseCallback((event) => { /* ... */ });
```

### Dialogues de scoring (`tableWindow`)

Gérés côté PHP, affichés côté client via une notification spéciale :

```php
// PHP
$this->bga->notify->all("tableWindow", '', [
    "id"      => 'finalScoring',
    "title"   => clienttranslate("Score final"),
    "table"   => $table,
    "header"  => ['str' => clienttranslate('Titre avec ${arg}'), 'args' => ['arg' => 3]],
    "footer"  => '<div class="myfoot"></div>',
    "closing" => clienttranslate("Fermer"),
]);

// $table : tableau 2D PHP (chaînes simples ou templates)
$table = [
    ["un", "deux", "trois"],
    ["quatre", "cinq", "six"],
];

// Cellule avec template (ex: nom de joueur coloré)
$cell = ['str' => '${player_name}', 'args' => ['player_name' => $name], 'type' => 'header'];
```

> ⚠️ Ne pas faire : `"footer" => '<div>'.clienttranslate("texte").'</div>'` — les traductions ne fonctionnent pas ainsi.

### Score animé

**`this.bga.gameui.displayScoring(anchor_id, color, score, duration?, offset_x?, offset_y?)`**

```js
this.bga.gameui.displayScoring('ma_zone', 'ff0000', '+3', 1000);
```

### Bulle de dialogue (speech bubble)

**`this.bga.gameui.showBubble(anchor_id, text, delay?, duration?, custom_class?)`**

```js
this.bga.gameui.showBubble('meeple_2', _('Bonjour !'), 0, 1000, 'pink_bubble');
```

> ⚠️ Si la bulle peut chevaucher des éléments cliquables, ajouter `pointer-events: none;` via une classe custom.

---

## 16. Traductions

Voir [Translations](https://en.doc.boardgamearena.com/Translations).

Utiliser `_('texte')` pour marquer les chaînes à traduire.

---

## 17. Panneaux joueurs

### Ajouter du contenu au panneau

```js
for (var player_id in gamedatas.players) {
    var player = gamedatas.players[player_id];
    const html = `<div class="cp_board">
        <div id="stoneicon_p${player.id}" class="gmk_stoneicon gmk_stoneicon_${player.color}"></div>
        <span id="stonecount_p${player.id}">0</span>
    </div>`;
    this.bga.playerPanels.getElement(player_id).insertAdjacentHTML('beforeend', html);
}
```

### Panneau pour un automate

```js
this.bga.playerPanels.addAutomataPlayerPanel(0, 'Tom', {
    iconClass: 'tom-avatar',
    score: gamedatas.tom.score,
    color: '#000000', // optionnel
});
```

### Activer / Désactiver les panneaux

```js
this.bga.gameui.disablePlayerPanel(player_id);  // fond gris
this.bga.gameui.enablePlayerPanel(player_id);
this.bga.gameui.enableAllPlayerPanels();
```

### Ordre des joueurs

```js
this.bga.gameui.updatePlayerOrdering(); // sync avec this.gamedatas.playerorder
```

### Compteurs

```js
// Compteur de score
this.bga.playerPanels.getScoreCounter(player_id);

// Autres compteurs : utiliser la lib ebg/counter
// Voir : https://en.doc.boardgamearena.com/Counter
```

---

## 18. Boutons BGA

**`this.bga.statusBar.addActionButton(label, callback, params?)`** → `HTMLButtonElement`

```js
// Bouton simple
this.bga.statusBar.addActionButton(_('Passer'), () => this.bga.actions.performAction('actPass', {}));

// Bouton avec paramètres
this.bga.statusBar.addActionButton(_('Passer'), () => this.bga.actions.performAction('actPass', {}), {
    id: 'mon_bouton',
    color: 'secondary',     // 'primary' (bleu, défaut) | 'secondary' (gris) | 'alert' (rouge)
    classes: 'ma-classe',
    disabled: true,
    tooltip: _('Vous ne pouvez pas passer'),
    confirm: _('Êtes-vous sûr de vouloir passer ?'),
});

// Confirmation dynamique
this.bga.statusBar.addActionButton(_('Défausser'), () => { ... }, {
    confirm: () => {
        if (this.getSelectedCardIds().length === 0) {
            return _('Aucune carte sélectionnée, continuer ?');
        }
        return null; // pas de confirmation si cartes sélectionnées
    }
});

// Bouton avec auto-clic (timer de confirmation)
this.bga.statusBar.addActionButton(_('Confirmer'), () => this.bga.actions.performAction('actConfirm', {}), {
    autoclick: true,
    // ou avec pause :
    autoclick: { pausable: true },
});

// Auto-clic avec bouton d'annulation
const abortController = new AbortController();
this.bga.statusBar.addActionButton(_('Confirmer'), () => { ... }, {
    autoclick: { abortSignal: abortController.signal }
});
this.bga.statusBar.addActionButton(_("Laisser-moi réfléchir"), () => abortController.abort(), { color: 'secondary' });

// Supprimer tous les boutons
this.bga.statusBar.removeActionButtons();
```

---

## 19. Chargement des images

> ⚠️ Toutes les images à la **racine** de `img/` sont préchargées. Les sous-dossiers ne le sont pas.

```js
// Ne pas précharger
this.bga.images.dontPreloadImage('cards.png');
this.bga.images.dontPreloadImages(['clan1.png', 'clan2.png']);

// Précharger (utile pour les sous-dossiers)
this.bga.images.preloadImages(['expansion/board.jpg', 'expansion/new-cards.jpg']);

// Obtenir l'URL d'une image
const url = this.bga.images.getImgUrl('board.jpg');
const url = this.bga.images.getImgUrl('expansion/board.jpg');
const baseUrl = this.bga.images.getImgUrl(); // URL jusqu'à img/
```

---

## 20. Sons

> ⚠️ Chaque son requiert un fichier `.ogg` **et** `.mp3` dans le dossier `sounds/`. Tous les sons à la racine sont préchargés.

```js
// Ne pas précharger
this.bga.sounds.dontPreloadSounds(['automata-move']); // sans extension

// Précharger (sous-dossiers)
this.bga.sounds.preloadSounds(['expansion/extramove']);

// Jouer un son
this.bga.sounds.play('play');
this.bga.sounds.play('claw');

// Désactiver le son "move" standard pour ce coup (remplacé par son custom)
this.bga.gameui.disableNextMoveSound();
```

---

## 21. Barre de statut

### Texte

**`this.bga.statusBar.setTitle(title, args?)`** — Met à jour le titre (sans déclencher `onUpdateActionButtons`).

```js
this.bga.statusBar.setTitle(
    this.bga.players.isCurrentPlayerActive()
        ? _('${you} devez jouer une carte')
        : _('${actplayer} doit jouer une carte'),
    args
);
```

> `this.bga.gameui.updatePageTitle()` — Identique mais déclenche aussi `onUpdateActionButtons`. **Déprécié**, préférer `setTitle`.

---

## 22. Préférences utilisateur

```js
// Lire une préférence
this.bga.userPreferences.get(pref_id);

// Modifier une préférence
this.bga.userPreferences.set(pref_id, value);

// Réagir aux changements
this.bga.userPreferences.onChange = (pref_id, pref_value) => {
    this.myGamePreferenceChanged(pref_id, pref_value);
};

myGamePreferenceChanged(pref_id, pref_value) {
    switch (pref_id) {
        case 201:
            document.getElementsByTagName('html')[0]
                .classList.toggle('dark-background', pref_value == 2);
            break;
    }
}

// Masquer/afficher une préférence
this.bga.userPreferences.toggleVisibility(pref_id, visible);
```

---

## 23. Inclure des classes externes

```js
// Dans un fichier externe (ex: PlayerManager.js)
export class PlayerManager { ... }
export class PlayerTable { ... }

// Dans Game.js
import { PlayerManager, PlayerTable } from "./PlayerManager.js";
```

Plusieurs classes peuvent être déclarées dans Game.js, tant que la classe `Game` est exportée en export default.

---

## 24. Divers

| Variable / Méthode | Description |
|---|---|
| `this.bga.gameui.onScreenWidthChange()` | À surcharger pour gérer le redimensionnement du viewport |
| `this.bga.gameui.bRealtime` | `true` si le jeu est en temps réel |
| `typeof g_replayFrom != 'undefined'` | `true` si en mode replay **pendant** la partie |
| `g_archive_mode` | `true` si en mode archive **après** la partie |
| `this.bga.gameui.instantaneousMode` | `true` pendant replay/archive si animations à sauter (géré automatiquement par les libs BGA) |
| `g_tutorialwritten` | Objet avec infos du tutoriel, ou `undefined` si pas en mode tutoriel |

---

*Source : [en.doc.boardgamearena.com/Game_interface_logic:_Game.js](https://en.doc.boardgamearena.com/Game_interface_logic:_Game.js)*
