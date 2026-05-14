/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * borderclash implementation : © Merle Editions
 */

const BgaAnimations = await importEsmLib("bga-animations", "1.x");

// ---------------------------------------------------------------------------
// SilverDraft state — MULTIPLE_ACTIVE_PLAYER (state 5)
// Players pick 1 Silver card to keep; the rest pass left. Runs twice (2 passes).
// ---------------------------------------------------------------------------

class SilverDraft {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._pid = null;
    this._selected = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      // Player just submitted — keep deck fan + remaining hand cards visible while waiting.
      document.getElementById("btn-bc-draft-confirm")?.remove();
      document.getElementById("bc-draft-ui")?.remove();
      this.bga.statusBar.setTitle(_("${actplayer} is picking a Silver card…"));
      return;
    }
    // (Re-)entering as the active player: rebuild from scratch.
    this._teardown();
    const draftCards = args.draft_cards && args.draft_cards.length > 0 ? args.draft_cards : this.game.gamedatas?.draft_cards || [];
    const deckCards = args.deck_cards || this.game.gamedatas?.deck_cards || [];
    this._build(draftCards, deckCards, args.draft_round || 1);
  }

  onLeavingState() {
    if (this._pid) {
      document.getElementById(`bc-draft-deck-${this._pid}`)?.remove();
      this._pid = null;
    }
    this._teardown();
  }

  _teardown() {
    document.getElementById("bc-draft-ui")?.remove();
    // Fan is NOT removed here — it persists between draft passes.
    document.getElementById("btn-bc-draft-confirm")?.remove();
    if (this._pid) {
      const handArea = document.getElementById(`bc-hand-area-${this._pid}`);
      if (handArea) handArea.innerHTML = "";
    }
    this._selected = null;
  }

  _build(draftCards, deckCards, draftRound) {
    this._pid = this.game._currentPlayerPid();
    this._selected = null;

    // Draft cards in the hand area — horizontal, click to select.
    const handArea = document.getElementById(`bc-hand-area-${this._pid}`);
    if (handArea) {
      handArea.innerHTML = draftCards
        .map((c) => {
          const pos = this.game._spritePos(c.type, c.type_arg, c.family);
          return `<div class="bc-card bc-draft-card bc-card-sprite bc-card-rank-${c.type}"
                     id="bc-dcard-${c.id}" data-card-id="${c.id}"
                     style="background-position:${pos.x}px ${pos.y}px"></div>`;
        })
        .join("");

      // Slide cards in from the right (visual cue: arrived from right neighbor).
      const cards = Array.from(handArea.querySelectorAll(".bc-draft-card"));
      cards.forEach((el) => el.addEventListener("click", (e) => this._onCardClick(e)));
      this.game.animationManager.playInterval(
        cards.map((el) => () => this.game.animationManager.slideInFromDelta(el, { x: 80, y: 0 }, { duration: 300 })),
        80,
      );
    }

    // Deck fan — vertical stack showing cards already owned, 50px offset per card.
    // Created once for pass 1; persists into pass 2 (fan already contains the picked card).
    if (!document.getElementById(`bc-draft-fan-${this._pid}`)) {
      const playerBoard = document.querySelector(`.bc-player-board[data-player-id="${this._pid}"]`);
      if (playerBoard) {
        const deckHtml = deckCards
          .map((c) => {
            const pos = this.game._spritePos(c.type, c.type_arg, c.family);
            return `<div class="bc-card bc-card-sprite bc-card-rank-${c.type}"
                       id="bc-ddeck-${c.id}"
                       style="background-position:${pos.x}px ${pos.y}px"></div>`;
          })
          .join("");
        playerBoard.insertAdjacentHTML(
          "beforeend",
          `
          <div id="bc-draft-deck-${this._pid}" class="bc-draft-deck-area">
            <div class="bc-draft-deck-label">${_("Deck")} (${deckCards.length})</div>
            <div class="bc-draft-deck-fan" id="bc-draft-fan-${this._pid}">${deckHtml}</div>
          </div>
        `,
        );
      }
    }

    // Hint panel
    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
      <div id="bc-draft-ui">
        <p id="bc-draft-hint">
          ${_("Pass")} ${draftRound}/2 —
          ${_("Select a Silver card, then confirm.")}
        </p>
      </div>
    `,
    );

    this.bga.statusBar.setTitle(_("${you} must pick 1 Silver card to keep"));
  }

  _onCardClick(e) {
    const cardEl = e.currentTarget;
    const cardId = parseInt(cardEl.dataset.cardId, 10);

    if (this._selected === cardId) {
      // Deselect: remove highlight and confirm button
      cardEl.classList.remove("bc-card-selected");
      this._selected = null;
      document.getElementById("btn-bc-draft-confirm")?.remove();
    } else {
      // Deselect previous card if any
      if (this._selected !== null) {
        document.getElementById(`bc-dcard-${this._selected}`)?.classList.remove("bc-card-selected");
      }
      cardEl.classList.add("bc-card-selected");
      this._selected = cardId;
      // Replace confirm button (no duplicates via fixed ID)
      document.getElementById("btn-bc-draft-confirm")?.remove();
      this.bga.statusBar.addActionButton(_("Keep this card"), () => this._confirm(), { id: "btn-bc-draft-confirm" });
    }
  }

  async _confirm() {
    if (this._selected === null) return;
    const cardId = this._selected;
    const cardEl = document.getElementById(`bc-dcard-${cardId}`);
    if (!cardEl) return;

    // Lock UI immediately.
    document.querySelectorAll(".bc-draft-card").forEach((el) => { el.style.pointerEvents = "none"; });
    document.getElementById("btn-bc-draft-confirm")?.remove();
    this.bga.statusBar.setTitle(_("Waiting for other players…"));

    const fanEl = document.getElementById(`bc-draft-fan-${this._pid}`);
    if (fanEl) {
      // Slide the actual card element from the hand into the fan stack.
      await this.game.animationManager.slideAndAttach(cardEl, fanEl, { duration: 400 });
      // Once landed, strip the draft-card interactivity class so fan hover styles don't apply.
      cardEl.classList.remove("bc-draft-card");
      const labelEl = document.querySelector(`#bc-draft-deck-${this._pid} .bc-draft-deck-label`);
      if (labelEl) labelEl.textContent = `${_("Deck")} (${fanEl.querySelectorAll(".bc-card").length})`;
    } else {
      cardEl.remove();
    }

    this.bga.actions.performAction("actPickSilver", { keptCardId: cardId });
  }
}

// ---------------------------------------------------------------------------
// Deploy state — MULTIPLE_ACTIVE_PLAYER (state 10)
// Players see their 3-card hand, click a card to select it, then click
// Left / Center / Right to assign it. Confirm appears when all 3 are placed.
// ---------------------------------------------------------------------------

class Deploy {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._slots = { col1: null, col2: null, col3: null }; // slot → cardId
    this._cardSlot = {}; // cardId → slot (reverse map for badge removal)
    this._selectedCard = null;
    this._mulliganMode = false;
    this._myPid = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("Waiting for other players to deploy…"));
      return;
    }
    this._slots = { col1: null, col2: null, col3: null };
    this._cardSlot = {};
    this._selectedCard = null;
    this._mulliganMode = false;
    this._build();
    // Hand arrives via notif_handDealt (reliable across all BGA SDK configurations).
    // If args already carries private data (some SDK versions do), build immediately too.
    if (args.hand && args.hand.length > 0) {
      this._buildHand(args.hand, args.deck_count || 0, args.gems_charged || 0);
    }
  }

  onLeavingState() {
    this._teardown();
  }

  _teardown() {
    document.getElementById("bc-deploy-ui")?.remove();
    document.getElementById("btn-bc-deploy")?.remove();
    document.getElementById("btn-bc-mulligan")?.remove();
    document.getElementById("btn-bc-cancel")?.remove();
    for (const slot of ["col1", "col2", "col3"]) {
      document.getElementById(`btn-bc-slot-${slot}`)?.remove();
    }
    if (this._myPid) {
      const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
      if (handArea) handArea.innerHTML = "";
      // Move any hand cards that were physically placed in grid cells back out,
      // so notif_cardsDeployed can safely replace cells with face-down cards.
      const row = (this.game._currentTurn || 1) - 1;
      for (let col = 0; col < 3; col++) {
        const cell = document.getElementById(`bc-cell-${this._myPid}-${row * 3 + col}`);
        if (cell?.querySelector(".bc-hand-card")) cell.innerHTML = "";
      }
      this._myPid = null;
    }
  }

  _build() {
    this._myPid = this.game._currentPlayerPid();

    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
      <div id="bc-deploy-ui">
        <p id="bc-deploy-hint">${_("Select a card, then choose its border position.")}</p>
        <div id="bc-deploy-slots">
          <span class="bc-deploy-slot" id="bc-slot-col1">${_("Left")}: —</span>
          <span class="bc-deploy-slot" id="bc-slot-col2">${_("Center")}: —</span>
          <span class="bc-deploy-slot" id="bc-slot-col3">${_("Right")}: —</span>
        </div>
      </div>
    `,
    );

    this.bga.statusBar.setTitle(_("${you} must deploy 3 cards"));
    this.bga.statusBar.addActionButton(_("Cancel"), () => this._cancelDeployment(), { id: "btn-bc-cancel", color: "secondary" });
  }

  // Populate the hand area: face-down deck pile + 3 face-up hand cards.
  // Called from notif_handDealt (reliable path) and optionally from onPlayerActivationChange
  // when private args are already present (some BGA SDK versions deliver them).
  _buildHand(hand, deckCount, gemsCharged) {
    if (!this._myPid) return;
    const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (!handArea) return;

    console.log(`[bc] Deploy _buildHand — hand:${hand.length} deck:${deckCount} gems:${gemsCharged}`);

    handArea.innerHTML = "";

    // Face-down deck pile with card count
    if (deckCount > 0) {
      handArea.insertAdjacentHTML(
        "beforeend",
        `
        <div class="bc-deck-pile" id="bc-deck-pile-${this._myPid}">
          <div class="bc-card bc-card-hidden">▪</div>
          <span class="bc-deck-count-badge">${deckCount}</span>
        </div>
      `,
      );
    }

    // Hand cards
    for (const c of hand) {
      const pos = this.game._spritePos(c.type, c.type_arg, c.family);
      handArea.insertAdjacentHTML(
        "beforeend",
        `<div class="bc-card bc-hand-card bc-card-sprite bc-card-rank-${c.type}"
              id="bc-hcard-${c.id}" data-card-id="${c.id}"
              style="background-position:${pos.x}px ${pos.y}px"></div>`,
      );
    }
    handArea.querySelectorAll(".bc-hand-card").forEach((el) => el.addEventListener("click", (e) => this._onCardClick(e)));

    // Mulligan button — only show when gems are available
    document.getElementById("btn-bc-mulligan")?.remove();
    if (gemsCharged > 0) {
      this.bga.statusBar.addActionButton(_("Mulligan (1 gem)"), () => this._startMulligan(), { id: "btn-bc-mulligan", color: "secondary" });
    }
  }

  _onCardClick(e) {
    const cardEl = e.currentTarget;
    const cardId = parseInt(cardEl.dataset.cardId, 10);

    if (this._mulliganMode) {
      this._mulliganMode = false;
      document.getElementById("bc-deploy-ui")?.classList.remove("bc-mulligan-mode");
      this.bga.actions.performAction("actMulligan", { cardId });
      return;
    }

    // If the card is already placed in a grid cell → click deassigns it (returns to hand)
    if (this._cardSlot[cardId]) {
      this._returnCardToHand(cardId, this._cardSlot[cardId]);
      this._updateSlotDisplay();
      if (this._selectedCard === cardId) {
        this._selectedCard = null;
        this._hideSlotButtons();
      }
      document.getElementById("btn-bc-deploy")?.remove();
      return;
    }

    // Toggle deselect
    if (this._selectedCard === cardId) {
      this._selectedCard = null;
      cardEl.classList.remove("bc-card-selected");
      this._hideSlotButtons();
      return;
    }

    // Deselect previous card
    if (this._selectedCard !== null) {
      document.getElementById(`bc-hcard-${this._selectedCard}`)?.classList.remove("bc-card-selected");
      this._hideSlotButtons();
    }

    this._selectedCard = cardId;
    cardEl.classList.add("bc-card-selected");
    this._showSlotButtons(cardId);
  }

  _showSlotButtons(cardId) {
    const defs = [
      { slot: "col1", label: _("Left Border") },
      { slot: "col2", label: _("Center") },
      { slot: "col3", label: _("Right Border") },
    ];
    for (const { slot, label } of defs) {
      this.bga.statusBar.addActionButton(label, () => this._assignSlot(slot, cardId), { id: `btn-bc-slot-${slot}` });
    }
  }

  _hideSlotButtons() {
    for (const slot of ["col1", "col2", "col3"]) {
      document.getElementById(`btn-bc-slot-${slot}`)?.remove();
    }
    document.getElementById("btn-bc-deploy")?.remove();
  }

  _assignSlot(slot, cardId) {
    // Displace any other card currently in this slot → move it back to hand
    const displaced = this._slots[slot];
    if (displaced !== null && displaced !== undefined && displaced !== cardId) {
      this._returnCardToHand(displaced, slot);
    }

    // Slide the selected card from the hand into the grid cell.
    const pos = this._slotToGridPos(slot);
    const cell = document.getElementById(`bc-cell-${this._myPid}-${pos}`);
    const cardEl = document.getElementById(`bc-hcard-${cardId}`);
    if (cardEl && cell) {
      cell.innerHTML = ""; // clear any stale placeholder left by a previous animation
      cardEl.classList.remove("bc-card-selected");
      this.game.animationManager.slideAndAttach(cardEl, cell, { duration: 300 }); // fire-and-forget
    }

    this._slots[slot] = cardId;
    this._cardSlot[cardId] = slot;
    this._selectedCard = null;
    this._updateSlotDisplay();
    this._hideSlotButtons();

    if (["col1", "col2", "col3"].every((s) => this._slots[s] !== null)) {
      this.bga.statusBar.addActionButton(_("Confirm Deployment"), () => this._confirm(), { id: "btn-bc-deploy" });
    }
  }

  _slotToGridPos(slot) {
    const col = { col1: 0, col2: 1, col3: 2 }[slot];
    const row = (this.game._currentTurn || 1) - 1;
    return row * 3 + col;
  }

  // Slide a card from its grid cell back to the hand area.
  // State is reset synchronously; animation plays in the background (fire-and-forget).
  _returnCardToHand(cardId, slot) {
    this._slots[slot] = null;
    delete this._cardSlot[cardId];
    const cardEl = document.getElementById(`bc-hcard-${cardId}`);
    const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (cardEl && handArea) {
      this.game.animationManager.slideAndAttach(cardEl, handArea, { duration: 250 }); // fire-and-forget
    }
  }

  _cancelDeployment() {
    for (const slot of ["col1", "col2", "col3"]) {
      const cardId = this._slots[slot];
      if (cardId !== null && cardId !== undefined) {
        this._returnCardToHand(cardId, slot);
      }
    }
    this._slots = { col1: null, col2: null, col3: null };
    this._cardSlot = {};
    this._selectedCard = null;
    document.getElementById("btn-bc-deploy")?.remove();
    this._hideSlotButtons();
    this._updateSlotDisplay();
  }

  _updateSlotDisplay() {
    const labels = { col1: _("Left"), col2: _("Center"), col3: _("Right") };
    for (const [slot, label] of Object.entries(labels)) {
      const el = document.getElementById(`bc-slot-${slot}`);
      const cid = this._slots[slot];
      if (el) el.textContent = cid !== null ? `${label}: ✓` : `${label}: —`;
    }
  }

  _confirm() {
    const { col1, col2, col3 } = this._slots;
    if (col1 === null || col2 === null || col3 === null) return;
    this.bga.actions.performAction("actDeployCards", {
      col1CardId: col1,
      col2CardId: col2,
      col3CardId: col3,
    });
  }

  _startMulligan() {
    this._mulliganMode = true;
    document.getElementById("bc-deploy-ui")?.classList.add("bc-mulligan-mode");
    this.bga.statusBar.setTitle(_("Click a card to mulligan it (return to deck, draw new)"));
  }
}

// ---------------------------------------------------------------------------
// Upgrade state — MULTIPLE_ACTIVE_PLAYER (state 40)
// ---------------------------------------------------------------------------

class Upgrade {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._choices = {};
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
    document.getElementById("bc-upgrade-ui")?.remove();
  }

  _build(centerCards, upgradeOptions, gemsCharged) {
    this._choices = {};

    if (centerCards.length === 0) {
      this.bga.gameArea.getElement().insertAdjacentHTML(
        "beforeend",
        `
        <div id="bc-upgrade-ui">
          <p>${_("No face-up center cards — nothing to upgrade.")}</p>
        </div>
      `,
      );
      this.bga.statusBar.setTitle(_("${you} have no cards to upgrade"));
      this.bga.statusBar.addActionButton(_("Confirm"), () => this._confirm(), { id: "btn-bc-upgrade" });
      return;
    }

    let cardsHtml = "";
    for (const c of centerCards) {
      this._choices[c.id] = { action: "produce", chosenId: null };
      const opts = upgradeOptions[c.id] || [];
      const optHtml =
        opts
          .map((o) => {
            const pos = this.game._spritePos(o.type, o.type_arg, o.family);
            return `<div class="bc-card bc-upgrade-option bc-card-sprite bc-card-rank-${o.type}"
                     id="bc-uopt-${o.id}" data-opt-id="${o.id}" data-card-id="${c.id}"
                     style="background-position:${pos.x}px ${pos.y}px"></div>`;
          })
          .join("") || `<em>${_("No options available")}</em>`;

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

    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
      <div id="bc-upgrade-ui">
        <p>${_("Gems charged")}: <strong>${gemsCharged}</strong> — ${_("choose Production or Upgrade for each center card")}.</p>
        <div id="bc-upgrade-cards">${cardsHtml}</div>
      </div>
    `,
    );

    document.querySelectorAll(".bc-btn-produce").forEach((btn) => btn.addEventListener("click", (e) => this._selectProduce(e)));
    document.querySelectorAll(".bc-btn-upgrade").forEach((btn) => btn.addEventListener("click", (e) => this._selectUpgrade(e)));
    document.querySelectorAll(".bc-upgrade-option").forEach((el) => el.addEventListener("click", (e) => this._selectOption(e)));

    this.bga.statusBar.setTitle(_("${you} must choose Production or Upgrade for each center card"));
    this.bga.statusBar.addActionButton(_("Confirm Upgrades"), () => this._confirm(), { id: "btn-bc-upgrade" });
  }

  _selectProduce(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: "produce", chosenId: null };
    document.getElementById(`bc-uopts-${cardId}`)?.style.setProperty("display", "none");
    document.getElementById(`bc-uprod-${cardId}`)?.classList.add("bc-btn-active");
    document.getElementById(`bc-uupg-${cardId}`)?.classList.remove("bc-btn-active");
    document.querySelectorAll(`#bc-uopts-${cardId} .bc-upgrade-option`).forEach((el) => el.classList.remove("bc-option-selected"));
  }

  _selectUpgrade(e) {
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: "upgrade", chosenId: null };
    document.getElementById(`bc-uopts-${cardId}`)?.style.setProperty("display", "flex");
    document.getElementById(`bc-uprod-${cardId}`)?.classList.remove("bc-btn-active");
    document.getElementById(`bc-uupg-${cardId}`)?.classList.add("bc-btn-active");
  }

  _selectOption(e) {
    const optId = parseInt(e.currentTarget.dataset.optId, 10);
    const cardId = parseInt(e.currentTarget.dataset.cardId, 10);
    this._choices[cardId] = { action: "upgrade", chosenId: optId };
    document.querySelectorAll(`#bc-uopts-${cardId} .bc-upgrade-option`).forEach((el) => el.classList.toggle("bc-option-selected", parseInt(el.dataset.optId, 10) === optId));
  }

  _confirm() {
    const produceCardIds = [];
    const upgradeCardIds = [];
    const chosenOptionIds = [];

    for (const [cardIdStr, choice] of Object.entries(this._choices)) {
      const cardId = parseInt(cardIdStr, 10);
      if (choice.action === "produce") {
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

    this.bga.actions.performAction("actConfirmUpgrades", {
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
    this.deploy = new Deploy(this, bga);
    this.upgrade = new Upgrade(this, bga);
    this.bga.states.register("SilverDraft", this.silverDraft);
    this.bga.states.register("Deploy", this.deploy);
    this.bga.states.register("Upgrade", this.upgrade);
  }

  setup(gamedatas) {
    this.gamedatas = gamedatas;

    this.animationManager = new BgaAnimations.Manager({
      animationsActive: () => this.bga.gameui?.bgaAnimationsActive?.() ?? true,
      duration: 350,
      easing: "ease-out",
    });

    // Validate bga.player_id against real gamedatas keys — fallback to first player
    const allPids = Object.keys(gamedatas.players ?? {});
    const fromBga = String(this.bga.player_id ?? "");
    this._myPid = allPids.includes(fromBga) ? fromBga : (allPids[0] ?? "");
    this._currentTurn = gamedatas.turn_number || 1;
    const gameArea = this.bga.gameArea.getElement();

    // Round / turn tracker
    gameArea.insertAdjacentHTML(
      "beforeend",
      `
      <div id="bc-round-tracker">
        ${_("Round")} <span id="bc-round-counter">${gamedatas.round_number}</span>/4 —
        ${_("Turn")} <span id="bc-turn-counter">${gamedatas.turn_number}</span>/3
      </div>
    `,
    );

    // Players area with 3×3 grids
    gameArea.insertAdjacentHTML("beforeend", `<div id="bc-players-area"></div>`);
    const playersArea = document.getElementById("bc-players-area");

    // Current player first, then opponents starting from next (direction of play)
    const rawOrder = Array.isArray(gamedatas.player_order) && gamedatas.player_order.length ? gamedatas.player_order.map(String) : Object.keys(gamedatas.players);
    const myPid = this._myPid;
    const myIndexInRaw = rawOrder.indexOf(myPid);
    const n = rawOrder.length;
    const orderedOpps = [];
    for (let i = 1; i < n; i++) orderedOpps.push(rawOrder[(myIndexInRaw + i) % n]);
    const playerOrder = [myPid, ...orderedOpps];

    // Neighbors for border flank columns (null in solo — bot fills the flanks instead)
    this._prevOppPid = n >= 2 ? rawOrder[(myIndexInRaw - 1 + n) % n] : null;
    this._nextOppPid = n >= 2 ? rawOrder[(myIndexInRaw + 1) % n] : null;

    for (const pidStr of playerOrder) {
      const player = gamedatas.players[pidStr];
      if (!player) continue;
      const isMe = pidStr === myPid;

      // Cells: row 2 top → row 0 bottom, col 0 left → col 2 right
      let cellsHtml = "";
      for (const row of [2, 1, 0]) {
        for (const col of [0, 1, 2]) {
          const pos = row * 3 + col;
          const colClass = col === 1 ? "bc-cell-center" : col === 0 ? "bc-cell-left" : "bc-cell-right";
          cellsHtml += `<div class="bc-cell ${colClass}"
                             id="bc-cell-${pidStr}-${pos}"
                             data-player-id="${pidStr}" data-pos="${pos}"></div>`;
        }
      }

      let gridHtml;
      if (isMe) {
        // Left flank: right border of prev opponent (or bot_grid_right in solo)
        // Right flank: left border of next opponent (or bot_grid_left in solo)
        const prevName = this._prevOppPid ? (gamedatas.players[this._prevOppPid]?.name || "?") : _("Bot");
        const nextName = this._nextOppPid ? (gamedatas.players[this._nextOppPid]?.name || "?") : _("Bot");
        let leftFlankHtml = "", rightFlankHtml = "";
        for (const row of [2, 1, 0]) {
          leftFlankHtml  += `<div class="bc-flank-cell" id="bc-flank-left-${row}"></div>`;
          rightFlankHtml += `<div class="bc-flank-cell" id="bc-flank-right-${row}"></div>`;
        }
        gridHtml = `
          <div class="bc-grid-with-flanks">
            <div class="bc-flank-col">
              <div class="bc-flank-label">← ${prevName}</div>
              ${leftFlankHtml}
            </div>
            <div class="bc-grid" id="bc-grid-${pidStr}">${cellsHtml}</div>
            <div class="bc-flank-col">
              <div class="bc-flank-label">${nextName} →</div>
              ${rightFlankHtml}
            </div>
          </div>`;
      } else {
        gridHtml = `<div class="bc-grid" id="bc-grid-${pidStr}">${cellsHtml}</div>`;
      }

      playersArea.insertAdjacentHTML(
        "beforeend",
        `
        <div class="bc-player-board" data-player-id="${pidStr}">
          <div class="bc-player-label" style="color:#${player.color || "000000"}">
            ${player.name || pidStr}
            <span class="bc-first-player-marker" id="bc-fp-${pidStr}" style="display:none">★</span>
          </div>
          ${gridHtml}
          <div class="bc-hand-area" id="bc-hand-area-${pidStr}"></div>
          <div class="bc-player-info">
            <span id="bc-gems-${pidStr}">
              💎 <span id="bc-gems-charged-${pidStr}">?</span>↑
              / <span id="bc-gems-uncharged-${pidStr}">?</span>↓
            </span>
          </div>
        </div>
      `,
      );
    }

    // Show first-player marker
    const fpEl = document.getElementById(`bc-fp-${playerOrder[0]}`);
    if (fpEl) fpEl.style.removeProperty("display");

    // Solo mode: bot cards fill the flank columns (bot_grid_right → left flank, bot_grid_left → right flank)
    if (gamedatas.is_solo) {
      gameArea.insertAdjacentHTML(
        "beforeend",
        `
        <div id="bc-bot-score-panel">
          ${_("Bot")}: <strong id="bc-bot-score-value">${gamedatas.bot_score ?? 0}</strong> ${_("pts")}
        </div>
      `,
      );
      for (const card of gamedatas.bot_grid_cards || []) {
        this._placeBotCard(card.side, card.row, card);
      }
    }

    // Place existing grid cards (for page reload mid-game)
    for (const card of gamedatas.grid_cards || []) {
      const pidStr = card.card_location.replace("grid_", "");
      this._placeCard(pidStr, parseInt(card.position, 10), card);
    }

    // Initial gem values
    for (const [pidStr, player] of Object.entries(gamedatas.players)) {
      const el1 = document.getElementById(`bc-gems-charged-${pidStr}`);
      if (el1) el1.textContent = player.gems_charged ?? "?";
      const el2 = document.getElementById(`bc-gems-uncharged-${pidStr}`);
      if (el2) el2.textContent = player.gems_uncharged ?? "?";
    }

    // Shared deck counters
    const sizes = gamedatas.deck_sizes || {};
    gameArea.insertAdjacentHTML(
      "beforeend",
      `
      <div id="bc-shared-decks">
        ${_("Bronze")}: <strong id="bc-deck-bronze">${sizes.bronze ?? 0}</strong> |
        ${_("Silver")}: <strong id="bc-deck-silver">${sizes.silver ?? 0}</strong> |
        ${_("Gold")}: <strong id="bc-deck-gold">${sizes.gold ?? 0}</strong>
      </div>
    `,
    );

    this.bga.notifications.setupPromiseNotifications();
  }

  // Returns the current player's ID, validated in setup() against gamedatas.players.
  _currentPlayerPid() {
    return this._myPid;
  }

  // ---- Card display helpers ----

  _rankName(type) {
    return { 1: _("Bronze"), 2: _("Silver"), 3: _("Gold") }[parseInt(type, 10)] || "?";
  }

  _familyName(family) {
    return { 1: _("Gambler"), 2: _("Brute"), 3: _("Pirate") }[parseInt(family, 10)] || "?";
  }

  // Returns the CSS background-position (in display px) for a face-up card.
  // Sprite sheet: cards_scoundrels.png — 12 cols × 3 rows, background-size 2004×357.
  //   Col: Bronze 0-1, Silver 2-7, Gold 8-10, Back 11
  //   Row: Gambler 0, Brute 1, Pirate 2
  _spritePos(type, typeArg, family) {
    const row = (parseInt(family, 10) || 1) - 1;
    let col;
    const t = parseInt(type, 10);
    const a = parseInt(typeArg, 10);
    if (t === 1)
      col = (a - 1) % 2; // bronze → 0-1
    else if (t === 2)
      col = 2 + ((a - 1) % 6); // silver → 2-7
    else col = 8 + ((a - 1) % 3); // gold   → 8-10
    return { x: -(col * 167), y: -(row * 119) };
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

    // Mirror opponent border cards into the current player's flank columns
    const col = pos % 3;
    const row = Math.floor(pos / 3);
    if (pidStr === this._prevOppPid && col === 2) {
      const flank = document.getElementById(`bc-flank-left-${row}`);
      if (flank) flank.innerHTML = this._cardHtml(card);
    }
    if (pidStr === this._nextOppPid && col === 0) {
      const flank = document.getElementById(`bc-flank-right-${row}`);
      if (flank) flank.innerHTML = this._cardHtml(card);
    }
  }

  _placeBotCard(side, row, card) {
    // bot_grid_right = player's left flank; bot_grid_left = player's right flank
    const flankSide = side === "right" ? "left" : "right";
    const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
    if (!flank) return;
    if (!card || !card.type) {
      flank.innerHTML = '<div class="bc-card bc-card-hidden">▪</div>';
    } else {
      const pos = this._spritePos(card.type, card.type_arg, card.family);
      flank.innerHTML = `<div class="bc-card bc-card-sprite bc-card-rank-${card.type}"
                             style="background-position:${pos.x}px ${pos.y}px"></div>`;
    }
  }

  // ---- Notification handlers (auto-registered by setupPromiseNotifications) ----

  // Three face-down cards placed in the grid by a player
  async notif_cardsDeployed(args) {
    const pid = String(args.player_id);
    for (const c of args.cards || []) {
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
    const pid = String(args.player_id);
    const HALF = 150; // ms per half-flip

    for (const c of args.cards || []) {
      const pos = parseInt(c.position, 10);
      const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (!cell) continue;

      const existing = cell.firstElementChild;
      if (existing) {
        existing.style.transition = `transform ${HALF}ms ease-in`;
        existing.style.transform = "scaleX(0)";
        await new Promise((r) => setTimeout(r, HALF));
      }

      this._placeCard(pid, pos, c);

      const fresh = cell.firstElementChild;
      if (fresh) {
        fresh.style.transform = "scaleX(0)";
        void fresh.offsetWidth; // force reflow so transition fires
        fresh.style.transition = `transform ${HALF}ms ease-out`;
        fresh.style.transform = "scaleX(1)";
        await new Promise((r) => setTimeout(r, HALF));
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
    const winnerId = args.winner_id !== null && args.winner_id !== undefined ? String(args.winner_id) : null;

    let leftCard, rightCard;

    if (args.solo_combat) {
      const botFlankSide = args.bot_side === "right" ? "left" : "right";
      const botCell = document.getElementById(`bc-flank-${botFlankSide}-${args.bot_row}`);
      leftCard = botCell?.firstElementChild;
      const rightPos = parseInt(args.right_position, 10);
      rightCard = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild;

      if (winnerId === "0" && rightCard) rightCard.classList.add("bc-card-loser");
      else if (winnerId !== "0" && winnerId !== null && leftCard) leftCard.classList.add("bc-card-loser");
    } else {
      const leftPid = String(args.left_player_id);
      const leftPos = parseInt(args.left_position, 10);
      const rightPos = parseInt(args.right_position, 10);
      leftCard = document.getElementById(`bc-cell-${leftPid}-${leftPos}`)?.firstElementChild;
      rightCard = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild;

      if (winnerId === leftPid && rightCard) rightCard.classList.add("bc-card-loser");
      else if (winnerId === rightPid && leftCard) leftCard.classList.add("bc-card-loser");
    }

    await new Promise((r) => setTimeout(r, 1200));
    leftCard?.classList.remove("bc-card-loser");
    rightCard?.classList.remove("bc-card-loser");
  }

  // Rage marker toggled (Brutes family)
  async notif_rageUpdated(args) {
    console.log(`[bc] Rage — Player ${args.player_id}: ${args.rage === 1 ? "Enraged" : "Calm"}`);
    // TODO Phase 7b: update rage marker icon in player board
  }

  // Token placed on a grid position
  async notif_tokenAdded(args) {
    console.log(`[bc] Token — Player ${args.player_id} pos ${args.grid_position}: ${args.token_type} val=${args.value}`);
    // TODO Phase 7b: show token element on grid cell
  }

  // All tokens cleared at start of Upgrade phase
  async notif_tokensCleared() {
    console.log("[bc] Tokens cleared");
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
        cardEl.className = "bc-card bc-card-hidden";
        cardEl.textContent = "▪";
      }
    }
    console.log(`[bc] Upgrade — Player ${args.player_id}: ${args.produced_count} produced, ${args.upgraded_count} upgraded`);
  }

  // Turn counter incremented (sent by CheckTurn when turn < 3)
  async notif_turnUpdated(args) {
    const el = document.getElementById("bc-turn-counter");
    if (el) el.textContent = args.turn_number;
    this._currentTurn = args.turn_number;
  }

  // New round started: update counters + move first-player marker
  async notif_roundStarted(args) {
    const roundEl = document.getElementById("bc-round-counter");
    if (roundEl) roundEl.textContent = args.round_number;
    const turnEl = document.getElementById("bc-turn-counter");
    if (turnEl) turnEl.textContent = args.turn_number;

    document.querySelectorAll(".bc-first-player-marker").forEach((el) => el.style.setProperty("display", "none"));
    const fpEl = document.getElementById(`bc-fp-${args.first_player_id}`);
    if (fpEl) fpEl.style.removeProperty("display");
  }

  // All grid cards returned to deck at start of new round
  async notif_deckShuffled(args) {
    const pid = String(args.player_id);
    for (let pos = 0; pos < 9; pos++) {
      const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (cell) cell.innerHTML = "";
    }
    // Clear matching flank cells when an opponent's grid is reset
    for (let row = 0; row < 3; row++) {
      if (pid === this._prevOppPid) {
        const flank = document.getElementById(`bc-flank-left-${row}`);
        if (flank) flank.innerHTML = "";
      }
      if (pid === this._nextOppPid) {
        const flank = document.getElementById(`bc-flank-right-${row}`);
        if (flank) flank.innerHTML = "";
      }
    }
  }

  // Solo: bot placed 6 cards face-down at start of round
  async notif_botCardsDeployed(args) {
    for (const side of ["left", "right"]) {
      const count = side === "left" ? (args.left_count ?? 3) : (args.right_count ?? 3);
      const flankSide = side === "right" ? "left" : "right";
      for (let row = 0; row < 3; row++) {
        const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
        if (flank) {
          flank.innerHTML = row < count ? '<div class="bc-card bc-card-hidden">▪</div>' : "";
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
    const el = document.getElementById("bc-bot-score-value");
    if (el) el.textContent = args.score;
  }

  // Solo: bot rage marker toggled
  async notif_botRageUpdated(args) {
    console.log(`[bc] Bot rage: ${args.rage === 1 ? "Enraged" : "Calm"}`);
  }

  // Solo: bot upgraded its deck — clear bot columns
  async notif_botUpgraded() {
    for (let row = 0; row < 3; row++) {
      const left = document.getElementById(`bc-flank-left-${row}`);
      if (left) left.innerHTML = "";
      const right = document.getElementById(`bc-flank-right-${row}`);
      if (right) right.innerHTML = "";
    }
  }

  // Silver draft: another player picked their card (no card details — choices are private)
  async notif_silverDraftPicked(args) {
    console.log(`[bc] Draft pass ${args.draft_round}/2 — ${args.player_name} picks`);
  }

  // Private: current player kept this Silver card (deck fan already updated client-side in _confirm)
  async notif_silverCardKept(args) {
    console.log(`[bc] Kept Silver card #${args.card.id}`);
  }

  // Private: remaining draft cards from the previous pass are now arriving.
  // Animate locked hand cards sliding off to the left before the state re-enters.
  async notif_silverCardsReceived(args) {
    const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (handArea) {
      const remaining = Array.from(handArea.querySelectorAll(".bc-draft-card"));
      if (remaining.length > 0) {
        remaining.forEach((el, i) => {
          el.style.transition = `transform 0.3s ${i * 60}ms ease-in, opacity 0.3s ${i * 60}ms ease-in`;
          el.style.transform = "translateX(-140px)";
          el.style.opacity = "0";
        });
        await new Promise((r) => setTimeout(r, 350 + remaining.length * 60));
        remaining.forEach((el) => el.remove());
      }
    }
    console.log(`[bc] Received ${args.cards?.length ?? 0} cards for next draft pass`);
  }

  // Private: the last unchosen card from pass 2 was auto-added to this player's deck
  async notif_silverLastCardReceived(args) {
    console.log(`[bc] Received last Silver card #${args.card.id}`);
  }

  // Silver draft complete: animate deck shuffle if fan still visible, then clean up
  async notif_silverDraftComplete() {
    const fanEl = document.getElementById(`bc-draft-fan-${this._myPid}`);
    if (fanEl) {
      const cards = Array.from(fanEl.querySelectorAll(".bc-card"));
      cards.forEach((card, i) => {
        card.style.transition = `transform 0.15s ${i * 30}ms ease-in-out`;
        card.style.transform = `translateX(${i % 2 === 0 ? 8 : -8}px)`;
      });
      await new Promise((r) => setTimeout(r, 200 + cards.length * 30));
      cards.forEach((card, i) => {
        card.style.transition = `transform 0.15s ${i * 30}ms ease-out`;
        card.style.transform = "none";
      });
      await new Promise((r) => setTimeout(r, 200 + cards.length * 30));
    }
    document.getElementById("bc-draft-ui")?.remove();
    console.log("[bc] Silver draft complete — decks shuffled");
  }

  // Private: hand dealt at Deploy state entry (sent per player from onEnteringState).
  // This is the reliable path for hand data when BGA SDK doesn't forward private getArgs.
  async notif_handDealt(args) {
    this.deploy._buildHand(args.hand || [], args.deck_count || 0, args.gems_charged || 0);
  }

  // Private: new card drawn after mulligan (sent only to the active player)
  async notif_mulliganCard(args) {
    const discardedId = args.discarded_card_id;
    const discardedEl = document.getElementById(`bc-hcard-${discardedId}`);
    if (discardedEl) {
      // Free the deploy slot and reverse map
      const assignedSlot = this.deploy._cardSlot[discardedId];
      if (assignedSlot) {
        this.deploy._slots[assignedSlot] = null;
        delete this.deploy._cardSlot[discardedId];
        this.deploy._updateSlotDisplay();
      }
      // If this card was selected, clear selection and slot buttons
      if (this.deploy._selectedCard === discardedId) {
        this.deploy._selectedCard = null;
        this.deploy._hideSlotButtons();
      }
      discardedEl.remove();
    }

    const c = args.new_card;
    if (c && this.deploy._myPid) {
      const container = document.getElementById(`bc-hand-area-${this.deploy._myPid}`);
      if (container) {
        const pos = this._spritePos(c.type, c.type_arg, c.family);
        container.insertAdjacentHTML(
          "beforeend",
          `
          <div class="bc-card bc-hand-card bc-card-sprite bc-card-rank-${c.type}"
               id="bc-hcard-${c.id}" data-card-id="${c.id}"
               style="background-position:${pos.x}px ${pos.y}px"></div>
        `,
        );
        const newEl = document.getElementById(`bc-hcard-${c.id}`);
        if (newEl) newEl.addEventListener("click", (e) => this.deploy._onCardClick(e));
      }
    }
  }
}
