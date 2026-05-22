# bga-cards — Documentation complète (v1.0.13)

> Sources : [BgaCards wiki BGA](https://en.doc.boardgamearena.com/BgaCards) · [API TypeDoc 1.0.13](https://x.boardgamearena.net/data/game-libs/bga-cards/1.0.13/docs/index.html)  
> Dernière maj wiki : 12 mars 2026

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Chargement de la bibliothèque](#2-chargement-de-la-bibliothèque)
3. [CardManager — Gestionnaire de cartes](#3-cardmanager--gestionnaire-de-cartes)
4. [CardStock — Classe de base des stocks](#4-cardstock--classe-de-base-des-stocks)
5. [Types de stocks disponibles](#5-types-de-stocks-disponibles)
6. [Sélection de cartes](#6-sélection-de-cartes)
7. [Sprites et faces de cartes](#7-sprites-et-faces-de-cartes)
8. [Pièges connus](#8-pièges-connus)
9. [TypeScript](#9-typescript)
10. [Changelog](#10-changelog)
11. [Liens utiles](#11-liens-utiles)

---

## 1. Vue d'ensemble

**bga-cards** est une bibliothèque JavaScript pour afficher et animer des cartes dans un jeu BGA.  
Elle gère : l'affichage des cartes dans des "stocks", les animations de déplacement entre stocks, le flip face/dos, la sélection.

Elle repose sur **bga-animations** (dépendance obligatoire).

Exemples de jeux utilisant bga-cards : *Frenchtarot* (JS), *Verso* (TypeScript), le [tutoriel Hearts](https://en.doc.boardgamearena.com/Tutorial_hearts).

---

## 2. Chargement de la bibliothèque

### ES Modules (méthode recommandée)

```js
// bga-animations DOIT être chargé avant bga-cards
const BgaAnimations = await importEsmLib('bga-animations', '1.x');
const BgaCards      = await importEsmLib('bga-cards', '1.x');
```

### Legacy (define / Dojo)

```js
define([
    "dojo", "dojo/_base/declare",
    "ebg/core/gamegui",
    "ebg/counter",
    getLibUrl('bga-animations', '1.x'), // obligatoire en premier
    getLibUrl('bga-cards', '1.x'),
],
function (dojo, declare, gamegui, counter, BgaAnimations, BgaCards) {
    // BgaAnimations doit correspondre à l'index dans le tableau define
```

> **Versioning** : la bibliothèque utilise semver. Utiliser `'1.x'` garantit les dernières corrections sans risque de breaking change.

---

## 3. CardManager — Gestionnaire de cartes

`BgaCards.Manager` (alias de `CardManager`) est le point central. Il configure le rendu de toutes les cartes et est passé à chaque stock.

### Instanciation

```js
this.animationManager = new BgaAnimations.Manager({
    animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
});

this.cardsManager = new BgaCards.Manager({
    animationManager: this.animationManager, // obligatoire

    // Préfixe de classe CSS → génère .mygame-card sur chaque élément carte
    type: 'mygame-card',

    // Retourne l'ID unique de la carte (string ou number)
    getId: (card) => `card-${card.id}`,

    // Configure le div face visible
    setupFrontDiv: (card, div) => {
        div.dataset.type    = card.type;
        div.dataset.typeArg = card.type_arg;
        this.bga.gameui.addTooltipHtml(div.id, _(card.type_name ?? ''));
    },

    // Configure le div face dos (obligatoire pour le flip)
    setupBackDiv: (card, div) => {
        div.classList.add('mygame-card-back');
    },

    // true → face visible / false → dos visible
    // !!card.type = false si le serveur n'envoie pas le type (carte cachée)
    isCardVisible: (card) => !!card.type,
});
```

> Ne créer qu'**un seul** `animationManager` par jeu — le réutiliser dans tous les managers et stocks.

### Méthodes CardManager

| Méthode | Retour | Description |
|---|---|---|
| `getId(card)` | `string\|number` | Retourne l'id de la carte |
| `getCardElementId(card)` | `string` | Retourne l'id HTML de l'élément carte |
| `getCardElement(card)` | `HTMLElement` | Retourne l'élément HTML d'une carte existante |
| `getCardStock(card)` | `CardStock` | Retourne le stock contenant la carte |
| `getCardWidth()` | `number` | Largeur définie dans les settings |
| `getCardHeight()` | `number` | Hauteur définie dans les settings |
| `getCardBorderRadius()` | `string` | Border-radius défini dans les settings |
| `getCardRotation(card)` | `number` | Rotation de la carte (0 par défaut) |
| `isCardVisible(card)` | `boolean` | Détermine si la face est visible |
| `setCardVisible(card, visible?, settings?)` | `void` | Affiche face ou dos |
| `flipCard(card, settings?)` | `void` | Retourne la carte |
| `updateCardInformations(card, settings?)` | `void` | Met à jour les données d'une carte (révélation) |
| `createCardElement(card, initialSide?)` | `HTMLDivElement` | Crée l'élément DOM d'une carte |
| `placeCard(card)` | `Promise<boolean>` | Place une carte selon les settings `autoPlace` des stocks |
| `placeCards(cards[])` | `Promise` | Place plusieurs cartes |
| `removeCard(card, settings?)` | `Promise<boolean>` | Supprime une carte |
| `addStock(stock)` | `void` | Enregistre un stock |
| `removeStock(stock)` | `void` | Désenregistre un stock |
| `setLastPlayedCard(card, color?, cardClass?)` | `void` | Marque la dernière carte jouée |
| `setLastPlayedCards(cards[], color?, cardClass?)` | `void` | Marque plusieurs dernières cartes jouées |
| `getType()` | `string` | Type des cartes (depuis settings) |
| `getSelectableCardStyle()` | `SelectionStyle` | Style des cartes sélectionnables (classe CSS par défaut : `bga-cards_selectable-card`) |
| `getSelectedCardStyle()` | `SelectionStyle` | Style des cartes sélectionnées (classe CSS par défaut : `bga-cards_selected-card`) |
| `getUnselectableCardStyle()` | `SelectionStyle` | Style des cartes non sélectionnables (classe CSS par défaut : `bga-cards_unselectable-card`) |
| `getLastPlayedCardStyle()` | `SelectionStyle` | Style de la dernière carte jouée (classe CSS par défaut : `bga-cards_last-played-card`) |
| `getSelectableSlotStyle()` | `SelectionStyle` | Style des slots sélectionnables (classe CSS par défaut : `bga-cards_selectable-slot`) |
| `getSelectedSlotStyle()` | `SelectionStyle` | Style des slots sélectionnés (classe CSS par défaut : `bga-cards_selected-slot`) |
| `getUnselectableSlotStyle()` | `SelectionStyle` | Style des slots non sélectionnables (classe CSS par défaut : `bga-cards_unselectable-slot`) |
| `getCardClickEventFilter()` | `CardClickEventFilter` | Filtre sur les clics (défaut : `'selectable'`) |
| `getFakeCardGenerator()` | `function` | Générateur de fausses cartes pour les decks |

---

## 4. CardStock — Classe de base des stocks

`CardStock` est la classe abstraite dont héritent tous les stocks. Elle ne doit pas être utilisée directement.

### Constructeur (commun à tous les stocks)

```js
new BgaCards.LineStock(manager, element, settings?)
//                    ↑           ↑         ↑
//              CardManager   HTMLElement   CardStockSettings (optionnel)
```

### Callbacks disponibles sur tous les stocks

```js
stock.onCardClick        = (card) => { /* carte cliquée */ };
stock.onCardAdded        = (card) => { /* carte ajoutée */ };
stock.onCardRemoved      = (card) => { /* carte retirée */ };
stock.onCardCountChange  = (count) => { /* nombre de cartes changé */ };
stock.onSelectionChange  = (selection, lastChange) => { /* sélection modifiée */ };
```

### Méthodes CardStock (héritées par tous les stocks)

#### Ajout / retrait de cartes

| Méthode | Retour | Description |
|---|---|---|
| `addCard(card, settings?)` | `Promise<boolean>` | Ajoute une carte (animé) |
| `addCards(cards[], settings?, shift?)` | `Promise<boolean>` | Ajoute un tableau de cartes. `shift` = délai ms entre chaque carte (ou `true` pour chaîner) |
| `removeCard(card, settings?)` | `Promise<boolean>` | Retire une carte (animé) |
| `removeCards(cards[], settings?)` | `Promise<boolean>` | Retire plusieurs cartes |
| `removeAll(settings?)` | `Promise<boolean>` | Vide le stock |
| `cardRemoved(card, settings?)` | `void` | Notifie le stock qu'une carte a été retirée (usage interne) |

**Paramètres `AddCardSettings`** (optionnels) :

```js
stock.addCard(card, {
    fromElement: document.getElementById('source-div'), // origine de l'animation
    // ...autres options selon le stock
});
```

**Paramètres `RemoveCardSettings`** (optionnels) :

```js
stock.removeCard(card, {
    fadeOut: true,                                        // fondu
    slideTo: document.getElementById('discard-zone'),    // glissement vers un élément
});
```

#### Lecture

| Méthode | Retour | Description |
|---|---|---|
| `getCards()` | `T[]` | Toutes les cartes du stock |
| `getCardCount()` | `number` | Nombre de cartes |
| `isEmpty()` | `boolean` | Vrai si le stock est vide |
| `contains(card)` | `boolean` | Vrai si la carte est dans le stock |
| `getCardElement(card)` | `HTMLElement` | Élément HTML de la carte |
| `getSelection()` | `T[]` | Cartes sélectionnées |
| `getSelectionMode()` | `CardSelectionMode` | Mode de sélection courant |

#### Sélection

| Méthode | Description |
|---|---|
| `setSelectionMode(mode, selectableCards?)` | `'none'` / `'single'` / `'multiple'` — désélectionne tout si `'none'` |
| `setSelectableCards(cards?)` | Définit quelles cartes sont sélectionnables (toutes si non défini) |
| `selectCard(card, silent?)` | Sélectionne une carte |
| `unselectCard(card, silent?)` | Désélectionne une carte |
| `selectAll(silent?)` | Sélectionne toutes les cartes |
| `unselectAll(silent?)` | Désélectionne toutes les cartes |
| `isSelectable(card)` | Vrai si la carte est sélectionnable |
| `isSelected(card)` | Vrai si la carte est sélectionnée |
| `setSelectionStyleOverrides(element)` | Surcharge les styles de sélection sur un élément |

#### Autres

| Méthode | Description |
|---|---|
| `setSort(sortFn?)` | Définit une fonction de tri (réordonne immédiatement) |
| `flipCard(card, settings?)` | Retourne une carte |
| `setCardVisible(card, visible, settings?)` | Face visible ou non |
| `setLastPlayedCards(cards[], color?)` | Marque les dernières cartes jouées |
| `removeLastPlayedCardsClass(cardClass?)` | Retire le marquage |
| `remove()` | Supprime le stock et le désenregistre du manager |
| `shouldPlaceCard(card)` | Indique si la carte doit aller dans ce stock (autoPlace) |

---

## 5. Types de stocks disponibles

### Hiérarchie

```
CardStock (abstraite)
├── LineStock          → rangée de cartes (main joueur, tableau)
├── HandStock          → main joueur avec gestion de largeur
├── Deck               → pioche (carte du dessus visible)
├── AllVisibleDeck     → deck avec toutes les cartes visibles
├── DiscardDeck        → défausse
├── GridStock          → grille de cartes
├── SlotStock          → slots nommés/indexés
├── ScrollableStock    → rangée scrollable
├── ManualPositionStock→ positionnement manuel absolu
└── VoidStock          → zone de suppression (animations de sortie)
```

### LineStock

Stock standard en ligne. Utilisé pour les mains, les rangées de table.

```js
this.handStock = new BgaCards.LineStock(
    this.cardsManager,
    document.getElementById('mygame-hand'),
    {
        // Options optionnelles
        // sort: (a, b) => parseInt(a.type) - parseInt(b.type),
        // autoPlace: true, // place automatiquement les cartes selon leur location
    }
);

await this.handStock.addCards(Object.values(gamedatas.hand)); // Object.values() obligatoire !
```

### HandStock

Étend `LineStock`. Gère les problèmes de largeur de conteneur flexible (fix du "blinking" en 1.0.7).

```js
this.handStock = new BgaCards.HandStock(
    this.cardsManager,
    document.getElementById('mygame-hand')
);
```

### Deck (pioche — carte du dessus visible)

```js
this.deckStock = new BgaCards.Deck(
    this.cardsManager,
    document.getElementById('mygame-deck'),
    {
        cardNumber: gamedatas.deckCount, // nombre affiché sur le compteur
        // topCard: gamedatas.topCard,  // carte du dessus si visible
    }
);
```

### AllVisibleDeck

Deck où toutes les cartes sont visibles (empilées).

```js
this.deck = new BgaCards.AllVisibleDeck(
    this.cardsManager,
    document.getElementById('mygame-all-visible-deck'),
    { cardNumber: gamedatas.deckCount }
);
```

### DiscardDeck (défausse)

```js
this.discardStock = new BgaCards.DiscardDeck(
    this.cardsManager,
    document.getElementById('mygame-discard'),
    { cardNumber: gamedatas.discardCount }
);
```

### GridStock

Grille de cartes.

```js
this.gridStock = new BgaCards.GridStock(
    this.cardsManager,
    document.getElementById('mygame-grid'),
    {
        columns: 4,
        // rows: 3, // optionnel
    }
);
```

### SlotStock

Slots nommés ou indexés. Utile pour des emplacements fixes sur le plateau.

```js
this.slotStock = new BgaCards.SlotStock(
    this.cardsManager,
    document.getElementById('mygame-slots'),
    {
        slotsIds: ['slot-1', 'slot-2', 'slot-3'],
        // getSlotId: (card) => `slot-${card.location_arg}`,
    }
);
```

### ScrollableStock

Rangée horizontale avec scroll.

```js
this.scrollStock = new BgaCards.ScrollableStock(
    this.cardsManager,
    document.getElementById('mygame-scroll')
);
```

### ManualPositionStock

Positionnement absolu manuel de chaque carte.

```js
this.manualStock = new BgaCards.ManualPositionStock(
    this.cardsManager,
    document.getElementById('mygame-board'),
    {
        getCardPosition: (card) => ({
            top: card.y * 100,
            left: card.x * 80,
        }),
    }
);
```

### VoidStock

Zone de suppression. Les cartes y sont envoyées avec animation de sortie.

```js
this.voidStock = new BgaCards.VoidStock(
    this.cardsManager,
    document.getElementById('mygame-void')
);

// Alternative sans VoidStock — removeCards avec options d'animation
await this.lineStock.removeCards(cards, {
    fadeOut: true,
    slideTo: document.getElementById('other-hand'),
});
```

> **Note v1.0.7** : VoidStock manque encore certaines animations (shrink, fadeOut). L'alternative ci-dessus avec `removeCards` + options est souvent préférable.

---

## 6. Sélection de cartes

### Modes de sélection

| Mode | Comportement |
|---|---|
| `'none'` | Aucune sélection possible (désélectionne tout) |
| `'single'` | Une seule carte sélectionnable à la fois |
| `'multiple'` | Plusieurs cartes sélectionnables |

```js
// Activer la sélection simple
this.handStock.setSelectionMode('single');

// Sélection multiple sur certaines cartes seulement
this.handStock.setSelectionMode('multiple', [card1, card2]);

// Désactiver
this.handStock.setSelectionMode('none');

// Récupérer la sélection
const selected = this.handStock.getSelection(); // retourne T[]

// Callback sur changement de sélection
this.handStock.onSelectionChange = (selection, lastChange) => {
    console.log('Sélection:', selection);
};

// Callback sur clic (carte sélectionnée ou non)
this.handStock.onCardClick = (card) => {
    this.handStock.selectCard(card);
};
```

### Styles de sélection (classes CSS par défaut)

| État | Classe CSS appliquée |
|---|---|
| Sélectionnable | `bga-cards_selectable-card` |
| Sélectionné | `bga-cards_selected-card` |
| Non sélectionnable | `bga-cards_unselectable-card` |
| Slot sélectionnable | `bga-cards_selectable-slot` |
| Slot sélectionné | `bga-cards_selected-slot` |
| Dernière carte jouée | `bga-cards_last-played-card` |

Ces classes peuvent être surchargées via les settings du `CardManager`.

---

## 7. Sprites et faces de cartes

### Positionnement de sprite via JS

```js
setupFrontDiv: (card, div) => {
    // 14 = nombre de colonnes dans le sprite - 1
    // 3  = nombre de lignes dans le sprite - 1
    div.style.backgroundPositionX = `calc(100% / 14 * (${card.type_arg} - 2))`;
    div.style.backgroundPositionY = `calc(100% / 3 * (${card.type} - 1))`;
}
```

### Positionnement via data-attributes + CSS (recommandé)

```js
setupFrontDiv: (card, div) => {
    div.dataset.type    = card.type;    // ex: couleur 1..4
    div.dataset.typeArg = card.type_arg; // ex: valeur 2..14
}
```

```css
.mygame-card .card-front {
    background-image: url('img/cards.png');
    /* CRITIQUE : même unité pour background-size et background-position */
    background-size: calc(100% / 7) auto;
    background-position-x: calc(100% / 6 * var(--col));
}

/* Cibler les cartes via data-attributes */
.mygame-card[data-type="1"][data-type-arg="14"] .card-front {
    /* as de pique */
}
```

> ⚠️ **Règle critique** : toujours utiliser la **même unité** (`%` ou `px`) pour `background-size` et `background-position`. Mélanger les deux provoque un décalage visible sur Safari.

### Cartes recto-verso (flip)

Pour activer le flip, définir `setupBackDiv` ET `isCardVisible` dans le manager :

```js
this.cardsManager = new BgaCards.Manager({
    // ...
    setupBackDiv: (card, div) => {
        div.classList.add('mygame-card-back');
    },
    isCardVisible: (card) => !!card.type, // false = dos affiché
});

// Flip programmatique
stock.setCardVisible(card, true);  // → face
stock.setCardVisible(card, false); // → dos
stock.flipCard(card);              // → bascule

// Révéler une carte cachée (mise à jour des données)
manager.updateCardInformations(card); // appelle setupFrontDiv avec les nouvelles données
```

---

## 8. Pièges connus

### Conversion PHP → JS : objet vs tableau

PHP `Deck::getCardsInLocation()` retourne un **objet indexé**, pas un tableau. `addCards()` attend un tableau :

```js
// ✓ Correct
this.handStock.addCards(Object.values(gamedatas.hand));

// ✗ Incorrect
this.handStock.addCards(gamedatas.hand);
```

Alternative côté PHP (évite `Object.values()` côté JS) :

```php
$result['hand'] = array_values($this->cards->getCardsInLocation('hand', $current_player_id));
```

### Typage PHP → JS : strings vs integers

PHP envoie `type` et `type_arg` comme **strings**, même si ce sont des nombres. Les méthodes `BgaCards.sort` attendent des integers.

```js
// Conversion à la réception des données
const cards = Object.values(gamedatas.hand).map(card => ({
    ...card,
    type:     parseInt(card.type),
    type_arg: parseInt(card.type_arg),
}));
```

Voir `remapToBgaCard` dans le tutoriel Hearts pour un helper complet.

### Asynchronicité : addCards + setSelectableCards

`addCards()` est **async** mais `setSelectableCards()` ne l'est pas. Si appelés en séquence dans `setup()` ou `onEnteringState()`, les cartes peuvent ne pas être encore dans le DOM :

```js
// ✗ Problème fréquent
async setup(gamedatas) {
    this.handStock.addCards(Object.values(gamedatas.hand)); // non awaitée !
    // ...
}
onEnteringState(args, isActive) {
    this.handStock.setSelectableCards('single'); // les cartes ne sont pas encore là
}

// ✓ Solution 1 : await dans une méthode async dédiée
async _initStocks(gamedatas) {
    await this.handStock.addCards(Object.values(gamedatas.hand));
}

// ✓ Solution 2 : setTimeout
this.handStock.onEnteringState = () => {
    setTimeout(() => this.handStock.setSelectableCards('single'), 0);
};
```

### CSS : sélecteurs sur éléments animés

Les animations **clonent** l'élément carte (nouvel ID, nouveau parent DOM). Utiliser uniquement des **sélecteurs de classe** :

```css
/* ✓ Correct */
.mygame-card { width: 80px; height: 120px; }

/* ✗ Cassé après clonage */
#card-42 { width: 80px; }
.mygame-hand .mygame-card { ... }
```

### Safari : drop-shadow coûteux

```css
.mygame-card { filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.4)); }
html.dj_safari .mygame-card { filter: none; } /* désactiver sur Safari */
```

### VoidStock : animations manquantes (v1.0.7)

VoidStock ne supporte pas encore shrink/fadeOut nativement. Utiliser `removeCards` avec options :

```js
await this.lineStock.removeCards(cards, {
    fadeOut: true,
    slideTo: document.getElementById('other-zone'),
});
```

### Sélection en doublon (v1.0.10+)

`selectCard()` ne sélectionne plus une carte déjà sélectionnée (fix 1.0.10).

---

## 9. TypeScript

Télécharger le fichier de types `.d.ts` :

```
https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/dist/bga-cards.d.ts
```

Placer dans le dossier du jeu. Si la dernière ligne (`export`) pose problème selon le build, la supprimer.

Si la classe du jeu n'est pas déclarée dans le callback `define`, ajouter ce contournement pour éviter `ReferenceError: BgaAnimations is not defined` :

```ts
define([
    "dojo", "dojo/_base/declare",
    "ebg/core/gamegui",
    getLibUrl('bga-animations', '1.x'),
    getLibUrl('bga-cards', '1.x'),
],
function (dojo, declare, gamegui, BgaAnimations, BgaCards) {
    (window as any).BgaAnimations = BgaAnimations; // contournement obligatoire
    (window as any).BgaCards = BgaCards;
    return declare("bgagame.mygame", ebg.core.gamegui, new MyGame());
});
```

---

## 10. Changelog

| Version | Changements |
|---|---|
| **1.0.13** | *(version de référence de cette doc)* |
| **1.0.12** | Fix duplication lors de l'ajout d'une carte dans un autre slot du même stock |
| **1.0.11** | Fix `lastPlayedCardStyle` non entièrement appliqué |
| **1.0.10** | Suppression des required settings incorrects de `GridStockSettings` / demo de déplacement de carte dans un slot stock avec `addCard` / empêche la sélection multiple d'une même carte programmatiquement / fix `getLastPlayedCardStyle` lisant `settings?.selectedCardStyle` |
| **1.0.9** | Fix signature `VoidStock.addCards` |
| **1.0.8** | Fix slot & card selection override |
| **1.0.7** | Fix `HandStock` blinking sur conteneur de largeur flexible / fix mauvais numéro de deck au constructeur / fix `removeCard.fadeOut` sans `slideTo` |
| **1.0.6** | Fix `autoPlace` avec `VoidStock` |
| **1.0.5** | Fix sélection de la carte parente si elle contient une carte enfant |
| **1.0.4** | Fix erreur sur `emptyHandMessage` non défini |
| **1.0.3** | Fix `emptyHandMessage` en conflit avec sort |
| **1.0.2** | Fix surcharge du style de sélection |
| **1.0.1** | Fix documentation |
| **1.0.0** | Version initiale |

---

## 11. Liens utiles

| Ressource | URL |
|---|---|
| Wiki BGA — BgaCards | https://en.doc.boardgamearena.com/BgaCards |
| API TypeDoc 1.0.13 | https://x.boardgamearena.net/data/game-libs/bga-cards/1.0.13/docs/index.html |
| API TypeDoc 1.x (dernière) | https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/docs/index.html |
| Démo + code source | https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/demo/index.html |
| Fichier .d.ts TypeScript | https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/dist/bga-cards.d.ts |
| BgaAnimations wiki | https://en.doc.boardgamearena.com/BgaAnimations |
| BgaAnimations API | https://x.boardgamearena.net/data/game-libs/bga-animations/1.x/docs/index.html |
| Tutoriel Hearts (avec bga-cards) | https://en.doc.boardgamearena.com/Tutorial_hearts |
| Tutoriel Reversi | https://en.doc.boardgamearena.com/Tutorial_reversi |
| Game.js | https://en.doc.boardgamearena.com/Game_interface_logic:_Game.js |
| Game.php | https://en.doc.boardgamearena.com/Main_game_logic:_Game.php |
