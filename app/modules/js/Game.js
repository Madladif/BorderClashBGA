/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * borderclash implementation : © Merle Editions
 */

const BgaAnimations = await importEsmLib("bga-animations", "1.x");
const BgaCards = await importEsmLib("bga-cards", "1.x");

// ---------------------------------------------------------------------------
// SilverDraft state — MULTIPLE_ACTIVE_PLAYER (state 5)
// Players pick 1 Silver card to keep; the rest pass left. Runs twice (2 passes).
// ---------------------------------------------------------------------------

class SilverDraft {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._pid = null;
    this._selected = null; // selected card ID (integer)
    this._selectedEl = null; // direct DOM reference to the highlighted card element
    this._pendingCards = null; // cards received via silverCardsReceived, used as fallback for pass 2
    this._draftFanStock = null; // LineStock for the fan — persists between passes
  }

  onEnteringState(args, isCurrentPlayerActive) {
    console.log("gamedatas", this.game.gamedatas);
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      document.getElementById("btn-bc-draft-confirm")?.remove();
      document.getElementById("bc-draft-ui")?.remove();
      this.bga.statusBar.setTitle(_("${actplayer} is picking a Silver card…"));
      return;
    }
    this._teardown();
    // Priority: args.draft_cards (live) → _pendingCards (from silverCardsReceived, pass 2)
    // → gamedatas.draft_cards (page-load snapshot, correct only for pass 1).
    const draftCards = args.draft_cards?.length > 0 ? args.draft_cards : this._pendingCards !== null ? this._pendingCards : this.game.gamedatas?.draft_cards || [];
    this._pendingCards = null;
    const deckCards = args.deck_cards || this.game.gamedatas?.deck_cards || [];
    this._build(draftCards, deckCards, args.draft_round || 1);
  }

  onLeavingState() {
    // Fan zone intentionally NOT removed here — persists between draft passes.
    // Destroyed in notif_silverDraftComplete once the full draft is over.
    this._teardown(); // clears _selected/_selectedEl, removes handlers — must run before _pid is cleared
    this._pid = null;
  }

  _teardown() {
    document.getElementById("bc-draft-ui")?.remove();
    document.getElementById("btn-bc-draft-confirm")?.remove();
    if (this._pid) {
      const handStock = this.game._handStocks[this._pid];
      if (handStock) {
        for (const card of handStock.getCards()) {
          const el = this.game.cardManager.getCardElement(card);
          if (el?._bcDraftClick) {
            el.removeEventListener("click", el._bcDraftClick);
            delete el._bcDraftClick;
          }
        }
        handStock.removeAll();
      }
    }
    this._selected = null;
    this._selectedEl = null;
  }

  async _build(draftCards, deckCards, draftRound) {
    this._pid = this.game._currentPlayerPid();
    this._selected = null;

    const handStock = this.game._handStocks[this._pid];
    if (handStock) {
      await handStock.removeAll(); // clear any leftovers

      const cardObjs = draftCards.map((c) => ({
        id: parseInt(String(c.id), 10),
        type: c.type,
        type_arg: c.type_arg,
        family: c.family,
      }));
      await handStock.addCards(cardObjs);

      // Slide cards in from the right (cards are in DOM, now animate entry)
      // Keep id alongside el so dataset.cardId comes from the card object, not el.id parsing.
      const cardElPairs = cardObjs.map((c) => ({ id: parseInt(String(c.id), 10), el: this.game.cardManager.getCardElement(c) })).filter(({ el }) => el);
      const els = cardElPairs.map(({ el }) => el);
      els.forEach((el) => {
        el.classList.add("bc-draft-card");
        el.style.transform = "translateX(80px)";
        el.style.opacity = "0";
      });
      void document.body.offsetWidth; // force reflow
      els.forEach((el, i) => {
        el.style.transition = `transform 0.3s ${i * 80}ms ease-out, opacity 0.3s ${i * 80}ms ease-out`;
        el.style.transform = "";
        el.style.opacity = "";
      });

      // Direct per-element listeners — dataset.cardId set from card object (never from el.id).
      cardElPairs.forEach(({ id, el }) => {
        el.dataset.cardId = String(id);
        if (el._bcDraftClick) {
          el.removeEventListener("click", el._bcDraftClick);
        }
        el._bcDraftClick = () => this._onCardClick(el);
        el.addEventListener("click", el._bcDraftClick);
      });
    }

    // Deck fan: created once for pass 1; pass 2 reuses the same stock.
    if (!this._draftFanStock) {
      const playerBoard = document.querySelector(`.bc-player-board[data-player-id="${this._pid}"]`);
      if (playerBoard) {
        playerBoard.insertAdjacentHTML(
          "beforeend",
          `
          <div id="bc-draft-deck-${this._pid}" class="bc-draft-deck-area">
            <div class="bc-draft-deck-label">${_("Deck")} (${deckCards.length})</div>
            <div class="bc-draft-deck-fan" id="bc-draft-fan-${this._pid}"></div>
          </div>
        `,
        );
        const fanEl = document.getElementById(`bc-draft-fan-${this._pid}`);
        this._draftFanStock = new BgaCards.LineStock(this.game.cardManager, fanEl, {
          direction: "column",
          gap: "0",
        });
        const deckCardObjs = deckCards.map((c) => ({
          id: parseInt(String(c.id), 10),
          type: c.type,
          type_arg: c.type_arg,
          family: c.family,
        }));
        if (deckCardObjs.length > 0) {
          await this._draftFanStock.addCards(deckCardObjs);
        }
        this._updateFanLabel();
      }
    }

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

  _onCardClick(cardEl) {
    const cardId = parseInt(cardEl.dataset.cardId, 10); // integer

    if (this._selectedEl === cardEl) {
      cardEl.classList.remove("bc-card-selected");
      this._selectedEl = null;
      this._selected = null;
      document.getElementById("btn-bc-draft-confirm")?.remove();
    } else {
      if (this._selectedEl) {
        this._selectedEl.classList.remove("bc-card-selected");
      }
      cardEl.classList.add("bc-card-selected");
      this._selectedEl = cardEl;
      this._selected = cardId;
      if (!document.getElementById("btn-bc-draft-confirm")) {
        this.bga.statusBar.addActionButton(_("Keep this card"), () => this._confirm(), { id: "btn-bc-draft-confirm" });
      }
    }
  }

  async _confirm() {
    if (!Number.isInteger(this._selected)) return;
    const keptCardId = this._selected; // integer
    const handStock = this.game._handStocks[this._pid];
    const keptCard = handStock?.getCards().find((c) => parseInt(String(c.id), 10) === keptCardId);

    handStock?.getCards().forEach((card) => {
      const el = this.game.cardManager.getCardElement(card);
      if (el) el.style.pointerEvents = "none";
    });
    document.getElementById("btn-bc-draft-confirm")?.remove();
    this.bga.statusBar.setTitle(_("Waiting for other players…"));

    if (keptCard && this._draftFanStock) {
      await this._draftFanStock.addCard(keptCard, { fromStock: handStock });
      this.game.cardManager.getCardElement(keptCard)?.classList.remove("bc-draft-card", "bc-card-selected");
      this._updateFanLabel();
    }

    this.bga.actions.performAction("actPickSilver", { keptCardId });
  }

  _updateFanLabel() {
    const count = this._draftFanStock?.getCards().length ?? 0;
    const labelEl = document.querySelector(`#bc-draft-deck-${this._pid} .bc-draft-deck-label`);
    if (labelEl) labelEl.textContent = `${_("Deck")} (${count})`;
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
    this._slots = { col1: null, col2: null, col3: null };
    this._cardSlot = {};
    this._selectedCard = null;
    this._mulliganMode = false;
    this._myPid = null;
    this._handBuildSeq = 0;
  }

  onEnteringState(args, isActive) {
    console.log("gamedatas", this.game.gamedatas);

    // MULTIPLE_ACTIVE_PLAYER: BGA calls onPlayerActivationChange separately after this.
    // Do NOT delegate here — it would cause double-initialisation and concurrent _buildHand calls.
  }

  async onPlayerActivationChange(args, isCurrentPlayerActive) {
    await this._teardown();

    // Sync all grid cards from gamedatas — idempotent (skips slots already occupied).
    // Handles F5 reload when setup() may have used wrong field name (card.card_id bug).
    // Previous-turn rows: face-up (PHP sends type). Current-turn opponent rows: face-down (type=null).
    // Active player's own current-turn cards are in hand (not yet deployed), so nothing to restore.
    for (const card of this.game.gamedatas.grid_cards || []) {
      const pidStr = card.card_location.replace("grid_", "");
      const gridStock = this.game._gridStocks[pidStr];
      if (!gridStock) continue;
      const pos = parseInt(String(card.position), 10);
      if (gridStock.getCards().some((c) => c.position === pos)) continue; // already present
      gridStock.addCard({
        id: parseInt(String(card.id), 10),
        type: card.type || null,
        type_arg: card.type_arg || null,
        family: card.family || null,
        position: pos,
      });
      this.game._updateFlankMirror(pidStr, pos, card);
    }

    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("Waiting for other players to deploy…"));
      return;
    }
    this._slots = { col1: null, col2: null, col3: null };
    this._cardSlot = {};
    this._selectedCard = null;
    this._mulliganMode = false;
    this._build();
    if (args.hand?.length > 0) {
      // BGA SDK forwarded private args — use them directly.
      await this._buildHand(args.hand, args.deck_count ?? 0, args.gems_charged ?? 0);
    } else if (!this._handDealtThisSession) {
      // F5 reload: onEnteringState (server) does not re-fire, so notif_handDealt never arrives.
      // gamedatas.hand is freshly queried by getAllDatas() on every page load, so it is correct.
      // _handDealtThisSession is set to true the first time notif_handDealt fires in this session,
      // after which gamedatas.hand may be stale (page loaded at an earlier turn) and is not used.
      const hand = this.game.gamedatas.hand || [];
      const pid = this._myPid;
      const deckCount = (this.game.gamedatas.deck_cards || []).length;
      const gemsCharged = parseInt(this.game.gamedatas.players?.[pid]?.gems_charged ?? "0", 10);
      if (hand.length > 0) {
        await this._buildHand(hand, deckCount, gemsCharged);
      }
    }
    // else: _handDealtThisSession is true → mid-session turn transition,
    // notif_handDealt will arrive shortly with fresh data.
  }

  onLeavingState() {
    this._teardown();
    if (this._myPid) {
      document.getElementById(`bc-deck-pile-${this._myPid}`)?.remove();
      this._myPid = null;
    }
  }

  async _teardown() {
    // Remove interactive UI only. Deck pile and hand stock are left intact so that
    // notif_cardsDeployed can animate cards from hand to grid before they disappear.
    document.getElementById("bc-deploy-ui")?.remove();
    document.getElementById("btn-bc-deploy")?.remove();
    document.getElementById("btn-bc-mulligan")?.remove();
    document.getElementById("btn-bc-cancel")?.remove();
    for (const slot of ["col1", "col2", "col3"]) {
      document.getElementById(`btn-bc-slot-${slot}`)?.remove();
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
  // Called from both onPlayerActivationChange and notif_handDealt. The sequence
  // counter ensures the second concurrent call aborts after removeAll() so the
  // last caller wins without double-animation or duplicate click handlers.
  async _buildHand(hand, deckCount, gemsCharged) {
    console.log("const handStock = this.game._handStocks[this._myPid];", this.game._handStocks[this._myPid]);
    if (!this._myPid) return;

    const handStock = this.game._handStocks[this._myPid];
    if (!handStock) return;

    const seq = ++this._handBuildSeq;

    await handStock.removeAll();
    if (seq !== this._handBuildSeq) return; // a newer call started; abort

    // Deck pile: a non-card element prepended before the stock's cards
    document.getElementById(`bc-deck-pile-${this._myPid}`)?.remove();
    const handArea = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (deckCount > 0 && handArea) {
      handArea.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="bc-deck-pile" id="bc-deck-pile-${this._myPid}">
          <div class="bc-card bc-card-hidden">▪</div>
          <span class="bc-deck-count-badge">${deckCount}</span>
        </div>
      `,
      );
    }

    const cardObjs = hand.map((c) => ({
      id: parseInt(String(c.id), 10),
      type: c.type,
      type_arg: c.type_arg,
      family: c.family,
    }));
    const deckPileEl = document.getElementById(`bc-deck-pile-${this._myPid}`);
    await handStock.addCards(cardObjs, deckPileEl ? { fromElement: deckPileEl } : undefined);
    if (seq !== this._handBuildSeq) return; // aborted by a newer call

    for (const cardObj of cardObjs) {
      const el = this.game.cardManager.getCardElement(cardObj);
      if (el) {
        el.classList.add("bc-hand-card");
        el.dataset.cardId = String(cardObj.id);
        el.onclick = (e) => this._onCardClick(e); // onclick prevents duplicate listeners
      }
    }

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

    if (this._selectedCard === cardId) {
      this._selectedCard = null;
      cardEl.classList.remove("bc-card-selected");
      this._hideSlotButtons();
      return;
    }

    if (this._selectedCard !== null) {
      this.game.cardManager.getCardElement({ id: this._selectedCard })?.classList.remove("bc-card-selected");
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
      this.bga.statusBar.addActionButton(label, () => this._assignSlot(slot, cardId), {
        id: `btn-bc-slot-${slot}`,
      });
    }
  }

  _hideSlotButtons() {
    for (const slot of ["col1", "col2", "col3"]) {
      document.getElementById(`btn-bc-slot-${slot}`)?.remove();
    }
    document.getElementById("btn-bc-deploy")?.remove();
  }

  _assignSlot(slot, cardId) {
    // Displace any card currently in this slot
    const displaced = this._slots[slot];
    if (displaced !== null && displaced !== undefined && displaced !== cardId) {
      this._returnCardToHand(displaced, slot);
    }

    const pos = this._slotToGridPos(slot);
    const handStock = this.game._handStocks[this._myPid];
    const gridStock = this.game._gridStocks[this._myPid];
    const card = handStock?.getCards().find((c) => c.id === cardId);

    if (card && gridStock) {
      gridStock.addCard({ ...card, position: pos }, { fromStock: handStock });
    }

    this.game.cardManager.getCardElement({ id: cardId })?.classList.remove("bc-card-selected");

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

  // Return a card from grid slot back to hand — animated via addCard/fromStock.
  _returnCardToHand(cardId, slot) {
    this._slots[slot] = null;
    delete this._cardSlot[cardId];

    const gridStock = this.game._gridStocks[this._myPid];
    const handStock = this.game._handStocks[this._myPid];
    const card = gridStock?.getCards().find((c) => c.id === cardId);
    if (card && handStock) {
      handStock.addCard(card, { fromStock: gridStock });
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

    // CardManager — unified card element factory, tracking, and flip animations.
    // getId produces 'bc-card-{id}' for all cards (hand, grid, fan).
    // isCardVisible drives initial face (false = back, true = front).
    this.cardManager = new BgaCards.Manager({
      animationManager: this.animationManager,
      getId: (card) => `bc-card-${card.id}`,
      isCardVisible: (card) => !!card.type,
      setupDiv: (card, element) => {
        element.classList.add("bc-card");
      },
      setupFrontDiv: (card, element) => {
        if (!card.type) return;
        const pos = this._spritePos(card.type, card.type_arg, card.family);
        element.classList.add("bc-card-sprite", `bc-card-rank-${card.type}`);
        element.style.backgroundPosition = `${pos.x}px ${pos.y}px`;
      },
      setupBackDiv: (card, element) => {
        element.classList.add("bc-card-hidden");
        element.textContent = "▪";
      },
      cardWidth: 167,
      cardHeight: 119,
    });

    // current_player_id (from PHP getAllDatas) is authoritative for the viewer's player ID.
    // Falls back to bga.player_id for forward-compatibility, then to the first known player.
    const allPids = Object.keys(gamedatas.players ?? {});
    const cid = String(gamedatas.current_player_id ?? this.bga.player_id ?? "");
    this._myPid = allPids.includes(cid) ? cid : (allPids[0] ?? "");
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

    // Current player first, then opponents in play order
    const rawOrder = Array.isArray(gamedatas.player_order) && gamedatas.player_order.length ? gamedatas.player_order.map(String) : Object.keys(gamedatas.players);
    const myPid = this._myPid;
    const myIndexInRaw = rawOrder.indexOf(myPid);
    const n = rawOrder.length;
    const orderedOpps = [];
    for (let i = 1; i < n; i++) orderedOpps.push(rawOrder[(myIndexInRaw + i) % n]);
    const playerOrder = [myPid, ...orderedOpps];

    this._prevOppPid = n >= 2 ? rawOrder[(myIndexInRaw - 1 + n) % n] : null;
    this._nextOppPid = n >= 2 ? rawOrder[(myIndexInRaw + 1) % n] : null;

    for (const pidStr of playerOrder) {
      const player = gamedatas.players[pidStr];
      if (!player) continue;
      const isMe = pidStr === myPid;

      let gridHtml;
      if (isMe) {
        const prevName = this._prevOppPid ? gamedatas.players[this._prevOppPid]?.name || "?" : _("Bot");
        const nextName = this._nextOppPid ? gamedatas.players[this._nextOppPid]?.name || "?" : _("Bot");
        let leftFlankHtml = "",
          rightFlankHtml = "";
        for (const row of [2, 1, 0]) {
          leftFlankHtml += `<div class="bc-flank-cell" id="bc-flank-left-${row}"></div>`;
          rightFlankHtml += `<div class="bc-flank-cell" id="bc-flank-right-${row}"></div>`;
        }
        gridHtml = `
          <div class="bc-grid-with-flanks">
            <div class="bc-flank-col">
              <div class="bc-flank-label">← ${prevName}</div>
              ${leftFlankHtml}
            </div>
            <div class="bc-grid" id="bc-grid-${pidStr}"></div>
            <div class="bc-flank-col">
              <div class="bc-flank-label">${nextName} →</div>
              ${rightFlankHtml}
            </div>
          </div>`;
      } else {
        gridHtml = `<div class="bc-grid" id="bc-grid-${pidStr}"></div>`;
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

    // Create per-player stocks now that DOM is ready.
    // HandStock (LineStock): shared between SilverDraft and Deploy.
    // GridStock (SlotStock): 9 slots keyed by card.position (0–8); uses slot-{pos} classes.
    this._handStocks = {};
    this._gridStocks = {};
    for (const pidStr of playerOrder) {
      const handEl = document.getElementById(`bc-hand-area-${pidStr}`);
      if (handEl) {
        this._handStocks[pidStr] = new BgaCards.LineStock(this.cardManager, handEl, {
          direction: "row",
          gap: "8px",
        });
      }
      const gridEl = document.getElementById(`bc-grid-${pidStr}`);
      if (gridEl) {
        this._gridStocks[pidStr] = new BgaCards.SlotStock(this.cardManager, gridEl, {
          slotsIds: ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
          mapCardToSlot: (card) => String(card.position),
          slotClasses: ["bc-cell"],
        });
        // Grid layout is handled by CSS grid-template-areas in borderclash.css.
        // We only need to assign IDs so other JS can query cells by bc-cell-{pid}-{pos}.
        // BgaCards creates slot divs asynchronously, so use MutationObserver.
        const assignSlotIds = () => {
          let count = 0;
          for (let pos = 0; pos < 9; pos++) {
            const slotEl = gridEl.querySelector(`.slot-${pos}`);
            if (slotEl) {
              slotEl.id = `bc-cell-${pidStr}-${pos}`;
              count++;
            }
          }
          return count;
        };
        if (assignSlotIds() < 9) {
          const obs = new MutationObserver(() => {
            if (assignSlotIds() === 9) obs.disconnect();
          });
          obs.observe(gridEl, { childList: true });
        }
      }
    }

    // Show first-player marker
    const fpEl = document.getElementById(`bc-fp-${playerOrder[0]}`);
    if (fpEl) fpEl.style.removeProperty("display");

    // Solo mode: bot cards fill the flank columns
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

    // Restore grid cards from page-load snapshot (mid-game reload)
    for (const card of gamedatas.grid_cards || []) {
      const pidStr = card.card_location.replace("grid_", "");
      const pos = parseInt(card.position, 10);
      const cardObj = {
        id: parseInt(String(card.id), 10), // PHP aliases card_id AS id
        type: card.type || null,
        type_arg: card.type_arg || null,
        family: card.family || null,
        position: pos,
      };
      this._gridStocks[pidStr]?.addCard(cardObj);
      this._updateFlankMirror(pidStr, pos, card);
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

  _cardName(type, typeArg) {
    const t = parseInt(type, 10),
      a = parseInt(typeArg, 10);
    const NAMES = {
      "1:1": "Amateur",
      "1:2": "Parieur",
      "1:3": "Troll",
      "1:4": "Gros-bras",
      "1:5": "Mousse",
      "1:6": "Quartier-Maître",
      "2:1": "Bookmaker",
      "2:2": "Croupier",
      "2:3": "Pièce",
      "2:4": "Tricheur",
      "2:5": "Mécène",
      "2:6": "Complice",
      "2:7": "Mercenaire",
      "2:8": "Grizzly",
      "2:9": "Videur",
      "2:10": "Berserker",
      "2:11": "Loup-Garou",
      "2:12": "Barbare",
      "2:13": "Pillard",
      "2:14": "Second",
      "2:15": "Boucanier",
      "2:16": "Artificier",
      "2:17": "Vigie",
      "2:18": "Navigateur",
      "3:1": "Jack Jackpot",
      "3:2": "Poker Face",
      "3:3": "Double 6",
      "3:4": "Brunhilde",
      "3:5": "Goliath",
      "3:6": "Shockfang",
      "3:7": "Hollandais Volant",
      "3:8": "Lady Fortune",
      "3:9": "Davy Jones",
    };
    return NAMES[`${t}:${a}`] || `${this._rankName(t)} #${a}`;
  }

  _influenceEffectDesc(effectType, diceRoll) {
    const EFFECTS = {
      "1:1": (d) => `🎲 ${d} → jeton ±1 sur pos. suivante`,
      "1:2": () => `Trait commun → 1 gemme chargée`,
      "1:3": (d, r) => `Rage${r ? " (enragé +2)" : ""} → bascule`,
      "1:4": () => `Force max colonne → 1 gemme chargée`,
      "1:5": () => `Frontière → retourne face cachée, +2 gemmes`,
      "1:6": () => `Jeton Or Pirate ici`,
      "2:1": (d) => `🎲 ${d} → jeton ±2/+4 pos. suivante`,
      "2:2": () => `+1 force par carte Impact`,
      "2:3": (d) => `🎲 ${d} → jeton ±3 ici`,
      "2:4": () => `+1 gemme chargée, +2 force/gemme`,
      "2:5": () => `Collecte tous les jetons Flambeur de la colonne`,
      "2:6": (d) => `🎲 ${d} → +${d} force`,
      "2:7": () => `Mercenaire : enragé → +3 force, sinon bascule`,
      "2:8": () => `Grizzly : -1 gemme → +5 force, bascule rage`,
      "2:9": () => `Videur : rival force > 2 → +4, bascule rage`,
      "2:10": () => `Berserker : calme → force rival`,
      "2:11": () => `Loup-Garou : enragé → +2 VP, bascule`,
      "2:12": () => `Barbare : enragé → +1 force/Impact`,
      "2:13": () => `Pillard : Gold en jeu → +2 gemmes chargées`,
      "2:14": () => `Second : +3 force/Gold colonne`,
      "2:15": () => `Boucanier : pas de Bronze → +3 force`,
      "2:16": () => `Artificier : pos. préc. Gold → force imprimée`,
      "2:17": () => `Vigie : rival Gold → +4 force`,
      "2:18": () => `Navigateur : 2 jetons Or Pirate`,
      "3:1": (d) => `🎲 ${d} → ${d <= 2 ? "jeton −4" : d <= 4 ? "+3 gemmes" : "jeton +8"}`,
      "3:2": () => `Poker Face : collecte tous les jetons Flambeur`,
      "3:3": () => `Double 6 : après combat, tirage VP bonus`,
      "3:4": () => `Brunhilde : enragé → force colonne, bascule`,
      "3:5": () => `Goliath : enragé → décharge tout, +3/gemme`,
      "3:6": () => `Shockfang : enragé → +8 force, bascule`,
      "3:7": () => `Hollandais Volant : retourne Gold → +4 force`,
      "3:8": () => `Lady Fortune : +2 VP/Gold en jeu`,
      "3:9": () => `Davy Jones : +2/Gold −1/Bronze`,
    };
    const fn = EFFECTS[effectType];
    return fn ? fn(diceRoll) : effectType;
  }

  // Returns the CSS background-position (in display px) for a face-up card.
  // Sprite sheet: cards_scoundrels.png — 12 cols × 3 rows, background-size 2004×357.
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

  // Flat card HTML for flank mirror cells and deck pile (no CardManager tracking).
  // Face-down: standalone div needs explicit flex centering (no inner .card-side).
  _cardHtml(card) {
    if (!card || !card.type) {
      return `<div class="bc-card bc-card-hidden">▪</div>`;
    }
    const pos = this._spritePos(card.type, card.type_arg, card.family);
    return `<div class="bc-card bc-card-sprite bc-card-rank-${card.type}"
                 style="background-position:${pos.x}px ${pos.y}px"></div>`;
  }

  // Update the current player's flank mirror cells when an opponent border card changes.
  // Flank cells are plain innerHTML (no CardManager tracking needed).
  _updateFlankMirror(pidStr, pos, card) {
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
    const flankSide = side === "right" ? "left" : "right";
    const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
    if (!flank) return;
    flank.innerHTML = this._cardHtml(card);
  }

  // ---- Notification handlers (auto-registered by setupPromiseNotifications) ----

  // Three face-down cards placed in the grid by a player.
  // Own cards were already moved to gridStock by _assignSlot — flip them face-down.
  // Opponent cards are new — add them as face-down directly.
  async notif_cardsDeployed(args) {
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    for (const c of args.cards || []) {
      const pos = parseInt(c.position, 10);
      const existing = gridStock?.getCards().find((card) => card.id === c.id);
      if (existing) {
        this.cardManager.setCardVisible(existing, false);
      } else {
        await gridStock?.addCard({ id: c.id, type: null, position: pos });
      }
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

  // Current-row cards flipped face-up — 3D card flip via bga-cards setCardVisible
  async notif_cardsRevealed(args) {
    const pid = String(args.player_id);
    for (const c of args.cards || []) {
      const pos = parseInt(c.position, 10);
      const cardObj = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family, position: pos };
      this.cardManager.setCardVisible(cardObj, true); // void — CSS flip, updates front face
      this._updateFlankMirror(pid, pos, c);
    }
    if (args.cards?.length > 0) await new Promise((r) => setTimeout(r, 550));
  }

  // Center card effect applied during Influence phase
  async notif_influenceResolved(args) {
    const pid = String(args.player_id);
    const centerPos = ((this._currentTurn || 1) - 1) * 3 + 1;
    const centerCell = document.getElementById(`bc-cell-${pid}-${centerPos}`);
    if (!centerCell) return;

    const [rankStr, designStr] = (args.effect_type || "").split(":");
    const name = this._cardName(rankStr, designStr);
    const desc = this._influenceEffectDesc(args.effect_type, args.dice_roll);

    const badge = document.createElement("div");
    badge.className = "bc-effect-badge";
    badge.innerHTML = `<strong>${name}</strong><br>${desc}`;
    centerCell.appendChild(badge);

    await new Promise((r) => setTimeout(r, 2200));
    badge.remove();

    console.log(`[bc] Influence — Player ${pid}: ${name} (${desc})`);
  }

  // One combat result — show strength popups on border cards, fade the loser
  async notif_combatResolved(args) {
    const rightPid = String(args.right_player_id);
    const lStr = args.left_strength ?? 0;
    const rStr = args.right_strength ?? 0;

    let leftCardEl, rightCardEl;

    if (args.solo_combat) {
      const botFlankSide = args.bot_side === "right" ? "left" : "right";
      const botCell = document.getElementById(`bc-flank-${botFlankSide}-${args.bot_row}`);
      leftCardEl = botCell?.firstElementChild ?? null;
      const rightPos = parseInt(args.right_position, 10);
      rightCardEl = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild ?? null;
    } else {
      const leftPid = String(args.left_player_id);
      const leftPos = parseInt(args.left_position, 10);
      const rightPos = parseInt(args.right_position, 10);
      leftCardEl = document.getElementById(`bc-cell-${leftPid}-${leftPos}`)?.firstElementChild ?? null;
      rightCardEl = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild ?? null;
    }

    const addStrBadge = (cardEl, strength, won) => {
      if (!cardEl) return null;
      const badge = document.createElement("div");
      badge.className = `bc-combat-badge ${won ? "bc-combat-winner" : won === false ? "bc-combat-loser" : ""}`;
      badge.textContent = `⚔ ${strength}`;
      cardEl.parentElement?.appendChild(badge);
      return badge;
    };

    const tie = lStr === rStr;
    const leftWon = !tie && lStr > rStr;
    const rightWon = !tie && rStr > lStr;

    const lBadge = addStrBadge(leftCardEl, lStr, tie ? null : leftWon);
    const rBadge = addStrBadge(rightCardEl, rStr, tie ? null : rightWon);

    if (!tie) {
      if (rightWon && leftCardEl) leftCardEl.classList.add("bc-card-loser");
      if (leftWon && rightCardEl) rightCardEl.classList.add("bc-card-loser");
    }

    await new Promise((r) => setTimeout(r, 2000));

    lBadge?.remove();
    rBadge?.remove();
    leftCardEl?.classList.remove("bc-card-loser");
    rightCardEl?.classList.remove("bc-card-loser");
  }

  async notif_rageUpdated(args) {
    console.log(`[bc] Rage — Player ${args.player_id}: ${args.rage === 1 ? "Enraged" : "Calm"}`);
    // TODO Phase 7b: update rage marker icon in player board
  }

  async notif_tokenAdded(args) {
    console.log(`[bc] Token — Player ${args.player_id} pos ${args.grid_position}: ${args.token_type} val=${args.value}`);
    // TODO Phase 7b: show token element on grid cell
  }

  async notif_tokensCleared() {
    console.log("[bc] Tokens cleared");
    // TODO Phase 7b: remove token elements from all cells
  }

  // Center cards flipped face-down after upgrade — smooth flip via setCardVisible
  async notif_upgradeConfirmed(args) {
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    for (const centerPos of [1, 4, 7]) {
      const card = gridStock?.getCards().find((c) => c.position === centerPos);
      if (card) this.cardManager.setCardVisible(card, false);
    }
    await new Promise((r) => setTimeout(r, 550));
    console.log(`[bc] Upgrade — Player ${args.player_id}: ${args.produced_count} produced, ${args.upgraded_count} upgraded`);
  }

  // Turn counter incremented
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

  // All grid cards returned to deck at start of new round — clear via SlotStock
  async notif_deckShuffled(args) {
    const pid = String(args.player_id);
    await this._gridStocks[pid]?.removeAll();

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

  // Solo: bot placed cards face-down at start of round
  async notif_botCardsDeployed(args) {
    for (const side of ["left", "right"]) {
      const count = side === "left" ? (args.left_count ?? 3) : (args.right_count ?? 3);
      const flankSide = side === "right" ? "left" : "right";
      for (let row = 0; row < 3; row++) {
        const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
        if (flank) {
          flank.innerHTML = row < count ? this._cardHtml(null) : "";
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

  // Private: current player kept this Silver card
  async notif_silverCardKept(args) {
    const c = args.card;
    const name = `${this._rankName(c.type)} ${this._familyName(c.family)} #${c.type_arg}`;
    this.bga.statusBar.setTitle(`${_("You kept:")} ${name}`);
    console.log(`[bc] Kept Silver card #${c.id}: ${name}`);
  }

  // Private: remaining draft cards from the previous pass are arriving.
  // Cache them for the state fallback, then animate remaining hand cards sliding left.
  async notif_silverCardsReceived(args) {
    this.silverDraft._pendingCards = args.cards || [];

    const handStock = this._handStocks[this._myPid];
    if (handStock) {
      const remaining = handStock.getCards();
      const els = remaining.map((c) => this.cardManager.getCardElement(c)).filter(Boolean);
      if (els.length > 0) {
        els.forEach((el, i) => {
          el.style.transition = `transform 0.3s ${i * 60}ms ease-in, opacity 0.3s ${i * 60}ms ease-in`;
          el.style.transform = "translateX(-140px)";
          el.style.opacity = "0";
        });
        await new Promise((r) => setTimeout(r, 350 + els.length * 60));
      }
      await handStock.removeAll();
    }
    console.log(`[bc] Received ${args.cards?.length ?? 0} cards for next draft pass`);
  }

  // Private: the last unchosen card from pass 2 was auto-added to this player's deck.
  // Move it into the fan so the shuffle animation in silverDraftComplete includes it.
  async notif_silverLastCardReceived(args) {
    const c = args.card;
    const cardObj = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family };
    const fanStock = this.silverDraft._draftFanStock;
    if (!fanStock) return;

    const handStock = this._handStocks[this._myPid];
    const inHand = handStock?.getCards().find((card) => card.id === c.id);
    if (inHand) {
      await fanStock.addCard(inHand, { fromStock: handStock });
      this.cardManager.getCardElement(inHand)?.classList.remove("bc-draft-card", "bc-card-selected");
    } else {
      // Multiplayer: card was in another player's hand — create it fresh in the fan
      await fanStock.addCard(cardObj);
    }
    this.silverDraft._updateFanLabel();
    console.log(`[bc] Last Silver card #${c.id} added to deck`);
  }

  // Silver draft complete: flip face-down → stack into pile → shuffle → fade out
  async notif_silverDraftComplete() {
    const fanStock = this.silverDraft._draftFanStock;
    if (fanStock) {
      const cards = fanStock.getCards();
      const els = cards.map((c) => this.cardManager.getCardElement(c)).filter(Boolean);

      if (els.length > 0) {
        // 1. Flip all face-down one by one (staggered by 100ms)
        cards.forEach((card, i) => {
          setTimeout(() => this.cardManager.setCardVisible(card, false), i * 100);
        });
        await new Promise((r) => setTimeout(r, 600 + cards.length * 100));

        // 2. Stack cards into a pile — each slides up to the first card's position
        const baseRect = els[0].getBoundingClientRect();
        els.slice(1).forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          const dy = baseRect.top - rect.top;
          el.style.transition = `transform 0.22s ${i * 40}ms ease-in`;
          el.style.transform = `translateY(${dy}px)`;
        });
        await new Promise((r) => setTimeout(r, 320 + (els.length - 1) * 40));

        // 3. Shuffle wobble — rotate the deck area container
        const deckArea = document.getElementById(`bc-draft-deck-${this._myPid}`);
        if (deckArea) {
          for (const [angle, dur] of [
            [6, 90],
            [-6, 90],
            [4, 80],
            [-4, 80],
            [0, 80],
          ]) {
            deckArea.style.transition = `transform ${dur}ms ease-in-out`;
            deckArea.style.transform = `rotate(${angle}deg)`;
            await new Promise((r) => setTimeout(r, dur + 15));
          }
          // 4. Fade out
          deckArea.style.transition = "opacity 0.35s ease";
          deckArea.style.transform = "";
          deckArea.style.opacity = "0";
          await new Promise((r) => setTimeout(r, 380));
        }
      }

      await fanStock.removeAll();
      this.silverDraft._draftFanStock = null;
    }
    document.getElementById("bc-draft-ui")?.remove();
    document.getElementById(`bc-draft-deck-${this._myPid}`)?.remove();
    console.log("[bc] Silver draft complete — decks shuffled");
  }

  // Private: hand dealt at Deploy state entry (sent per player from onEnteringState).
  // This is the reliable path when BGA SDK doesn't forward private getArgs.
  // Also handles the reload race: notification can arrive before onPlayerActivationChange
  // calls _build(), so we seed deploy._myPid from the game-level _myPid (always set in setup).
  async notif_handDealt(args) {
    if (!this.deploy._myPid) this.deploy._myPid = this._myPid;
    // Mark that at least one real turn transition has occurred in this JS session.
    // After this, gamedatas.hand is considered stale and the onPlayerActivationChange
    // fallback will skip it, waiting for subsequent notif_handDealt calls instead.
    this.deploy._handDealtThisSession = true;
    await this.deploy._buildHand(args.hand || [], args.deck_count || 0, args.gems_charged || 0);
  }

  // Private: new card drawn after mulligan (sent only to the active player)
  async notif_mulliganCard(args) {
    const discardedId = args.discarded_card_id;
    const handStock = this._handStocks[this.deploy._myPid];
    const discardedCard = handStock?.getCards().find((c) => c.id === discardedId);

    if (discardedCard) {
      const assignedSlot = this.deploy._cardSlot[discardedId];
      if (assignedSlot) {
        this.deploy._slots[assignedSlot] = null;
        delete this.deploy._cardSlot[discardedId];
        this.deploy._updateSlotDisplay();
      }
      if (this.deploy._selectedCard === discardedId) {
        this.deploy._selectedCard = null;
        this.deploy._hideSlotButtons();
      }
      await handStock.removeCard(discardedCard);
    }

    const c = args.new_card;
    if (c && handStock) {
      const newCard = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family };
      await handStock.addCard(newCard);
      const newEl = this.cardManager.getCardElement(newCard);
      if (newEl) {
        newEl.classList.add("bc-hand-card");
        newEl.dataset.cardId = String(newCard.id);
        newEl.onclick = (e) => this.deploy._onCardClick(e);
      }
    }
  }
}
