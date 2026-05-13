/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * borderclash implementation : © Merle Editions
 */

// ---------------------------------------------------------------------------
// SilverDraft state — MULTIPLE_ACTIVE_PLAYER (state 5)
// Players pick 1 Silver card to keep; the rest pass left. Runs twice (2 passes).
// ---------------------------------------------------------------------------

class SilverDraft {
  constructor(game, bga) {
    this.game      = game;
    this.bga       = bga;
    this._selected = null;
    this._pid      = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is picking a Silver card…"));
      return;
    }
    this._selected = null;
    // Fallback to gamedatas when args doesn't include per-player draft_cards
    const cards = (args.draft_cards && args.draft_cards.length > 0)
      ? args.draft_cards
      : (this.game.gamedatas?.draft_cards || []);
    this._build(cards, args.draft_round || 1);
  }

  onLeavingState() {
    this._teardown();
  }

  _teardown() {
    document.getElementById('bc-draft-ui')?.remove();
    if (this._pid) {
      const handArea = document.getElementById(`bc-hand-area-${this._pid}`);
      if (handArea) handArea.innerHTML = '';
      this._pid = null;
    }
  }

  _build(draftCards, draftRound) {
    this._pid = String(this.bga.player_id);

    // Draft cards go inside the player's own board (always visible, no scrolling needed)
    const handArea = document.getElementById(`bc-hand-area-${this._pid}`);
    if (handArea) {
      handArea.innerHTML = draftCards.map(c => {
        const pos = this.game._spritePos(c.type, c.type_arg, c.family);
        return `<div class="bc-card bc-draft-card bc-card-sprite bc-card-rank-${c.type}"
                     id="bc-dcard-${c.id}" data-card-id="${c.id}"
                     style="background-position:${pos.x}px ${pos.y}px"></div>`;
      }).join('');
      handArea.querySelectorAll('.bc-draft-card').forEach(el =>
        el.addEventListener('click', e => this._onCardClick(e))
      );
    }

    // Minimal hint panel (pass counter)
    this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
      <div id="bc-draft-ui">
        <p id="bc-draft-hint">
          ${_("Pass")} ${draftRound}/2 —
          ${_("Pick 1 Silver card to keep. The rest will be passed left.")}
        </p>
      </div>
    `);

    this.bga.statusBar.setTitle(_("${you} must pick 1 Silver card to keep"));
    // Button is added only when a card is selected (see _onCardClick)
  }

  _onCardClick(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);

    if (this._selected === cardId) {
      // Deselect: remove highlight and button
      e.currentTarget.classList.remove('bc-card-selected');
      this._selected = null;
      document.getElementById('btn-bc-draft')?.remove();
    } else {
      // Select: highlight new card
      document.querySelectorAll('.bc-draft-card').forEach(el =>
        el.classList.remove('bc-card-selected')
      );
      e.currentTarget.classList.add('bc-card-selected');
      this._selected = cardId;
      // Add button only if not already in the bar
      if (!document.getElementById('btn-bc-draft')) {
        this.bga.statusBar.addActionButton(_("Keep this card"), () => this._confirm(),
          { id: 'btn-bc-draft' });
      }
    }
  }

  _confirm() {
    if (this._selected === null) {
      this.bga.statusBar.setTitle(_("Please select a card to keep first"));
      return;
    }
    this.bga.actions.performAction('actPickSilver', { keptCardId: this._selected });
  }
}

// ---------------------------------------------------------------------------
// Deploy state — MULTIPLE_ACTIVE_PLAYER (state 10)
// ---------------------------------------------------------------------------

class Deploy {
  constructor(game, bga) {
    this.game          = game;
    this.bga           = bga;
    this._slots        = { col1: null, col2: null, col3: null };
    this._mulliganMode = false;
    this._myPid        = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is deploying cards…"));
      return;
    }
    this._slots        = { col1: null, col2: null, col3: null };
    this._mulliganMode = false;
    this._build(args.hand || [], args.gems_charged || 0);
  }

  onLeavingState() {
    this._teardown();
  }

  _teardown() {
    document.getElementById('bc-deploy-ui')?.remove();
    if (this._myPid) {
      const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
      if (handArea) handArea.innerHTML = '';
      this._myPid = null;
    }
    this._slots = { col1: null, col2: null, col3: null };
  }

  _build(hand, gemsCharged) {
    this._myPid = String(this.bga.player_id);

    // Populate hand area inside the player board (visible in-place)
    const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (handArea) {
      handArea.innerHTML = hand.map(c => {
        const pos = this.game._spritePos(c.type, c.type_arg, c.family);
        return `<div class="bc-card bc-hand-card bc-card-sprite bc-card-rank-${c.type}"
                     id="bc-hcard-${c.id}" data-card-id="${c.id}"
                     style="background-position:${pos.x}px ${pos.y}px"></div>`;
      }).join('');
      handArea.querySelectorAll('.bc-hand-card').forEach(el =>
        el.addEventListener('click', e => this._onCardClick(e))
      );
    }

    // Slim deploy panel: only slot indicators + gem count
    this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
      <div id="bc-deploy-ui">
        <p id="bc-deploy-hint">${_("Click cards above to assign positions, then confirm.")}</p>
        <div id="bc-deploy-slots">
          <span class="bc-deploy-slot" id="bc-slot-col1">${_("Left")}: —</span>
          <span class="bc-deploy-slot" id="bc-slot-col2">${_("Center")}: —</span>
          <span class="bc-deploy-slot" id="bc-slot-col3">${_("Right")}: —</span>
        </div>
        <div id="bc-gems-info">${_("Gems charged")}: ${gemsCharged}</div>
      </div>
    `);

    this.bga.statusBar.setTitle(_("${you} must deploy 3 cards (left border, center, right border)"));
    this.bga.statusBar.addActionButton(_("Confirm Deployment"), () => this._confirm(),
      { id: 'btn-bc-deploy' });
    if (gemsCharged > 0) {
      this.bga.statusBar.addActionButton(_("Mulligan (1 gem)"), () => this._startMulligan(),
        { id: 'btn-bc-mulligan', color: 'secondary' });
    }
  }

  _onCardClick(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);

    if (this._mulliganMode) {
      this._mulliganMode = false;
      document.getElementById('bc-deploy-ui')?.classList.remove('bc-mulligan-mode');
      this.bga.actions.performAction('actMulligan', { cardId });
      return;
    }

    const assignedCol = Object.keys(this._slots).find(col => this._slots[col] === cardId);
    if (assignedCol) {
      this._slots[assignedCol] = null;
      e.currentTarget.classList.remove('bc-card-selected');
    } else {
      const freeCol = ['col1', 'col2', 'col3'].find(col => this._slots[col] === null);
      if (freeCol) {
        this._slots[freeCol] = cardId;
        e.currentTarget.classList.add('bc-card-selected');
      }
    }
    this._updateSlotDisplay();
  }

  _updateSlotDisplay() {
    const labels = { col1: _('Left'), col2: _('Center'), col3: _('Right') };
    for (const col of ['col1', 'col2', 'col3']) {
      const el = document.getElementById(`bc-slot-${col}`);
      if (el) {
        const cid = this._slots[col];
        el.textContent = `${labels[col]}: ${cid !== null ? `#${cid}` : '—'}`;
      }
    }
  }

  _confirm() {
    const { col1, col2, col3 } = this._slots;
    if (col1 === null || col2 === null || col3 === null) {
      this.bga.statusBar.setTitle(_("Please assign all 3 positions before confirming"));
      return;
    }
    this.bga.actions.performAction('actDeployCards', {
      col1CardId: col1,
      col2CardId: col2,
      col3CardId: col3,
    });
  }

  _startMulligan() {
    this._mulliganMode = true;
    document.getElementById('bc-deploy-ui')?.classList.add('bc-mulligan-mode');
    this.bga.statusBar.setTitle(_("Click a card to mulligan it (return to deck, draw new)"));
  }
}

// ---------------------------------------------------------------------------
// Upgrade state — MULTIPLE_ACTIVE_PLAYER (state 40)
// ---------------------------------------------------------------------------

class Upgrade {
  constructor(game, bga) {
    this.game         = game;
    this.bga          = bga;
    this._choices     = {};
    this._gemsCharged = 0;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is upgrading their cards…"));
      return;
    }
    this._gemsCharged = args.gems_charged || 0;
    this._build(args.center_cards || [], args.upgrade_options || {}, this._gemsCharged);
  }

  onLeavingState() {
    this._teardown();
  }

  _teardown() {
    document.getElementById('bc-upgrade-ui')?.remove();
  }

  _build(centerCards, upgradeOptions, gemsCharged) {
    this._choices = {};

    if (centerCards.length === 0) {
      this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
        <div id="bc-upgrade-ui">
          <p>${_("No face-up center cards — nothing to upgrade.")}</p>
        </div>
      `);
      this.bga.statusBar.setTitle(_("${you} have no cards to upgrade"));
      this.bga.statusBar.addActionButton(_("Confirm"), () => this._confirm(),
        { id: 'btn-bc-upgrade' });
      return;
    }

    let cardsHtml = '';
    for (const c of centerCards) {
      this._choices[c.id] = { action: 'produce', chosenId: null };
      const opts    = upgradeOptions[c.id] || [];
      const optHtml = opts.map(o => `
        <div class="bc-card bc-upgrade-option bc-card-rank-${o.type}"
             id="bc-uopt-${o.id}" data-opt-id="${o.id}" data-card-id="${c.id}">
          <strong>${this.game._rankName(o.type)}</strong>
          <br>${this.game._familyName(o.family)}
          <br>#${o.type_arg}
        </div>
      `).join('') || `<em>${_("No options available")}</em>`;

      cardsHtml += `
        <div class="bc-upgrade-card" id="bc-uchoice-${c.id}" data-card-id="${c.id}">
          <div class="bc-upgrade-card-info bc-card-rank-${c.type}">
            Pos ${c.position} — ${this.game._rankName(c.type)} ${this.game._familyName(c.family)} #${c.type_arg}
          </div>
          <div class="bc-upgrade-actions">
            <button class="bc-btn-produce bc-btn-active" id="bc-uprod-${c.id}" data-card-id="${c.id}">
              ${_("Produce")}
            </button>
            <button class="bc-btn-upgrade" id="bc-uupg-${c.id}" data-card-id="${c.id}">
              ${_("Upgrade (gem)")}
            </button>
          </div>
          <div class="bc-upgrade-options" id="bc-uopts-${c.id}" style="display:none">
            ${optHtml}
          </div>
        </div>
      `;
    }

    this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
      <div id="bc-upgrade-ui">
        <p>${_("Gems charged")}: <strong>${gemsCharged}</strong> — ${_("choose Production or Upgrade for each center card")}.</p>
        <div id="bc-upgrade-cards">${cardsHtml}</div>
      </div>
    `);

    document.querySelectorAll('.bc-btn-produce').forEach(btn =>
      btn.addEventListener('click', e => this._selectProduce(e))
    );
    document.querySelectorAll('.bc-btn-upgrade').forEach(btn =>
      btn.addEventListener('click', e => this._selectUpgrade(e))
    );
    document.querySelectorAll('.bc-upgrade-option').forEach(el =>
      el.addEventListener('click', e => this._selectOption(e))
    );

    this.bga.statusBar.setTitle(_("${you} must choose Production or Upgrade for each center card"));
    this.bga.statusBar.addActionButton(_("Confirm Upgrades"), () => this._confirm(),
      { id: 'btn-bc-upgrade' });
  }

  _selectProduce(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: 'produce', chosenId: null };
    document.getElementById(`bc-uopts-${cardId}`)?.style.setProperty('display', 'none');
    document.getElementById(`bc-uprod-${cardId}`)?.classList.add('bc-btn-active');
    document.getElementById(`bc-uupg-${cardId}`)?.classList.remove('bc-btn-active');
    document.querySelectorAll(`#bc-uopts-${cardId} .bc-upgrade-option`)
      .forEach(el => el.classList.remove('bc-option-selected'));
  }

  _selectUpgrade(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: 'upgrade', chosenId: null };
    document.getElementById(`bc-uopts-${cardId}`)?.style.setProperty('display', 'flex');
    document.getElementById(`bc-uprod-${cardId}`)?.classList.remove('bc-btn-active');
    document.getElementById(`bc-uupg-${cardId}`)?.classList.add('bc-btn-active');
  }

  _selectOption(e) {
    const optId  = parseInt(e.currentTarget.dataset.optId, 10);
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: 'upgrade', chosenId: optId };
    document.querySelectorAll(`#bc-uopts-${cardId} .bc-upgrade-option`).forEach(el =>
      el.classList.toggle('bc-option-selected', parseInt(el.dataset.optId, 10) === optId)
    );
  }

  _confirm() {
    const produceCardIds  = [];
    const upgradeCardIds  = [];
    const chosenOptionIds = [];

    for (const [cardIdStr, choice] of Object.entries(this._choices)) {
      const cardId = parseInt(cardIdStr, 10);
      if (choice.action === 'produce') {
        produceCardIds.push(cardId);
      } else {
        if (choice.chosenId === null) {
          this.bga.statusBar.setTitle(_("Please select a replacement card for each upgrade"));
          return;
        }
        upgradeCardIds.push(cardId);
        chosenOptionIds.push(choice.chosenId);
      }
    }

    if (upgradeCardIds.length > this._gemsCharged) {
      this.bga.statusBar.setTitle(_("Not enough charged gems for this many upgrades"));
      return;
    }

    this.bga.actions.performAction('actConfirmUpgrades', {
      produceCardIds,
      upgradeCardIds,
      chosenOptionIds,
    });
  }
}

// ---------------------------------------------------------------------------
// Main Game class
// ---------------------------------------------------------------------------

export class Game {
  constructor(bga) {
    this.bga = bga;

    this.silverDraft = new SilverDraft(this, bga);
    this.deploy      = new Deploy(this, bga);
    this.upgrade     = new Upgrade(this, bga);
    this.bga.states.register("SilverDraft", this.silverDraft);
    this.bga.states.register("Deploy",      this.deploy);
    this.bga.states.register("Upgrade",     this.upgrade);
  }

  setup(gamedatas) {
    this.gamedatas = gamedatas;
    this._myPid    = String(this.bga.player_id);
    const gameArea = this.bga.gameArea.getElement();

    // Round / turn tracker
    gameArea.insertAdjacentHTML('beforeend', `
      <div id="bc-round-tracker">
        ${_("Round")} <span id="bc-round-counter">${gamedatas.round_number}</span>/4 —
        ${_("Turn")} <span id="bc-turn-counter">${gamedatas.turn_number}</span>/3
      </div>
    `);

    // Players area with 3×3 grids
    gameArea.insertAdjacentHTML('beforeend', `<div id="bc-players-area"></div>`);
    const playersArea = document.getElementById('bc-players-area');

    // Current player first, opponents below
    const rawOrder = Array.isArray(gamedatas.player_order) && gamedatas.player_order.length
      ? gamedatas.player_order.map(String)
      : Object.keys(gamedatas.players);
    const myPid       = this._myPid;
    const playerOrder = [myPid, ...rawOrder.filter(p => p !== myPid)];

    for (const pidStr of playerOrder) {
      const player = gamedatas.players[pidStr];
      if (!player) continue;
      const isMe = pidStr === myPid;

      // Cells: row 2 top → row 0 bottom, col 0 left → col 2 right
      let cellsHtml = '';
      for (const row of [2, 1, 0]) {
        for (const col of [0, 1, 2]) {
          const pos      = row * 3 + col;
          const colClass = col === 1 ? 'bc-cell-center'
                         : col === 0 ? 'bc-cell-left'
                         : 'bc-cell-right';
          cellsHtml += `<div class="bc-cell ${colClass}"
                             id="bc-cell-${pidStr}-${pos}"
                             data-player-id="${pidStr}" data-pos="${pos}"></div>`;
        }
      }

      playersArea.insertAdjacentHTML('beforeend', `
        <div class="bc-player-board" data-player-id="${pidStr}">
          <div class="bc-player-label" style="color:#${player.color || '000000'}">
            ${player.name || pidStr}
            <span class="bc-first-player-marker" id="bc-fp-${pidStr}" style="display:none">★</span>
          </div>
          <div class="bc-grid" id="bc-grid-${pidStr}">${cellsHtml}</div>
          ${isMe ? `<div class="bc-hand-area" id="bc-hand-area-${pidStr}"></div>` : ''}
          <div class="bc-player-info">
            <span id="bc-gems-${pidStr}">
              💎 <span id="bc-gems-charged-${pidStr}">?</span>↑
              / <span id="bc-gems-uncharged-${pidStr}">?</span>↓
            </span>
          </div>
        </div>
      `);
    }

    // Show first-player marker
    const fpEl = document.getElementById(`bc-fp-${playerOrder[0]}`);
    if (fpEl) fpEl.style.removeProperty('display');

    // Solo mode: insert bot columns around the players area
    if (gamedatas.is_solo) {
      const cells = (side) => [0,1,2].map(row =>
        `<div class="bc-bot-cell" id="bc-bot-${side}-${row}" data-side="${side}" data-row="${row}"></div>`
      ).join('');
      playersArea.insertAdjacentHTML('afterbegin', `
        <div id="bc-bot-board-left" class="bc-bot-board">
          <div class="bc-bot-label">${_("Bot")} ◀</div>
          <div class="bc-bot-column" id="bc-bot-col-left">${cells('left')}</div>
        </div>
      `);
      playersArea.insertAdjacentHTML('beforeend', `
        <div id="bc-bot-board-right" class="bc-bot-board">
          <div class="bc-bot-label">▶ ${_("Bot")}</div>
          <div class="bc-bot-column" id="bc-bot-col-right">${cells('right')}</div>
        </div>
      `);
      gameArea.insertAdjacentHTML('beforeend', `
        <div id="bc-bot-score-panel">
          ${_("Bot")}: <strong id="bc-bot-score-value">${gamedatas.bot_score ?? 0}</strong> ${_("pts")}
        </div>
      `);
      for (const card of (gamedatas.bot_grid_cards || [])) {
        this._placeBotCard(card.side, card.row, card);
      }
    }

    // Place existing grid cards (for page reload mid-game)
    for (const card of (gamedatas.grid_cards || [])) {
      const pidStr = card.card_location.replace('grid_', '');
      this._placeCard(pidStr, parseInt(card.position, 10), card);
    }

    // Initial gem values
    for (const [pidStr, player] of Object.entries(gamedatas.players)) {
      const el1 = document.getElementById(`bc-gems-charged-${pidStr}`);
      if (el1) el1.textContent = player.gems_charged ?? '?';
      const el2 = document.getElementById(`bc-gems-uncharged-${pidStr}`);
      if (el2) el2.textContent = player.gems_uncharged ?? '?';
    }

    // Shared deck counters
    const sizes = gamedatas.deck_sizes || {};
    gameArea.insertAdjacentHTML('beforeend', `
      <div id="bc-shared-decks">
        ${_("Bronze")}: <strong id="bc-deck-bronze">${sizes.bronze ?? 0}</strong> |
        ${_("Silver")}: <strong id="bc-deck-silver">${sizes.silver ?? 0}</strong> |
        ${_("Gold")}: <strong id="bc-deck-gold">${sizes.gold ?? 0}</strong>
      </div>
    `);

    this.bga.notifications.setupPromiseNotifications();
  }

  // ---- Card display helpers ----

  // Returns the CSS background-position (in display px) for a face-up card.
  // Sprite sheet: cards_scoundrels.png — 13 cols × 3 rows, background-size 1950×333.
  //   Col: Bronze 0-2, Silver 3-8, Gold 9-11, Back 12
  //   Row: Gambler 0, Brute 1, Pirate 2
  _spritePos(type, typeArg, family) {
    const row = (parseInt(family, 10) || 1) - 1;
    let col;
    const t = parseInt(type,    10);
    const a = parseInt(typeArg, 10);
    if (t === 1)      col = (a - 1) % 3;          // bronze  → 0-2
    else if (t === 2) col = 3 + (a - 1) % 6;      // silver  → 3-8
    else              col = 9 + (a - 1) % 3;      // gold    → 9-11
    return { x: -(col * 150), y: -(row * 111) };
  }

  _cardHtml(card) {
    const id = card.id ?? card.card_id;
    if (!card.type) {
      return `<div class="bc-card bc-card-hidden" id="bc-card-${id}">▪</div>`;
    }
    const pos = this._spritePos(card.type, card.type_arg, card.family);
    return `<div class="bc-card bc-card-sprite bc-card-rank-${card.type}" id="bc-card-${id}"
                 style="background-position:${pos.x}px ${pos.y}px"></div>`;
  }

  _placeCard(pidStr, pos, card) {
    const cell = document.getElementById(`bc-cell-${pidStr}-${pos}`);
    if (cell) cell.innerHTML = this._cardHtml(card);
  }

  _placeBotCard(side, row, card) {
    const cell = document.getElementById(`bc-bot-${side}-${row}`);
    if (!cell) return;
    if (!card || !card.type) {
      cell.innerHTML = '<div class="bc-card bc-card-hidden">▪</div>';
    } else {
      cell.innerHTML = `<div class="bc-card bc-card-rank-${card.type}">
        <strong>${this._rankName(card.type)}</strong>
        <br>${this._familyName(card.family)}
        <br>#${card.type_arg}
      </div>`;
    }
  }

  // ---- Notification handlers (auto-registered by setupPromiseNotifications) ----

  // Three face-down cards placed in the grid by a player
  async notif_cardsDeployed(args) {
    const pid = String(args.player_id);
    for (const c of (args.cards || [])) {
      this._placeCard(pid, parseInt(c.position, 10), { id: c.id, type: null });
    }
  }

  // Gem count changed (mulligan, produce, upgrade)
  async notif_gemUpdated(args) {
    const pid = String(args.player_id);
    const el1 = document.getElementById(`bc-gems-charged-${pid}`);
    if (el1) el1.textContent = args.charged;
    const el2 = document.getElementById(`bc-gems-uncharged-${pid}`);
    if (el2) el2.textContent = args.uncharged;
  }

  // Current row flipped face-up — animated scaleX flip per card
  async notif_cardsRevealed(args) {
    const pid  = String(args.player_id);
    const HALF = 150; // ms per half-flip

    for (const c of (args.cards || [])) {
      const pos      = parseInt(c.position, 10);
      const cell     = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (!cell) continue;

      const existing = cell.firstElementChild;
      if (existing) {
        existing.style.transition = `transform ${HALF}ms ease-in`;
        existing.style.transform  = 'scaleX(0)';
        await new Promise(r => setTimeout(r, HALF));
      }

      this._placeCard(pid, pos, c);

      const fresh = cell.firstElementChild;
      if (fresh) {
        fresh.style.transform = 'scaleX(0)';
        void fresh.offsetWidth; // force reflow so transition fires
        fresh.style.transition = `transform ${HALF}ms ease-out`;
        fresh.style.transform  = 'scaleX(1)';
        await new Promise(r => setTimeout(r, HALF));
      }
    }
  }

  // Center card effect applied during Influence phase
  async notif_influenceResolved(args) {
    let msg = `[bc] Influence — Player ${args.player_id}, effect ${args.effect_type}`;
    if (args.dice_roll != null) msg += ` | die: ${args.dice_roll}`;
    console.log(msg);
    // TODO Phase 7b: animate effect (token, gem, score change)
  }

  // One combat result — fade the losing card, restore after a delay
  async notif_combatResolved(args) {
    const rightPid = String(args.right_player_id);
    const winnerId = args.winner_id !== null && args.winner_id !== undefined
      ? String(args.winner_id) : null;

    let leftCard, rightCard;

    if (args.solo_combat) {
      const botCell = document.getElementById(`bc-bot-${args.bot_side}-${args.bot_row}`);
      leftCard  = botCell?.firstElementChild;
      const rightPos = parseInt(args.right_position, 10);
      rightCard = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild;

      if (winnerId === '0' && rightCard) rightCard.classList.add('bc-card-loser');
      else if (winnerId !== '0' && winnerId !== null && leftCard) leftCard.classList.add('bc-card-loser');
    } else {
      const leftPid  = String(args.left_player_id);
      const leftPos  = parseInt(args.left_position,  10);
      const rightPos = parseInt(args.right_position, 10);
      leftCard  = document.getElementById(`bc-cell-${leftPid}-${leftPos}`)?.firstElementChild;
      rightCard = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild;

      if (winnerId === leftPid && rightCard)  rightCard.classList.add('bc-card-loser');
      else if (winnerId === rightPid && leftCard) leftCard.classList.add('bc-card-loser');
    }

    await new Promise(r => setTimeout(r, 1200));
    leftCard?.classList.remove('bc-card-loser');
    rightCard?.classList.remove('bc-card-loser');
  }

  // Rage marker toggled (Brutes family)
  async notif_rageUpdated(args) {
    console.log(`[bc] Rage — Player ${args.player_id}: ${args.rage === 1 ? 'Enraged' : 'Calm'}`);
    // TODO Phase 7b: update rage marker icon in player board
  }

  // Token placed on a grid position
  async notif_tokenAdded(args) {
    console.log(`[bc] Token — Player ${args.player_id} pos ${args.grid_position}: ${args.token_type} val=${args.value}`);
    // TODO Phase 7b: show token element on grid cell
  }

  // All tokens cleared at start of Upgrade phase
  async notif_tokensCleared() {
    console.log('[bc] Tokens cleared');
    // TODO Phase 7b: remove token elements from all cells
  }

  // A player confirmed their upgrade choices (no card details — upgrade is secret)
  async notif_upgradeConfirmed(args) {
    const pid = String(args.player_id);
    // All center cards are now face-down (produced or replaced with face-down upgrade)
    for (const pos of [1, 4, 7]) {
      const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (cell && cell.firstElementChild) {
        const cardEl = cell.firstElementChild;
        cardEl.className = 'bc-card bc-card-hidden';
        cardEl.textContent = '▪';
      }
    }
    console.log(`[bc] Upgrade — Player ${args.player_id}: ${args.produced_count} produced, ${args.upgraded_count} upgraded`);
  }

  // Turn counter incremented (sent by CheckTurn when turn < 3)
  async notif_turnUpdated(args) {
    const el = document.getElementById('bc-turn-counter');
    if (el) el.textContent = args.turn_number;
  }

  // New round started: update counters + move first-player marker
  async notif_roundStarted(args) {
    const roundEl = document.getElementById('bc-round-counter');
    if (roundEl) roundEl.textContent = args.round_number;
    const turnEl = document.getElementById('bc-turn-counter');
    if (turnEl) turnEl.textContent = args.turn_number;

    document.querySelectorAll('.bc-first-player-marker')
      .forEach(el => el.style.setProperty('display', 'none'));
    const fpEl = document.getElementById(`bc-fp-${args.first_player_id}`);
    if (fpEl) fpEl.style.removeProperty('display');
  }

  // All grid cards returned to deck at start of new round
  async notif_deckShuffled(args) {
    const pid = String(args.player_id);
    for (let pos = 0; pos < 9; pos++) {
      const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (cell) cell.innerHTML = '';
    }
  }

  // Solo: bot placed 6 cards face-down at start of round
  async notif_botCardsDeployed(args) {
    for (const side of ['left', 'right']) {
      const count = side === 'left' ? (args.left_count ?? 3) : (args.right_count ?? 3);
      for (let row = 0; row < 3; row++) {
        const cell = document.getElementById(`bc-bot-${side}-${row}`);
        if (cell) {
          cell.innerHTML = row < count ? '<div class="bc-card bc-card-hidden">▪</div>' : '';
        }
      }
    }
  }

  // Solo: one bot card revealed
  async notif_botCardRevealed(args) {
    this._placeBotCard(args.side, args.row, args.card);
  }

  // Solo: bot scored points
  async notif_botScoreUpdated(args) {
    const el = document.getElementById('bc-bot-score-value');
    if (el) el.textContent = args.score;
  }

  // Solo: bot rage marker toggled
  async notif_botRageUpdated(args) {
    console.log(`[bc] Bot rage: ${args.rage === 1 ? 'Enraged' : 'Calm'}`);
  }

  // Solo: bot upgraded its deck — clear bot columns
  async notif_botUpgraded() {
    for (const side of ['left', 'right']) {
      for (let row = 0; row < 3; row++) {
        const cell = document.getElementById(`bc-bot-${side}-${row}`);
        if (cell) cell.innerHTML = '';
      }
    }
  }

  // Silver draft: another player picked their card (no card details — choices are private)
  async notif_silverDraftPicked(args) {
    console.log(`[bc] Draft pass ${args.draft_round}/2 — ${args.player_name} picks`);
  }

  // Silver draft complete: all cards distributed, game about to start
  async notif_silverDraftComplete() {
    document.getElementById('bc-draft-ui')?.remove();
    console.log('[bc] Silver draft complete');
  }

  // Private: new card drawn after mulligan (sent only to the active player)
  async notif_mulliganCard(args) {
    const discardedEl = document.getElementById(`bc-hcard-${args.discarded_card_id}`);
    if (discardedEl) {
      // Free the deploy slot if this card was assigned
      const assignedCol = Object.keys(this.deploy._slots)
        .find(col => this.deploy._slots[col] === args.discarded_card_id);
      if (assignedCol) {
        this.deploy._slots[assignedCol] = null;
        this.deploy._updateSlotDisplay();
      }
      discardedEl.remove();
    }

    const c = args.new_card;
    if (c && this.deploy._myPid) {
      const container = document.getElementById(`bc-hand-area-${this.deploy._myPid}`);
      if (container) {
        container.insertAdjacentHTML('beforeend', `
          <div class="bc-card bc-hand-card bc-card-rank-${c.type}"
               id="bc-hcard-${c.id}" data-card-id="${c.id}">
            <strong>${this._rankName(c.type)}</strong>
            <br>${this._familyName(c.family)}
            <br>#${c.type_arg}
          </div>
        `);
        const newEl = document.getElementById(`bc-hcard-${c.id}`);
        if (newEl) newEl.addEventListener('click', e => this.deploy._onCardClick(e));
      }
    }
  }
}
