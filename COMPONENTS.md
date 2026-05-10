# COMPONENTS.md — BGA Components Used

---

## Server-side (PHP)

### BGA Deck — card management

Used for all card movement: personal decks, shared draw piles, hands, grids.

Custom table: `bc_card` (not the reserved name `card`). See DESIGN.md for schema.

Key usage:
```php
// Initialization in setupNewGame
$this->cards = $this->bga->deckFactory->createDeck('bc_card');

// Move cards
$this->cards->moveCard($cardId, 'hand', $playerId);
$this->cards->moveCard($cardId, "grid_{$playerId}", $gridPosition);

// Get player's hand
$hand = $this->cards->getCardsInLocation('hand', $playerId);

// Get player's grid
$grid = $this->cards->getCardsInLocation("grid_{$playerId}");
```

### PlayerCounter — gem tracking

Two counters per player: `gems_charged` and `gems_uncharged`.

```php
$this->gemsCharged   = $this->bga->counterFactory->createPlayerCounter('gems_charged');
$this->gemsUncharged = $this->bga->counterFactory->createPlayerCounter('gems_uncharged');

// Init in setupNewGame
$this->gemsCharged->initDb(array_keys($players),   initialValue: 1);
$this->gemsUncharged->initDb(array_keys($players), initialValue: 2);
```

### TableCounter — round and turn counters

```php
$this->roundCounter = $this->bga->counterFactory->createTableCounter('round_number');
$this->turnCounter  = $this->bga->counterFactory->createTableCounter('turn_number');
```

---

## Client-side (JS)

### BgaCards — card display and animation

Used for player grids and shared deck displays.

```js
const BgaAnimations = await importEsmLib("bga-animations", "1.x");
const BgaCards      = await importEsmLib("bga-cards",      "1.x");
// BgaAnimations must be loaded first (dependency)
```

One `CardManager` instance shared across all stocks:
```js
this.cardManager = new CardManager(this.bga, {
    cardWidth: 120,   // TODO: confirm with illustrator assets
    cardHeight: 180,
    getId: (card) => `bc-card-${card.id}`,
    setupDiv: (card, div) => { /* apply CSS classes */ },
    isCardVisible: (card) => !!card.type,
});
```

One `CardStock` per player grid, one per shared deck.

### BgaAnimations — card transitions

Used for: card reveal flip, card movement during upgrade/mulligan, combat resolve animation.

Loaded before BgaCards (it's a dependency).

### ebg.counter — score display

Used in player panels for score display (updated via `scoreUpdated` notification).

```js
const counter = new ebg.counter();
counter.create(`bc-score-${player.id}`, { value: player.score });
```

### ebg.counter — gems display

Used in player panels for charged/uncharged gem counts.

---

## Component load order in Game.js constructor

```js
constructor(bga) {
    this.bga = bga;

    // 1. Register state classes
    // 2. In setup(): load BgaAnimations then BgaCards (async)
}
```

BgaCards and BgaAnimations are loaded with `importEsmLib()` inside `async setup()`.
