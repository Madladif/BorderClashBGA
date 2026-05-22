# BGA Studio Cookbook

> Source : https://en.doc.boardgamearena.com/BGA_Studio_Cookbook  
> Page communautaire — les recettes peuvent être ajoutées par n'importe quel développeur.  
> Pour les recettes d'outillage et d'environnement, voir : [Tools and tips of BGA Studio](https://en.doc.boardgamearena.com/Tools_and_tips_of_BGA_Studio)

---

## Sommaire

1. [Effets visuels, layout et animation](#1-effets-visuels-layout-et-animation)
   - [DOM manipulations](#11-dom-manipulations)
   - [Animation](#12-animation)
   - [Logs](#13-logs)
   - [Images et icônes](#14-images-et-icônes)
   - [Scale to fit pour les grands plateaux](#15-scale-to-fit-pour-les-grands-plateaux)
   - [Tooltips dynamiques](#16-tooltips-dynamiques)
   - [Ombres CSS réalistes](#17-ombres-css-réalistes)
   - [Classes CSS de la state machine](#18-classes-css-de-la-state-machine)
2. [Modèle de jeu et conception de base de données](#2-modèle-de-jeu-et-conception-de-base-de-données)
3. [Éléments de jeu](#3-éléments-de-jeu)
4. [Organisation du code](#4-organisation-du-code)
5. [Backend](#5-backend)
6. [Assorted Stuff](#6-assorted-stuff)
   - [Actions hors-tour : Un-pass](#61-actions-hors-tour--un-pass)
   - [Interactions multi-étapes — Sélection](#62-interactions-multi-étapes--sélection)
   - [Interactions multi-étapes — Client States](#63-interactions-multi-étapes--client-states)
   - [Action Stack — Client States](#64-action-stack--client-states)
   - [Action Stack — Server States](#65-action-stack--server-states)
   - [Gestion custom des erreurs JS](#66-gestion-custom-des-erreurs-js)
   - [Forcer le refresh après un déploiement](#67-forcer-le-refresh-après-un-déploiement)
   - [Bloquer la création de tables pour un déploiement](#68-bloquer-la-création-de-tables-pour-un-déploiement)
   - [Local Storage](#69-local-storage)
7. [Algorithmes](#7-algorithmes)

---

## 1. Effets visuels, layout et animation

### 1.1 DOM manipulations

#### Créer des pièces dynamiquement (concaténation de chaînes)

**Fichiers :** `Game.js`

```js
div = `<div class='meeple_${color}'></div>`;
```

---

#### Créer toutes les pièces statiquement

**Fichiers :** `ggg_ggg.tpl`, `ggg.css`, `ggg.view.php` (optionnel)

Bonnes pratiques :
- Créer TOUTES les pièces dans le template `.tpl`
- Chaque pièce doit avoir un `id` unique et lisible (ex: `meeple_red_1`)
- Pas de style inline
- Les IDs des pièces spécifiques à un joueur doivent utiliser la couleur (nom anglais, hex 6 chars, ou numéro 1/2/3...)
- Classes séparées pour la couleur, le type, etc. → permet de styler en groupes

```html
<!-- ggg.tpl -->
<div id="home_red" class="home_red home">
   <div id="meeple_red_1" class="meeple red n1"></div>
   <div id="meeple_red_2" class="meeple red n2"></div>
</div>
```

```css
/* ggg.css */
.meeple {
    width: 32px;
    height: 39px;
    background-image: url(img/78_64_stand_meeples.png);
    background-size: 352px;
}
.meeple.red {
    background-position: 30% 0%;
}
.home .meeple {
    display: inline-block;
}
```

> ⚠️ Ce modèle est incompatible avec les composants JS préfabriqués comme `Stock` et `Zone`.  
> Pour les objets temporaires visuellement identiques, utiliser `dojo.clone` (changer l'id en temp id).

---

#### Utiliser la couleur du joueur dans un template

> ⚠️ `view.php` est déprécié. Préférer générer le HTML depuis `.js`.

```php
// .view.php (legacy)
function build_page($viewArgs) {
    $players = $this->game->loadPlayersBasicInfos();
    $cplayer = $this->getCurrentPlayerId();
    if (array_key_exists($cplayer, $players)) {
        $player_color = $players[$cplayer]['player_color'];
    } else {
        $player_color = 'ffffff'; // spectateur
    }
    $this->tpl['PCOLOR'] = $player_color;
}
```

---

### 1.2 Animation

#### Attacher à un nouveau parent sans détruire l'objet

La fonction native `attachToNewParent` détruit l'objet original (et tous ses connecteurs `onClick`). Alternative :

```js
// Game.js
attachToNewParentNoDestroy: function(mobile_in, new_parent_in, relation, place_position) {
    const mobile = $(mobile_in);
    const new_parent = $(new_parent_in);

    var src = dojo.position(mobile);
    if (place_position) mobile.style.position = place_position;
    dojo.place(mobile, new_parent, relation);
    mobile.offsetTop; // force re-flow
    var tgt = dojo.position(mobile);
    var box = dojo.marginBox(mobile);
    var cbox = dojo.contentBox(mobile);
    var left = box.l + src.x - tgt.x;
    var top = box.t + src.y - tgt.y;

    mobile.style.position = "absolute";
    mobile.style.left = left + "px";
    mobile.style.top = top + "px";
    box.l += box.w - cbox.w;
    box.t += box.h - cbox.h;
    mobile.offsetTop; // force re-flow
    return box;
},
```

---

#### Animation sur oversurface

Pour les éléments en position non-absolue (layouts, zoom, rotation) les fonctions BGA standard ne fonctionnent pas. Technique "animation on oversurface" :

1. Créer une couche au-dessus de tout — l'oversurface
2. Créer une copie de l'objet sur l'oversurface
3. Déplacer l'objet réel en position finale (invisible)
4. Animer la copie vers la position finale (avec zoom/rotation via CSS), puis la détruire
5. Rendre l'objet original visible

Code complet : [https://codepen.io/VictoriaLa/pen/gORvdJo](https://codepen.io/VictoriaLa/pen/gORvdJo)  
Jeux utilisant cette technique : Century, Ultimate Railroads

---

#### Scroll element into view

Fait défiler un nœud dans la vue, en respectant le mode replay et archive :

```js
scrollIntoViewAfter: function(node, delay) {
    if (this.instantaneousMode || this.inSetup) return;
    if (typeof g_replayFrom != "undefined") {
        $(node).scrollIntoView();
        return;
    }
    if (!delay) delay = 0;
    setTimeout(() => {
        $(node).scrollIntoView({ behavior: "smooth", block: "center" });
    }, delay);
},
```

---

### 1.3 Logs

#### Injecter des images et du HTML stylé dans le log

> ⚠️ **Ne jamais envoyer du HTML depuis PHP dans les notifications.** C'est une mauvaise architecture (UI couplée au serveur), casse le replay des anciennes parties, gonfle les données et pose des problèmes de traduction.

**La bonne approche : injection côté client.** Modifier les `args` côté JS, pas la chaîne de log elle-même.

Trois méthodes disponibles :

---

##### Méthode 1 — `bgaFormatText()`

**Fichiers :** `Game.js`, `Game.php`

Déclarer cette fonction pour intercepter les args des notifications avant insertion dans le log :

```js
// Game.js
bgaFormatText: function(log, args) {
    try {
        if (log && args && !args.processed) {
            args.processed = true;
            const keys = ['place_name', 'token_name'];
            for (let i in keys) {
                const key = keys[i];
                if (args[key]) args[key] = this.getTokenDiv(key, args);
            }
        }
    } catch(e) {
        console.error(log, args, "Exception thrown", e.stack);
    }
    return { log, args };
},

getTokenDiv: function(key, args) {
    var token_id = args[key];
    var item_type = getPart(token_id, 0);
    var logid = "log" + (this.globalid++) + "_" + token_id;
    switch (item_type) {
        case 'wcube':
            return this.format_block('jstpl_resource_log', {
                "id": logid, "type": "wcube", "color": getPart(token_id, 1)
            });
        case 'meeple':
            if ($(token_id)) {
                var clone = dojo.clone($(token_id));
                dojo.attr(clone, "id", logid);
                this.stripPosition(clone);
                dojo.addClass(clone, "logitem");
                return clone.outerHTML;
            }
            break;
    }
    return "'" + this.clienttranslate_string(this.getTokenName(token_id)) + "'";
},
```

```php
// Game.php
$this->bga->notify->all('playerLog', clienttranslate('Game moves ${token_name}'), ['token_name' => $token_id]);
```

> ⚠️ Pour conserver des args au rechargement (F5), utiliser `'preserve' => ['zone_played']` dans les args de la notification. Sans ça, seuls les args référencés dans le message sont conservés dans les logs historiques.

---

##### Méthode 2 — `:formatFunction` via `dojo.string.substitute`

**Fichiers :** `Game.js`, `Game.php`, `.tpl`, `.css`

Utile si vous utilisez des clés avec point (`${card.name}`). Permet de spécifier la fonction de formatage directement dans la clé de substitution.

```js
// Game.js — définir la fonction de formatage
getTokenDiv: function(value, key) {
    switch (key) {
        case 'html_injected_argument1':
            return this.format_block('jstpl_HTMLLogElement1', {value: value});
        case 'html_injected_argument2':
            return this.format_block('jstpl_HTMLLogElement2', {value: value});
    }
}
```

```js
// Game.js — constructeur (importer dojo/aspect en 3e position dans define[])
let gameObject = this;
aspect.before(dojo.string, "substitute", function(template, map, transform) {
    return [template, map, transform, gameObject];
});
```

```php
// Game.php — syntaxe ${clé:nomFonction}
$this->bga->notify->all("notifName",
    clienttranslate("Log ${arg1} et ${html_injected_argument1:getTokenDiv}"),
    [
        "arg1" => "texte",
        "html_injected_argument1" => "valeur pour getTokenDiv",
    ]
);
```

> ⚠️ Adopter cette méthode sur un projet avancé oblige à revoir toutes les notifications.

---

##### Méthode 3 — argument `transform` de `dojo.string.substitute`

**Fichiers :** `Game.js`, `Game.php`, `.tpl`, `.css`

Applique une fonction de transformation à **tous** les args de toutes les chaînes passant par `dojo.string.substitute`.

```js
// Game.js — fonction de transformation (le default: return value est obligatoire)
getTokenDiv: function(value, key) {
    switch (key) {
        case 'html_injected_argument1':
            return this.format_block('jstpl_HTMLLogElement1', {value: value});
        default:
            return value; // OBLIGATOIRE — sinon les chaînes normales disparaissent
    }
}

// Dans le constructeur
let transformFunction = dojo.hitch(this, "getTokenDiv");
aspect.before(dojo.string, "substitute", function(template, map, transform) {
    if (undefined === transform) {
        return [template, map, transformFunction];
    }
});
```

> ⚠️ Cette méthode s'applique à TOUTES les chaînes. Préfixer les clés à injecter avec le trigramme du jeu pour éviter les conflits avec les clés framework (ex: `${id}`).

---

#### Traitement des logs au rechargement

Les logs se chargent de façon asynchrone. Pour exécuter du code quand ils sont complètement chargés :

> ⚠️ **Hack** — étend une fonction non documentée, peut casser si le framework est mis à jour.

```js
// Game.js
setLoader: function(image_progress, logs_progress) {
    this.inherited(arguments); // super() — ne pas supprimer
    if (!this.isLoadingLogsComplete && logs_progress >= 100) {
        this.isLoadingLogsComplete = true;
        this.onLoadingLogsComplete();
    }
},

onLoadingLogsComplete: function() {
    console.log('Loading logs complete');
    // Faire quelque chose ici
},
```

---

#### Injecter du HTML dans les logs avec tooltips (format_string_recursive)

Surcharger `format_string_recursive` pour intercepter le texte et remplacer des patterns codés par du HTML avec tooltips :

```js
// Remplacer le return de format_string_recursive par :
return this.logInject(text);

// Fonction d'injection
logInject: function(log_entry) {
    const card_regex = /\[\w+-*\w* *\w*\(\d+\)\]/g; // [card_name(card_type_arg)]
    const cards_to_replace = log_entry.matchAll(card_regex);
    for (let card of cards_to_replace) {
        const match = card[0];
        const left_paren = match.indexOf('(');
        const card_type_arg = match.slice(left_paren + 1, match.length - 2);
        log_entry = log_entry.replace(match, this.getHTMLForLog(card_type_arg, 'card'));
    }
    return log_entry;
},

getHTMLForLog: function(item, type) {
    switch(type) {
        case 'card':
            this.log_span_num++;
            const card_name = this.gamedatas['cards'][item]['description'];
            return `<span id="${this.log_span_num}_item_${item}" class="card_tt item_tooltip">${card_name}</span>`;
    }
},

addTooltipsToLog: function() {
    const items = dojo.query('.item_tooltip:not(.tt_processed)');
    Array.from(items).forEach(ele => {
        const ele_id = ele.id;
        ele.classList.add('tt_processed');
        if (ele.classList.contains('card_tt')) {
            const card_type_arg = ele_id.slice(-3).replace(/^\D+/g, '');
            this.cardTooltip(ele_id, card_type_arg);
        }
    });
},

cardTooltip: function(ele, card_type_arg) {
    const card = this.gamedatas.cards[card_type_arg];
    const bg_pos = card['x_y'];
    const html = `<div><strong>${card['description']}</strong></div>
                  <div class="asset asset_tt" style="background-position: -${bg_pos[0]}% -${bg_pos[1]}%;"></div>`;
    this.addTooltipHTML(ele, html, 1000);
},
```

Connecter `addTooltipsToLog` :

```js
// Avec promise-based notifications
this.bga.notifications.setupPromiseNotifications({ onEnd: this.addTooltipsToLog.bind(this) });

// Ou avec dojo (déclenché à chaque mise à jour du log)
dojo.connect(this.notifqueue, 'addToLog', () => { this.addTooltipsToLog(); });
```

---

### 1.4 Images et icônes

#### Accéder aux images depuis JS

```js
const my_img = `<img src="${this.bga.images.getImgUrl('cards.jpg')}"/>`;
```

---

#### Graphismes haute définition (Retina / HiDPI)

Préparer un fichier `pieces@2x.png` à exactement 2× la taille normale. Gérer le préchargement conditionnel :

```css
/* ggg.css */
.piece {
    background-image: url('img/pieces.png');
    background-size: 240px 320px;
}
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .piece {
        background-image: url('img/pieces@2x.png');
    }
}
```

```js
// Game.js — setup() : ne précharger que la version appropriée
var isRetina = "(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)";
if (window.matchMedia(isRetina).matches) {
    this.bga.images.dontPreloadImage('pieces.png');
    this.bga.images.dontPreloadImage('board.jpg');
} else {
    this.bga.images.dontPreloadImage('pieces@2x.png');
    this.bga.images.dontPreloadImage('board@2x.jpg');
}
```

---

#### Coloriser une pièce blanche via CSS

Pour créer différentes couleurs à partir d'une seule pièce blanche :

```css
background-color: #${color};
background-blend-mode: multiply;
background-image: url('img/mypiece.png');
mask: url('img/mypiece.png');
-webkit-mask: url('img/mypiece.png');
```

> La pièce doit être blanche (niveaux de gris). Fonctionne aussi avec des sprites — ajouter `background-position` et `mask-size` correspondant à `background-size`.

---

#### Boutons image dans la barre d'action

```js
// Game.js
addImageActionButton: function(id, div_html, handler) {
    this.bga.statusBar.addActionButton(div_html, handler, { id });
    dojo.addClass(id, "bgaimagebutton");
    return $(id);
},

// Utilisation
this.addImageActionButton('button_coin', "<div class='coin'></div>", () => { alert('Ha!'); });
```

---

### 1.5 Scale to fit pour les grands plateaux

Pour un plateau très large (ex: 1400px), trois options : viewport scaling, scroll horizontal, ou zoom utilisateur.

```html
<!-- ggg_ggg.tpl -->
<div id="thething" class="thething">
    <!-- contenu du jeu -->
</div>
```

```js
// Game.js — zoom utilisateur avec +/- buttons
onZoomPlus: function() { this.setZoom(this.zoom + 0.1); },
onZoomMinus: function() { this.setZoom(this.zoom - 0.1); },

setZoom: function(zoom) {
    zoom = parseInt(zoom) || 0;
    if (zoom === 0 || zoom < 0.1 || zoom > 10) zoom = 1;
    this.zoom = zoom;
    var inner = document.getElementById("thething");
    if (zoom == 1) {
        inner.style.removeProperty("transform");
        inner.style.removeProperty("width");
    } else {
        inner.style.transform = "scale(" + zoom + ")";
        inner.style.transformOrigin = "0 0";
        inner.style.width = 100 / zoom + "%";
    }
    localStorage.setItem(`${this.game_name}_zoom`, "" + this.zoom);
    this.onScreenWidthChange();
},
```

---

### 1.6 Tooltips dynamiques

Pour les cas où les tooltips statiques BGA sont insuffisants (utiliser `dijit.Tooltip`, hors API BGA — à utiliser à ses risques) :

```js
new dijit.Tooltip({
    connectId: ["divItemId"],
    getContent: function(matchedNode) {
        return "... contenu calculé dynamiquement ...";
    }
});
```

Le retour de `getContent()` devient le `innerHTML` du tooltip. Voir [dijit.Tooltip docs](https://dojotoolkit.org/reference-guide/1.10/dijit/Tooltip.html).

---

### 1.7 Ombres CSS réalistes

#### Rectangles et cercles

```css
.xxx-tile {
    box-shadow: 3px 3px 3px #000000a0;
}
```

`box-shadow` respecte le `border-radius`. Pour animer une ombre sans pénalité de redraw, attacher l'ombre à un `::after` et modifier uniquement son `opacity`.

---

#### Formes irrégulières

```css
.xxx-token {
    filter: drop-shadow(0px 0px 1px #000000);
}
```

> ⚠️ Performance : `drop-shadow` est très gourmand en GPU. Visible à partir de ~40 composants sur Safari. Proposer une option utilisateur pour désactiver :

```php
// gameoptions.inc.php
100 => array(
    'name' => totranslate('Shadows'),
    'needReload' => true,
    'values' => array(
        1 => array('name' => totranslate('Enabled'), 'cssPref' => ''),
        2 => array('name' => totranslate('Disabled'), 'cssPref' => 'no-shadow')
    )
),
```

```css
/* game.css */
.no-shadow * {
    filter: none !important;
}
```

> Sur Safari, il vaut mieux désactiver `drop-shadow` complètement par défaut.

---

#### Ombres avec clip-path

`drop-shadow` et `clip-path` ne fonctionnent pas sur le même élément. Solution : wrapper :

```html
<div class='my-token-wrap'>
    <div class='my-token'></div>
</div>
```

```css
.my-token-wrap {
    filter: drop-shadow(0px 0px 1px #000000);
}
.my-token-wrap .my-token {
    clip-path: url(#my-token-path);
}
```

---

### 1.8 Classes CSS de la state machine

L'élément `#overall-content` reçoit automatiquement une classe CSS selon l'état de jeu actif (`gamestate_nomDeLEtat`). Cela permet de conditionner l'affichage purement en CSS :

```css
/* Cacher la défausse par défaut, l'afficher seulement pendant playerTurn */
#discard_pile { display: none; }
.gamestate_playerTurn #discard_pile { display: block; }
```

Utile pour le sizing, la position, le layout et l'apparence visuelle selon l'état.

---

## 2. Modèle de jeu et conception de base de données

### 2.1 Base de données pour un jeu euro

Pour un jeu avec workers, dés, tokens, plateau, ressources, argent et PV :

**Mapping conceptuel :**
- `(meeple, zone)`
- `(dé, zone, face_visible)`
- `(type_ressource/argent, zone_home_joueur, quantité)` — les ressources sont dénombrables mais pas individuelles
- `(token, zone_home_joueur, flip_state)`

**Table `token` recommandée :**

```sql
CREATE TABLE IF NOT EXISTS `token` (
    `token_id`       varchar(32)  NOT NULL,
    `token_type`     varchar(16)  NOT NULL,
    `token_type_arg` int(11)      NOT NULL,
    `token_location` varchar(32)  NOT NULL,
    `token_state`    int(11)      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

- `token_id` : identifiant unique (ex: `meeple_red_1`, `resource_wood_3`)
- `token_type` : type générique (`meeple`, `resource`, `die`...)
- `token_type_arg` : sous-type ou valeur (ex: face du dé, type de ressource)
- `token_location` : où se trouve l'élément (ex: `zone_1`, `player_home_1234`)
- `token_state` : état (ex: 0/1 pour flip, valeur du dé)

---

### 2.2 Base de données pour un jeu de cartes

Pour les jeux de cartes, utiliser le **composant Deck BGA** plutôt qu'une table custom. Il gère automatiquement les decks, mains, pioches, mélanges, etc.

```sql
-- Géré automatiquement par le composant Deck
-- Colonnes gérées : card_id, card_type, card_type_arg, card_location, card_location_arg, card_order
```

Voir : [Deck component](https://en.doc.boardgamearena.com/Deck)

---

## 3. Éléments de jeu

Chaque type d'élément de jeu suit le même pattern de conception :

| Couche | Fichier | Rôle |
|---|---|---|
| Base de données | `dbmodel.sql` | Persistance de l'état |
| Matériel statique | `material.inc.php` | Définition des types/propriétés |
| HTML | `.tpl` ou `Game.js` | Structure DOM |
| JavaScript | `Game.js` | Création, animation, events |
| CSS | `game.css` | Apparence visuelle |
| Actions | `Game.js` + `Game.php` | Sélection et envoi au serveur |

### 3.1 Ressource (cube, jeton)

**DB :** table `token` avec `token_type='resource'`, `token_location=player_home`, `token_state=count`

**material.inc.php :**
```php
$this->resource_types = [
    1 => ['name' => clienttranslate('Wood'), 'color' => 'brown'],
    2 => ['name' => clienttranslate('Stone'), 'color' => 'gray'],
];
```

**HTML (template) :**
```html
<div id="resource_${type}_${player_id}" class="resource resource_${type}"></div>
```

**CSS :**
```css
.resource {
    width: 20px; height: 20px;
    background-image: url(img/resources.png);
}
.resource_1 { background-position: 0 0; }
.resource_2 { background-position: -20px 0; }
```

**JS — création :**
```js
// setup()
for (const player_id in gamedatas.players) {
    for (const type in gamedatas.resources[player_id]) {
        const count = gamedatas.resources[player_id][type];
        // mettre à jour un Counter ou créer les divs
    }
}
```

---

### 3.2 Meeple / Worker

**DB :** `token_type='meeple'`, `token_location=zone_id`, `token_state=0`

**CSS :**
```css
.meeple {
    width: 32px; height: 39px;
    background-image: url(img/meeples.png);
    background-size: 352px;
}
.meeple.red   { background-position: 30% 0%; }
.meeple.blue  { background-position: 60% 0%; }
```

**JS — sélection :**
```js
// setup() — connecter les clics sur les meeples
this.bga.gameui.connectClass('meeple', 'onclick', 'onMeepleClick');

onMeepleClick: function(evt) {
    dojo.stopEvent(evt);
    if (!this.bga.actions.checkAction('actSelectMeeple')) return;
    const meepleId = evt.currentTarget.id;
    this.bga.actions.performAction('actSelectMeeple', { id: meepleId });
},
```

---

### 3.3 Dés

**DB :** `token_type='die'`, `token_location=zone_id`, `token_state=face_value (1-6)`

**material.inc.php :**
```php
$this->die_faces = [1=>1, 2=>2, 3=>3, 4=>4, 5=>5, 6=>6];
```

**CSS (sprite de 6 faces) :**
```css
.die {
    width: 50px; height: 50px;
    background-image: url(img/dice.png);
    background-size: 300px 50px;
}
.die[data-face="1"] { background-position: 0 0; }
.die[data-face="2"] { background-position: -50px 0; }
/* etc. */
```

**JS — mise à jour après lancer :**
```js
notif_dieRolled: function(notif) {
    const die = document.getElementById(`die_${notif.args.die_id}`);
    die.dataset.face = notif.args.face;
},
```

---

### 3.4 Carte

**DB :** utiliser le composant `Deck` BGA.

**material.inc.php :**
```php
$this->card_types = [
    1 => ['name' => clienttranslate('Fireball'), 'value' => 5, 'color' => 'red'],
    2 => ['name' => clienttranslate('Shield'), 'value' => 3, 'color' => 'blue'],
];
```

**HTML (template pour une carte) :**
```html
<!-- jstpl_card dans .tpl -->
let jstpl_card = '<div id="card_${id}" class="card card_${type}" data-id="${id}"></div>';
```

**CSS (sprite sheet) :**
```css
.card {
    width: 100px; height: 140px;
    background-image: url(img/cards.png);
    background-size: 1000px 140px;
}
.card_1 { background-position: 0 0; }
.card_2 { background-position: -100px 0; }
```

**JS — créer et placer une carte :**
```js
addCardToHand: function(card) {
    const div = this.format_block('jstpl_card', { id: card.id, type: card.type });
    dojo.place(div, 'myhand');
    this.bga.gameui.connect($(`card_${card.id}`), 'onclick', 'onCardClick');
},
```

**Layouts de cartes :** Pour les mains de cartes avec fan/overlap, voir le composant [bga-cards](https://en.doc.boardgamearena.com/BgaCards).

---

### 3.5 Tuiles hexagonales

Pour les plateaux hexagonaux, utiliser une grille de positionnement CSS. Deux orientations possibles : pointe en haut (pointy-top) ou à plat (flat-top).

```css
/* Grille hexa flat-top */
.hex-grid {
    display: flex;
    flex-wrap: wrap;
}
.hex {
    width: 86px; height: 100px;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    margin: -12px 2px;
}
.hex-row:nth-child(even) {
    margin-left: 44px; /* décalage d'une demi-tuile */
}
```

---

### 3.6 Tuiles Tetris

Pour les pièces polyomino, modéliser chaque pièce comme un tableau 2D de cases :

```php
// material.inc.php
$this->pieces = [
    'L' => [[1,0],[1,0],[1,1]],
    'T' => [[0,1,0],[1,1,1]],
];
```

Générer le HTML à partir des coordonnées et positionner sur une grille CSS.

---

### 3.7 Track / Piste de score

Pour les pistes linéaires (score, progression) :

```html
<div id="score_track">
    <!-- Cases numérotées -->
    <div id="track_space_0" class="track_space" data-value="0"></div>
    <div id="track_space_1" class="track_space" data-value="1"></div>
    <!-- ... -->
</div>
<div id="marker_${player_id}" class="player_marker"></div>
```

```js
// Déplacer le marqueur
moveMarker: function(player_id, new_value) {
    this.bga.gameui.slideToObject(
        `marker_${player_id}`,
        `track_space_${new_value}`
    ).play();
},
```

---

## 4. Organisation du code

### 4.1 Créer une classe de test pour exécuter PHP en local

Créer un fichier de test qui étend votre classe Game et remplace les méthodes BGA par des stubs locaux. Utile pour tester la logique pure sans déployer sur le studio.

```php
// test/GameTest.php
class GameTest extends Game {
    protected function getCollectionFromDb($sql) {
        // retourner des données de test
        return [];
    }
    protected function DbQuery($sql) { /* no-op */ }
    // etc.
}
```

---

### 4.2 Éviter le style `dojo declare`

Le nouveau style (ES Modules, class Game) est préféré. Dans l'ancien style `define` + `declare`, le scope de `this` dans les callbacks est problématique. Migrer vers les ES classes résout ce problème nativement.

---

### 4.3 Frameworks et préprocesseurs

BGA Studio supporte :
- **TypeScript** : transpiler localement, uploader le JS généré
- **SASS/LESS** : préprocesser localement, uploader le CSS généré
- **Frameworks JS** : possible mais attention au bundle size et aux conflits Dojo

---

### 4.4 Migration PHP

Pour migrer depuis l'ancien style (`yourgamename.game.php` legacy) vers le nouveau (`modules/php/Game.php`) :
- Déplacer la logique vers `modules/php/`
- Ajouter les namespaces appropriés
- Remplacer les méthodes dépréciées par leurs équivalents modernes (ex: `notifyAllPlayers` → `bga->notify->all`)
- Déplacer les actions vers des State classes dans `modules/php/States/`

---

## 5. Backend

### 5.1 Assigner l'ordre des joueurs

L'ordre naturel est assigné aléatoirement à la création de table. Pour un ordre custom (ex: joueur avec le moins de points commence) :

```php
// setupNewGame() ou début de manche
$player_ids = array_keys($this->loadPlayersBasicInfos());

// Trier selon votre critère
usort($player_ids, function($a, $b) use ($scores) {
    return $scores[$a] - $scores[$b];
});

// Stocker l'ordre custom dans vos données
$this->bga->globals->set('PLAYER_ORDER', $player_ids);

// Créer le tableau next-player pour cet ordre
$next_player_table = $this->createNextPlayerTable($player_ids, true);
```

---

## 6. Assorted Stuff

### 6.1 Actions hors-tour : Un-pass

Permettre à un joueur de "dépasser" sa passe en état multiactif :

**Game.php :**
```php
#[CheckAction(false)]
public function actUnpass(int $currentPlayerId) {
    $this->gamestate->checkPossibleAction('actUnpass');
    // Réactiver le joueur
    $this->gamestate->setPlayersMultiactive([$currentPlayerId], 'error', false);
    // Réinitialiser son état privé si nécessaire
    $this->gamestate->initializePrivateState($currentPlayerId);
}
```

**Game.js :**
```js
// Ne pas appeler checkAction côté JS pour cette action
onClickUnpass: function() {
    this.bga.actions.performAction('actUnpass', {}, { checkAction: false, checkPossibleActions: true });
},
```

---

### 6.2 Interactions multi-étapes — Sélection

Pattern : sélectionner un worker puis placer le worker. Gestion via une variable de sélection côté client :

```js
// Game.js
setup: function(gamedatas) {
    this.selectedWorker = null;
    this.bga.gameui.connectClass('worker', 'onclick', 'onWorkerClick');
    this.bga.gameui.connectClass('zone', 'onclick', 'onZoneClick');
},

onWorkerClick: function(evt) {
    dojo.stopEvent(evt);
    // Désélectionner l'ancien
    if (this.selectedWorker) dojo.removeClass(this.selectedWorker, 'selected');
    this.selectedWorker = evt.currentTarget.id;
    dojo.addClass(this.selectedWorker, 'selected');
    // Mettre en évidence les zones valides
    this.highlightValidZones();
},

onZoneClick: function(evt) {
    dojo.stopEvent(evt);
    if (!this.selectedWorker) return;
    if (!this.bga.actions.checkAction('actPlaceWorker')) return;
    this.bga.actions.performAction('actPlaceWorker', {
        workerId: this.selectedWorker,
        zoneId: evt.currentTarget.id
    });
    this.selectedWorker = null;
},
```

---

### 6.3 Interactions multi-étapes — Client States

Pattern recommandé pour les interactions complexes : utiliser les client states pour simuler des étapes intermédiaires sans aller au serveur.

```js
// Étape 1 : clic sur worker → entrer dans un client state
onWorkerClick: function(evt) {
    dojo.stopEvent(evt);
    if (!this.bga.actions.checkAction('actPlaceWorker')) return;
    this.selectedWorker = evt.currentTarget.id;

    // Entrer dans le client state
    this.bga.states.setClientState("client_placeWorker", {
        descriptionmyturn: _("${you} must select a zone"),
    });
},

// Étape 2 : le client state gère le clic sur une zone
// Dans la JS State class "client_placeWorker" :
class ClientPlaceWorker {
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.gameui.connectClass('zone', 'onclick', 'onZoneClick');
    }
    onLeavingState() {
        this.bga.gameui.disconnectAll();
    }
}

onZoneClick: function(evt) {
    dojo.stopEvent(evt);
    this.bga.actions.performAction('actPlaceWorker', {
        workerId: this.selectedWorker,
        zoneId: evt.currentTarget.id
    });
},

// Annuler → revenir à l'état serveur
onCancel: function() {
    this.bga.states.restoreServerGameState();
},
```

---

### 6.4 Action Stack — Client States

Pour des séquences d'actions qui peuvent être annulées étape par étape côté client (sans aller au serveur) :

```js
// Maintenir une pile d'états client
this.clientStateStack = [];

pushClientState: function(stateName, args) {
    this.clientStateStack.push(stateName);
    this.bga.states.setClientState(stateName, args);
},

popClientState: function() {
    this.clientStateStack.pop();
    if (this.clientStateStack.length > 0) {
        const prevState = this.clientStateStack[this.clientStateStack.length - 1];
        this.bga.states.setClientState(prevState, { descriptionmyturn: _("...") });
    } else {
        this.bga.states.restoreServerGameState();
    }
},
```

---

### 6.5 Action Stack — Server States

Pour des séquences d'actions côté serveur avec des états intermédiaires persistés (utile pour les actions complexes qui doivent résister aux déconnexions) :

```php
// States/ChooseAction.php
public function actChooseFirst(int $choice, int $currentPlayerId) {
    // Sauvegarder le choix
    $this->bga->globals->set('PARTIAL_ACTION', ['step' => 1, 'choice' => $choice]);
    return ChooseSecond::class; // aller dans l'état suivant
}

// States/ChooseSecond.php
public function actChooseSecond(int $choice2, int $currentPlayerId) {
    $partial = $this->bga->globals->get('PARTIAL_ACTION');
    // Exécuter l'action complète avec $partial['choice'] et $choice2
    $this->bga->globals->delete('PARTIAL_ACTION');
    return NextPlayer::class;
}
```

---

### 6.6 Gestion custom des erreurs JS

Pour capturer et traiter les exceptions JavaScript de façon personnalisée :

```js
// Surcharger la gestion d'erreur BGA
showMessage: function(msg, type) {
    if (type === 'error') {
        // Logger l'erreur ou afficher un UI custom
        console.error('Game error:', msg);
    }
    this.inherited(arguments); // appel parent
},
```

Pour intercepter les erreurs des appels `performAction` :

```js
this.bga.actions.performAction('actPlayCard', { id: cardId })
    .catch((error) => {
        console.error('Action failed:', error.message, error.args);
        // Restaurer l'état UI si nécessaire
        this.unselectAll();
    });
```

---

### 6.7 Forcer le refresh après un déploiement

Stocker la version du déploiement dans un global et forcer le rechargement si la version côté client est obsolète :

```php
// Game.php __construct
const DEPLOY_VERSION = "deploy_version";

// setupNewGame
$this->bga->globals->set(DEPLOY_VERSION, 42); // incrémenter à chaque déploiement

// getAllDatas
$result['deploy_version'] = $this->bga->globals->get(DEPLOY_VERSION);
```

```js
// Game.js setup()
if (gamedatas.deploy_version !== 42) { // même numéro
    window.location.reload();
}
```

---

### 6.8 Bloquer la création de tables pour un déploiement

Utiliser `upgradeTableDb` pour les migrations de DB. Pour bloquer temporairement les nouvelles parties pendant un déploiement délicat, contacter le support BGA Studio.

---

### 6.9 Local Storage

Pour persister des préférences UI côté client (ex: zoom, mode d'affichage) entre sessions :

```js
// Sauvegarder
localStorage.setItem(`${this.game_name}_zoom`, JSON.stringify(this.zoom));

// Lire au chargement (dans setup())
const savedZoom = localStorage.getItem(`${this.game_name}_zoom`);
if (savedZoom) {
    this.setZoom(JSON.parse(savedZoom));
}
```

> ⚠️ Ne jamais stocker de données liées à la logique de jeu dans le Local Storage — uniquement des préférences UI.

---

## 7. Algorithmes

### 7.1 Générer des permutations en ordre lexicographique

```php
// PHP — générer toutes les permutations de [1..n]
function getPermutations(array $items): array {
    if (count($items) <= 1) return [$items];
    $result = [];
    foreach ($items as $key => $item) {
        $rest = array_values(array_filter($items, fn($i) => $i !== $item));
        foreach (getPermutations($rest) as $perm) {
            $result[] = array_merge([$item], $perm);
        }
    }
    return $result;
}

// Exemple
$perms = getPermutations([1, 2, 3]);
// [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
```

Pour des sets plus grands, préférer l'algorithme de Heap (plus efficace en mémoire) ou générer les permutations une par une en ordre lexicographique via l'algorithme de Narayana.

---

*Source : [en.doc.boardgamearena.com/BGA_Studio_Cookbook](https://en.doc.boardgamearena.com/BGA_Studio_Cookbook)*  
*Page wiki communautaire — contributions bienvenues.*
