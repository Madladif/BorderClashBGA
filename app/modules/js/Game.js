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
    this._selected = null;
    this._selectedEl = null;
    this._draftFanStock = null;
    this._draftRound = 1;
    this._deckCards = [];
    this._buildSeq = 0;
    this._confirmedThisSession = false; // set when actPickSilver is confirmed mid-session
  }

  async onEnteringState(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) return;
    // Reliable fallback for pass 1: if the SDK didn't fire onPlayerActivationChange with
    // real args yet, seed _build() from gamedatas (page-load snapshot — valid for pass 1).
    // Guard: only use gamedatas if draft_round matches (avoids stale pass-1 data on pass 2).
    const gd = this.game.gamedatas;
    const gdRound = gd?.draft_round ?? 1;
    const draftCards = args?.draft_cards ?? (gdRound === 1 ? (gd?.draft_cards ?? []) : []);
    const deckCards = args?.deck_cards ?? (gdRound === 1 ? (gd?.deck_cards ?? []) : []);
    const draftRound = args?.draft_round ?? gdRound;

    if (draftCards.length > 0) {
      await this._build(draftCards, deckCards, draftRound);
    }
  }

  async onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      document.getElementById("btn-bc-draft-confirm")?.remove();
      document.getElementById("bc-draft-ui")?.remove();
      this.bga.statusBar.setTitle(_("Waiting for other players…"));
      // F5 after confirming pick: show remaining draft cards (read-only) + rebuild deck fan.
      // Skip if confirmed mid-session (hand and fan are already correct from _confirm()).

      if (!this._confirmedThisSession) {
        this._pid = this.game._currentPlayerPid();
        const waitingCards = (this.game.gamedatas.draft_cards ?? []).map((c) => ({
          id: parseInt(String(c.id), 10),
          type: c.type,
          type_arg: c.type_arg,
          family: c.family,
        }));
        const handStock = this.game._handStocks[this._pid];
        if (handStock && handStock.getCards().length === 0 && waitingCards.length > 0) {
          await handStock.addCards(waitingCards);
        }
        // Rebuild deck fan (includes the card just kept) if it was lost on reload.
        if (!this._draftFanStock) {
          const deckCards = (this.game.gamedatas.deck_cards ?? []).map((c) => ({
            id: parseInt(String(c.id), 10),
            type: c.type,
            type_arg: c.type_arg,
            family: c.family,
          }));
          if (deckCards.length > 0) {
            await this._buildDeckFan(deckCards);
          }
        }
      }
      return;
    }
    // Active player: only build if the SDK provided real args (not a gamedatas fallback).
    // gamedatas is a stale page-load snapshot — during pass 1→2, it still has pass-1 cards.
    // notif_draftCardsDealt is always sent and is the authoritative delivery path.
    const draftCards = args?.draft_cards ?? [];
    const deckCards = args?.deck_cards ?? [];
    const draftRound = args?.draft_round ?? 1;

    if (draftCards.length > 0) {
      await this._build(draftCards, deckCards, draftRound);
    }
    // No cards in args → notif_draftCardsDealt will call _build() momentarily.
  }

  async onLeavingState() {
    // Fan zone intentionally NOT removed here — persists between draft passes.
    // Destroyed in notif_silverDraftComplete once the full draft is over.
    await this._teardown(); // clears _selected/_selectedEl, removes handlers — must run before _pid is cleared
    this._pid = null;
    this._buildSeq = 0;
    // Do NOT reset _confirmedThisSession here — it must stay true during the pass 1→2
    // transition so that the non-active branch of onPlayerActivationChange does not
    // re-add stale gamedatas.draft_cards (the pass-1 snapshot) to the now-empty hand.
    // It is reset in onEnteringState via _build() indirectly, or when the full draft ends.
  }

  async _teardown() {
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
        await handStock.removeAll();
      }
    }
    this._selected = null;
    this._selectedEl = null;
  }

  async _build(draftCards, deckCards, draftRound) {
    const seq = ++this._buildSeq;
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
      const cardElPairs = cardObjs.map((c) => ({ id: parseInt(String(c.id), 10), card: c, el: this.game.cardManager.getCardElement(c) })).filter(({ el }) => el);
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
      cardElPairs.forEach(({ id, card, el }) => {
        el.dataset.cardId = String(id);
        if (el._bcDraftClick) {
          el.removeEventListener("click", el._bcDraftClick);
        }
        el._bcDraftClick = () => this._onCardClick(el);
        el.addEventListener("click", el._bcDraftClick);
        if (el?.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(card));
      });
    }

    // Deck fan: created once for pass 1; pass 2 reuses the same stock.
    if (!this._draftFanStock) {
      await this._buildDeckFan(deckCards);
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

    this._confirmedThisSession = true;
    this.bga.actions.performAction("actPickSilver", { keptCardId });
  }

  async _buildDeckFan(deckCards) {
    const playerBoard = document.querySelector(`.bc-player-board[data-player-id="${this._pid}"]`);
    if (!playerBoard) return;
    playerBoard.insertAdjacentHTML(
      "beforeend",
      `<div id="bc-draft-deck-${this._pid}" class="bc-draft-deck-area">
        <div class="bc-draft-deck-label">${_("Deck")} (${deckCards.length})</div>
        <div class="bc-draft-deck-fan" id="bc-draft-fan-${this._pid}"></div>
      </div>`,
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
    this._pendingHandArgs = null; // set by notif_handDealt if it arrives before onPlayerActivationChange
  }

  onEnteringState(args, isActive) {
    console.log("gamedatas", this.game.gamedatas);

    // MULTIPLE_ACTIVE_PLAYER: BGA calls onPlayerActivationChange separately after this.
    // Do NOT delegate here — it would cause double-initialisation and concurrent _buildHand calls.
  }

  async onPlayerActivationChange(args, isCurrentPlayerActive) {
    await this._teardown();

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
    } else if (this._pendingHandArgs) {
      // notif_handDealt arrived before onPlayerActivationChange — use its data now.
      const pending = this._pendingHandArgs;
      this._pendingHandArgs = null;
      await this._buildHand(pending.hand, pending.deck_count, pending.gems_charged);
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
    // else: _handDealtThisSession is true and no pending data → notif_handDealt will arrive shortly.
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
    this._hideSlotButtons(); // also clears any cell click listeners on the active row
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
      const myFamily = hand.length > 0 ? parseInt(String(hand[0].family), 10) : 0;
      const handRow = handArea.parentElement; // bc-hand-row
      handRow?.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="bc-deck-pile" id="bc-deck-pile-${this._myPid}">
          ${this.game._cardHtml({ family: myFamily })}
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

    // Ensure hand cards are rendered face-up even if the manager reused a previously hidden element.
    for (const cardObj of cardObjs) {
      this.game.cardManager.setCardVisible(cardObj, true);
    }

    for (const cardObj of cardObjs) {
      const el = this.game.cardManager.getCardElement(cardObj);
      if (el) {
        el.classList.add("bc-hand-card");
        el.dataset.cardId = String(cardObj.id);
        el.onclick = (e) => this._onCardClick(e); // onclick prevents duplicate listeners
        if (el?.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(cardObj));
      }
    }

    document.getElementById("btn-bc-mulligan")?.remove();
    if (gemsCharged > 0 && (this.game._currentTurn || 1) < 3) {
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

    const gridEl = document.getElementById(`bc-grid-${this._myPid}`);
    if (!gridEl) return;

    const row = (this.game._currentTurn || 1) - 1;
    const colNames = ["col1", "col2", "col3"];

    // Highlight all 3 active-row cells (filled cells too — clicking displaces existing card)
    for (let col = 0; col < 3; col++) {
      gridEl.querySelector(`[data-slot-id="${row * 3 + col}"]`)?.classList.add("bc-deploy-cell-active");
    }

    // Single delegated handler: closest() climbs the DOM so it works regardless of nesting depth
    const handler = (e) => {
      const slotEl = e.target.closest("[data-slot-id]");
      if (!slotEl) return;
      const pos = parseInt(slotEl.dataset.slotId, 10);
      const col = pos - row * 3;
      if (col < 0 || col > 2) return;
      this._assignSlot(colNames[col], cardId);
    };
    gridEl._bcDeployGridHandler = handler;
    gridEl.addEventListener("click", handler);
  }

  _hideSlotButtons() {
    for (const slot of ["col1", "col2", "col3"]) {
      document.getElementById(`btn-bc-slot-${slot}`)?.remove();
    }
    document.getElementById("btn-bc-deploy")?.remove();

    const gridEl = document.getElementById(`bc-grid-${this._myPid}`);
    if (!gridEl) return;

    if (gridEl._bcDeployGridHandler) {
      gridEl.removeEventListener("click", gridEl._bcDeployGridHandler);
      delete gridEl._bcDeployGridHandler;
    }
    const row = (this.game._currentTurn || 1) - 1;
    for (let col = 0; col < 3; col++) {
      gridEl.querySelector(`[data-slot-id="${row * 3 + col}"]`)?.classList.remove("bc-deploy-cell-active");
    }
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

    const movedEl = this.game.cardManager.getCardElement({ id: cardId });
    if (movedEl) {
      movedEl.classList.remove("bc-card-selected", "bc-hand-card");
      movedEl.onclick = null;
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

  // Return a card from grid slot back to hand — animated via addCard/fromStock.
  _returnCardToHand(cardId, slot) {
    this._slots[slot] = null;
    delete this._cardSlot[cardId];

    const gridStock = this.game._gridStocks[this._myPid];
    const handStock = this.game._handStocks[this._myPid];
    const card = gridStock?.getCards().find((c) => c.id === cardId);
    if (card && handStock) {
      handStock.addCard(card, { fromStock: gridStock });
      const el = this.game.cardManager.getCardElement({ id: cardId });
      if (el) {
        el.classList.add("bc-hand-card");
        el.dataset.cardId = String(cardId);
        el.onclick = (e) => this._onCardClick(e);
      }
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
// Upgrade state — MULTIPLE_ACTIVE_PLAYER (state 40) — master state only
// Flips border cards face-down on entry. All interactive logic is in private
// states UpgradeMain (41) and UpgradePickReplacement (42).
// ---------------------------------------------------------------------------

class Upgrade {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    console.log("[Upgrade] onEnteringState master", { isCurrentPlayerActive });
    // Flip border cards face-down (private states will handle center cards)
    const borderPos = new Set([0, 2, 3, 5, 6, 8]);
    for (const gridStock of Object.values(this.game._gridStocks)) {
      for (const card of gridStock.getCards()) {
        if (borderPos.has(card.position)) {
          this.game.cardManager.setCardVisible(card, false);
        }
      }
    }
    for (let row = 0; row < 3; row++) {
      const left = document.getElementById(`bc-flank-left-${row}`);
      const right = document.getElementById(`bc-flank-right-${row}`);
      if (left) left.innerHTML = "";
      if (right) right.innerHTML = "";
    }
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is upgrading their cards…"));
    }
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is upgrading their cards…"));
    }
  }

  onLeavingState() {}
}

// ---------------------------------------------------------------------------
// UpgradeMain state — PRIVATE (state 41)
// Each player independently selects an action for each face-up center card:
//   • "Flip down for 1 gem"  → actFlipDown  → stays in UpgradeMain
//   • "Spend 1 gem to upgrade" → actSpendGem → enters UpgradePickReplacement (42)
// When all center cards are handled, player is deactivated automatically.
// ---------------------------------------------------------------------------

class UpgradeMainState {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._centerCards = [];
    this._upgradeOptions = {};
    this._gemsCharged = 0;
    this._gemsRemaining = 0;
    this._gemsUncharged = 0;
    this._visualCharged = 0;
    this._selectedCardId = null;
    this._myPid = null;
    this._pendingConfirm = false;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    console.log("[UpgradeMain] onEnteringState", { isCurrentPlayerActive, args });
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is upgrading their cards…"));
      return;
    }
    this._myPid = this.game._currentPlayerPid();
    // If notif_upgradeMainEntered already arrived with empty center_cards, confirm now.
    if (this._pendingConfirm) {
      this._pendingConfirm = false;
      this.game.bga.actions.performAction("actConfirmUpgrade", {});
      return;
    }
    // Args may arrive via notif_upgradeMainEntered or directly from BGA private state args
    if ((args.center_cards || []).length > 0 || args.upgrade_options) {
      this._applyArgs(args);
      this._build();
    }
    // else: notif_upgradeMainEntered will arrive and call _build()
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      this._teardown();
      this.bga.statusBar.setTitle(_("${actplayer} is upgrading their cards…"));
    }
  }

  onLeavingState() {
    this._teardown();
  }

  _applyArgs(args) {
    this._centerCards = args.center_cards || [];
    this._upgradeOptions = args.upgrade_options || {};
    this._gemsCharged = args.gems_charged || 0;
    this._gemsRemaining = this._gemsCharged;
    this._gemsUncharged = args.gems_uncharged || 0;
    this._visualCharged = this._gemsCharged;
  }

  _teardown() {
    document.getElementById("bc-upgrade-ui")?.remove();
    document.getElementById("btn-bc-flip-down")?.remove();
    document.getElementById("btn-bc-spend-gem")?.remove();
    // Remove selectable state from all center card elements
    for (const card of this._centerCards) {
      const cardEl = this.game.cardManager.getCardElement({ id: parseInt(String(card.id), 10) });
      if (cardEl) {
        cardEl.classList.remove("bc-upgrade-selectable", "bc-upgrade-selected", "bc-upgrade-chosen");
        if (cardEl._bcUpgradeClick) {
          cardEl.removeEventListener("click", cardEl._bcUpgradeClick);
          delete cardEl._bcUpgradeClick;
        }
      }
    }
    this._centerCards = [];
    this._selectedCardId = null;
  }

  _build() {
    console.log("[DBG UpgradeMain._build()] centerCards count=", this._centerCards.length, JSON.stringify(this._centerCards));

    // Re-sync gem display
    this.game._updateGemDisplay(this._myPid, this._visualCharged, false);

    // Already-produced cards: skip (face-down, not in center_cards anymore)
    for (const card of this._centerCards) {
      const cardId = parseInt(String(card.id), 10);
      const cardEl = this.game.cardManager.getCardElement({ id: cardId });
      if (!cardEl) continue;
      cardEl.classList.add("bc-upgrade-selectable");
      cardEl._bcUpgradeClick = () => this._onCardClick(cardId, cardEl);
      cardEl.addEventListener("click", cardEl._bcUpgradeClick);
    }

    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `<div id="bc-upgrade-ui">
        <p>${_("Gems charged")}: <strong id="bc-upgrade-gems">${this._gemsRemaining}</strong> — ${_("Click a center card to choose its action.")}</p>
      </div>`,
    );
    this.bga.statusBar.setTitle(_("${you} must choose an action for each center card"));
  }

  _onCardClick(cardId, cardEl) {
    if (this._selectedCardId === cardId) {
      cardEl.classList.remove("bc-upgrade-selected");
      this._selectedCardId = null;
      document.getElementById("btn-bc-flip-down")?.remove();
      document.getElementById("btn-bc-spend-gem")?.remove();
      return;
    }

    // Deselect previous
    if (this._selectedCardId !== null) {
      const prevEl = this.game.cardManager.getCardElement({ id: this._selectedCardId });
      prevEl?.classList.remove("bc-upgrade-selected");
    }

    this._selectedCardId = cardId;
    cardEl.classList.add("bc-upgrade-selected");
    document.getElementById("btn-bc-flip-down")?.remove();
    document.getElementById("btn-bc-spend-gem")?.remove();

    this.bga.statusBar.addActionButton(_("Flip down for 1 gem"), () => this._onFlipDown(cardId, cardEl), { id: "btn-bc-flip-down" });
    const opts = this._upgradeOptions[cardId] || this._upgradeOptions[String(cardId)] || [];
    if (this._gemsRemaining > 0 && opts.length > 0) {
      this.bga.statusBar.addActionButton(_("Spend 1 gem to upgrade"), () => this._onSpendGem(cardId, cardEl), { id: "btn-bc-spend-gem" });
    }
  }

  _onFlipDown(cardId, cardEl) {
    // Animate flip + charge gem (visual-only; server confirms via notif)
    const card = this._centerCards.find((c) => parseInt(String(c.id), 10) === cardId);
    if (card) {
      this.game.cardManager.setCardVisible({ id: card.id, type: card.type, type_arg: card.type_arg, family: card.family }, false);
    }
    if (this._gemsUncharged > 0) {
      this._gemsUncharged--;
      this.game._updateGemDisplay(this._myPid, ++this._visualCharged, true);
    }
    this._lockCard(cardEl);
    document.getElementById("btn-bc-flip-down")?.remove();
    document.getElementById("btn-bc-spend-gem")?.remove();
    this._selectedCardId = null;

    // Remove from local center list so remaining count is accurate
    this._centerCards = this._centerCards.filter((c) => parseInt(String(c.id), 10) !== cardId);

    this.bga.actions.performAction("actFlipDown", { cardId });
  }

  _onSpendGem(cardId, cardEl) {
    document.getElementById("btn-bc-flip-down")?.remove();
    document.getElementById("btn-bc-spend-gem")?.remove();

    // Animate discharge gem + card flying out
    this._gemsRemaining--;
    this._visualCharged--;
    const gemsEl = document.getElementById("bc-upgrade-gems");
    if (gemsEl) gemsEl.textContent = this._gemsRemaining;
    this.game._updateGemDisplay(this._myPid, this._visualCharged, true);

    cardEl.style.transition = "transform 400ms ease-in, opacity 400ms ease-in";
    cardEl.style.transform = "translateY(-70px)";
    cardEl.style.opacity = "0";
    this._lockCard(cardEl);
    this._selectedCardId = null;

    // Remove from local list — will be replaced when returning from UpgradePickReplacement
    this._centerCards = this._centerCards.filter((c) => parseInt(String(c.id), 10) !== cardId);

    this.bga.actions.performAction("actSpendGem", { cardId });
    // BGA will push us into UpgradePickReplacement private state (onEnteringState fires)
  }

  _lockCard(cardEl) {
    cardEl.classList.remove("bc-upgrade-selected", "bc-upgrade-selectable");
    cardEl.classList.add("bc-upgrade-chosen");
    if (cardEl._bcUpgradeClick) {
      cardEl.removeEventListener("click", cardEl._bcUpgradeClick);
      delete cardEl._bcUpgradeClick;
    }
  }
}

// ---------------------------------------------------------------------------
// UpgradePickReplacement state — PRIVATE (state 42)
// Player picks one of 3 replacement cards for the card they just upgraded.
// After picking and confirming, returns to UpgradeMain (state 41).
// ---------------------------------------------------------------------------

class UpgradePickReplacementState {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._origCardId = null;
    this._position = null;
    this._options = [];
    this._chosenId = null;
    this._myPid = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    console.log("[UpgradePickReplacement] onEnteringState", { isCurrentPlayerActive, args });
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is picking a replacement card…"));
      return;
    }
    this._myPid = this.game._currentPlayerPid();
    if (args.options && args.options.length > 0) {
      this._applyArgs(args);
      this._build();
    }
    // else: notif_upgradePickReplacementEntered will arrive
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    if (!isCurrentPlayerActive) {
      this._teardown();
      this.bga.statusBar.setTitle(_("${actplayer} is picking a replacement card…"));
    }
  }

  onLeavingState() {
    this._teardown();
  }

  _applyArgs(args) {
    this._origCardId = args.orig_card_id || null;
    this._position = args.position ?? null;
    this._options = args.options || [];
    this._chosenId = null;
  }

  _teardown() {
    document.getElementById("bc-upgrade-pick-ui")?.remove();
    document.querySelectorAll(".bc-upgrade-opts-panel").forEach((el) => el.remove());
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    this._origCardId = null;
    this._position = null;
    this._options = [];
    this._chosenId = null;
  }

  _build() {
    console.log("[UpgradePickReplacement] _build()", { options: this._options });
    if (this._options.length === 0) {
      // No options — auto-confirm with nothing (edge case)
      this.bga.actions.performAction("actPickReplacement", { chosenId: 0 });
      return;
    }

    const handEl = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (!handEl) return;

    const cardId = this._origCardId;
    const optsHtml = this._options
      .map((o) => {
        const pos = this.game._spritePos(o.type, o.type_arg, o.family);
        return `<div class="bc-card bc-upgrade-option bc-card-sprite bc-card-rank-${o.type}"
                     id="bc-upgrade-opt-${o.id}"
                     data-opt-id="${o.id}"
                     style="background-position:${pos.x}px ${pos.y}px;
                            opacity:0; transform:translateY(-24px)"></div>`;
      })
      .join("");

    handEl.insertAdjacentHTML(
      "beforeend",
      `<div class="bc-upgrade-opts-panel" id="bc-upgrade-opts-${cardId}">
         <div class="bc-upgrade-cards-options">${optsHtml}</div>
       </div>`,
    );

    this._options.forEach((o, i) => {
      const el = document.getElementById(`bc-upgrade-opt-${o.id}`);
      if (!el) return;
      if (el.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(o));
      el.addEventListener("click", () => this._onPick(o.id, el));
      setTimeout(() => {
        el.style.transition = "transform 280ms ease-out, opacity 280ms ease-out";
        el.style.transform = "";
        el.style.opacity = "";
      }, i * 100);
    });

    this.bga.gameArea.getElement().insertAdjacentHTML("afterbegin", `<div id="bc-upgrade-pick-ui"></div>`);
    this.bga.statusBar.setTitle(_("${you} must pick a replacement card"));
  }

  _onPick(optId, el) {
    if (this._chosenId === optId) {
      this._chosenId = null;
      el.classList.remove("bc-option-selected");
      document.getElementById("btn-bc-upgrade-confirm")?.remove();
      return;
    }
    document.querySelectorAll(".bc-upgrade-option").forEach((e) => e.classList.remove("bc-option-selected"));
    el.classList.add("bc-option-selected");
    this._chosenId = optId;

    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    this.bga.statusBar.addActionButton(_("Confirm"), () => this._confirm(), { id: "btn-bc-upgrade-confirm" });
  }

  async _confirm() {
    if (!this._chosenId) return;
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    document.querySelectorAll(".bc-upgrade-option").forEach((e) => (e.style.pointerEvents = "none"));

    // Animate chosen card: flip face-down then BgaCards slides it to the grid slot
    const optEl = document.getElementById(`bc-upgrade-opt-${this._chosenId}`);
    if (optEl && this._position !== null) {
      // Phase 1: flip to face-down (rotateY 0→90, swap to card-back sprite, rotateY 90→0)
      const cardFamily = parseInt(String(this._options.find((o) => o.id === this._chosenId)?.family ?? 1), 10);
      const backX = -(11 * 167);
      const backY = -((cardFamily - 1) * 119);
      optEl.style.transition = "transform 180ms ease-in";
      optEl.style.transform = "rotateY(90deg)";
      await new Promise((r) => setTimeout(r, 185));
      optEl.style.backgroundPosition = `${backX}px ${backY}px`;
      optEl.style.transition = "transform 180ms ease-out";
      optEl.style.transform = "rotateY(0deg)";
      await new Promise((r) => setTimeout(r, 185));

      // Phase 2: remove the option panel. The card will be placed in the grid by
      // notif_upgradeReplacementPicked, which carries the correct family for the back sprite.
      document.getElementById(`bc-upgrade-opts-${this._origCardId}`)?.remove();
    }

    this.bga.actions.performAction("actPickReplacement", { chosenId: this._chosenId });
    // BGA will push us back into UpgradeMain private state
  }
}

// ---------------------------------------------------------------------------
// (Legacy stub — kept so old notif handlers compile; not registered as state)
class UpgradeCardsState {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this._pendingUpgrades = {};
    this._choices = {};
    this._myPid = null;
  }

  onEnteringState(args, isCurrentPlayerActive) {
    console.log("[UpgradeCards] onEnteringState", { args, isCurrentPlayerActive });
    this.onPlayerActivationChange(args, isCurrentPlayerActive);
  }

  onPlayerActivationChange(args, isCurrentPlayerActive) {
    this._teardown();
    if (!isCurrentPlayerActive) {
      this.bga.statusBar.setTitle(_("${actplayer} is picking their replacement cards…"));
      return;
    }
    this._myPid = this.game._currentPlayerPid();
    this._pendingUpgrades = args.pending_upgrades || {};
    this._choices = {};
    if (Object.keys(this._pendingUpgrades).length > 0) {
      this._build();
    }
    // else: server auto-advances (onEnteringState set this player non-active already)
  }

  onLeavingState() {
    this._teardown();
  }

  _teardown() {
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    const el = document.getElementById("bc-upgrade-cards-ui");
    if (el) {
      console.log("[UpgradeCards] _teardown — removing bc-upgrade-cards-ui", new Error().stack?.split("\n")[2]?.trim());
      el.remove();
    }
  }

  _build() {
    const entries = Object.entries(this._pendingUpgrades);
    console.log("[UpgradeCards] _build called", { entryCount: entries.length });
    // Inject into the player's own board zone, which is visible in the viewport
    const targetEl = document.querySelector(`.bc-player-board[data-player-id="${this._myPid}"]`) ?? this.bga.gameArea?.getElement?.();
    console.log("[UpgradeCards] _build targetEl", targetEl?.id || targetEl?.className || "NULL");
    if (!targetEl) {
      console.error("[UpgradeCards] _build ABORTED — no target element found");
      return;
    }
    const slotsHtml = entries
      .map(([cardIdStr, data]) => {
        const cardId = parseInt(cardIdStr, 10);
        const options = data.options || [];
        const optsHtml = options
          .map((o) => {
            const pos = this.game._spritePos(o.type, o.type_arg, o.family);
            return `<div class="bc-card bc-upgrade-option bc-card-sprite bc-card-rank-${o.type}"
                         id="bc-upgrade-cards-opt-${o.id}"
                         data-opt-id="${o.id}" data-card-id="${cardId}"
                         style="background-position:${pos.x}px ${pos.y}px;
                                opacity:0; transform:translateY(-24px)"></div>`;
          })
          .join("");
        return `<div class="bc-upgrade-cards-slot">
          <p class="bc-upgrade-cards-label">${_("Choose a replacement card (rank up):")}</p>
          <div class="bc-upgrade-cards-options">${optsHtml}</div>
        </div>`;
      })
      .join("");

    targetEl.insertAdjacentHTML(
      "beforeend",
      `<div id="bc-upgrade-cards-ui">
        <p>${_("Pick a replacement card for each upgrade:")}</p>
        ${slotsHtml}
      </div>`,
    );
    const uiEl = document.getElementById("bc-upgrade-cards-ui");
    console.log("[UpgradeCards] _build DOM inserted", { uiElExists: !!uiEl, optionCount: uiEl?.querySelectorAll(".bc-upgrade-option").length });

    // Wire click handlers, tooltips, and animate cards in
    document.querySelectorAll("#bc-upgrade-cards-ui .bc-upgrade-option").forEach((el, i) => {
      const optId = parseInt(el.dataset.optId, 10);
      const cardId = parseInt(el.dataset.cardId, 10);
      const data = this._pendingUpgrades[cardId] || this._pendingUpgrades[String(cardId)];
      const opt = (data?.options || []).find((o) => parseInt(String(o.id), 10) === optId);
      if (opt && el.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(opt));
      el.addEventListener("click", () => this._onOptionPick(cardId, optId, el));
      setTimeout(() => {
        el.style.transition = "transform 280ms ease-out, opacity 280ms ease-out";
        el.style.transform = "";
        el.style.opacity = "";
      }, i * 100);
    });

    this.bga.statusBar.setTitle(_("${you} must pick replacement cards for your upgrades"));

    // Check visibility after animations complete
    setTimeout(() => {
      const ui = document.getElementById("bc-upgrade-cards-ui");
      const rect = ui?.getBoundingClientRect();
      const firstOpt = ui?.querySelector(".bc-upgrade-option");
      const cs = firstOpt ? window.getComputedStyle(firstOpt) : null;
      console.log("[UpgradeCards] post-animation check", {
        uiStillInDOM: !!ui,
        inViewport: rect ? rect.bottom > 0 && rect.top < window.innerHeight : false,
        uiTop: rect ? Math.round(rect.top) : null,
        uiHeight: rect ? Math.round(rect.height) : null,
        firstOptOpacity: cs?.opacity,
        firstOptDisplay: cs?.display,
        firstOptVisibility: cs?.visibility,
      });
    }, 600);
  }

  _onOptionPick(cardId, optId, el) {
    // Toggle deselect
    if (this._choices[cardId] === optId) {
      delete this._choices[cardId];
      el.classList.remove("bc-option-selected");
      this._updateConfirmButton();
      return;
    }

    // Deselect others in same slot, then select this one
    const slot = el.closest(".bc-upgrade-cards-slot");
    slot?.querySelectorAll(".bc-upgrade-option").forEach((e) => e.classList.remove("bc-option-selected"));
    el.classList.add("bc-option-selected");
    this._choices[cardId] = optId;
    this._updateConfirmButton();
  }

  _updateConfirmButton() {
    const allPicked = Object.keys(this._pendingUpgrades).every((cid) => {
      const key = parseInt(cid, 10);
      return this._choices[key] !== undefined;
    });
    if (allPicked) {
      if (!document.getElementById("btn-bc-upgrade-confirm")) {
        this.bga.statusBar.addActionButton(_("Confirm replacement"), () => this._confirm(), { id: "btn-bc-upgrade-confirm" });
      }
    } else {
      document.getElementById("btn-bc-upgrade-confirm")?.remove();
    }
  }

  async _confirm() {
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    document.querySelectorAll("#bc-upgrade-cards-ui .bc-upgrade-option").forEach((e) => {
      e.style.pointerEvents = "none";
    });

    const cardIds = [];
    const chosenIds = [];
    const animPromises = [];
    for (const [cardIdStr, chosenId] of Object.entries(this._choices)) {
      const cardId = parseInt(cardIdStr, 10);
      cardIds.push(cardId);
      chosenIds.push(chosenId);

      // Animate chosen option card sliding to its grid slot
      const optEl = document.getElementById(`bc-upgrade-cards-opt-${chosenId}`);
      const data = this._pendingUpgrades[cardId] ?? this._pendingUpgrades[String(cardId)];
      if (optEl && data?.position !== undefined) {
        const gridStock = this.game._gridStocks[this._myPid];
        const slotEl = gridStock?.getElement?.()?.querySelector(`[data-slot-id="${data.position}"]`);
        if (slotEl) {
          const from = optEl.getBoundingClientRect();
          const to = slotEl.getBoundingClientRect();
          const dx = to.left + to.width / 2 - (from.left + from.width / 2);
          const dy = to.top + to.height / 2 - (from.top + from.height / 2);
          optEl.style.transition = "transform 380ms ease-in, opacity 380ms ease-in";
          optEl.style.transform = `translate(${dx}px, ${dy}px) scale(0.85)`;
          optEl.style.opacity = "0";
          animPromises.push(new Promise((r) => setTimeout(r, 420)));
        }
      }
    }

    await Promise.all(animPromises.length ? animPromises : [new Promise((r) => setTimeout(r, 200))]);
    this.bga.actions.performAction("actPickUpgrades", { cardIds, chosenIds });
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
    this.upgradeMain = new UpgradeMainState(this, bga);
    this.upgradePickReplacement = new UpgradePickReplacementState(this, bga);
    this.upgradeCards = new UpgradeCardsState(this, bga); // legacy stub
    this.bga.states.register("SilverDraft", this.silverDraft);
    this.bga.states.register("Deploy", this.deploy);
    this.bga.states.register("Upgrade", this.upgrade);
    this.bga.states.register("UpgradeMain", this.upgradeMain);
    this.bga.states.register("UpgradePickReplacement", this.upgradePickReplacement);
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
        const family = parseInt(card.family, 10);
        if (family >= 1 && family <= 3) {
          element.classList.add("bc-card-sprite");
          element.style.backgroundPosition = `${-(11 * 167)}px ${-((family - 1) * 119)}px`;
        } else {
          element.classList.add("bc-card-hidden");
          element.textContent = "▪";
        }
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
            <div class="bc-grid-container">
              <div class="bc-col-header">
                <div class="bc-col-h"></div>
                <div class="bc-col-h"></div>
                <div class="bc-col-h bc-col-fp-marker" id="bc-col-fp-${pidStr}" style="visibility:hidden">⬤</div>
              </div>
              <div class="bc-grid" id="bc-grid-${pidStr}"></div>
            </div>
            <div class="bc-flank-col">
              <div class="bc-flank-label">${nextName} →</div>
              ${rightFlankHtml}
            </div>
          </div>`;
      } else {
        gridHtml = `
          <div class="bc-grid-container">
            <div class="bc-col-header">
              <div class="bc-col-h"></div>
              <div class="bc-col-h"></div>
              <div class="bc-col-h bc-col-fp-marker" id="bc-col-fp-${pidStr}" style="visibility:hidden">⬤</div>
            </div>
            <div class="bc-grid" id="bc-grid-${pidStr}"></div>
          </div>`;
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
          <div class="bc-components-row">
            <div class="bc-gems-zone" id="bc-gems-zone-${pidStr}">
              <div class="bc-gem" data-state="charged"></div>
              <div class="bc-gem" data-state="uncharged"></div>
              <div class="bc-gem" data-state="uncharged"></div>
            </div>
            <div class="bc-class-components" id="bc-class-components-${pidStr}">
              <div class="bc-rage-marker" id="bc-rage-${pidStr}" data-rage="calm"></div>
              <div class="bc-dice-area" id="bc-dice-area-${pidStr}"></div>
            </div>
          </div>
          <div class="bc-hand-row">
            <div class="bc-hand-area" id="bc-hand-area-${pidStr}"></div>
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
            const slotEl = gridEl.querySelector(`[data-slot-id="${pos}"]`);
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

    // Show first-player marker (turn_order_start_id is the actual first player)
    const firstPid = String(gamedatas.turn_order_start_id || rawOrder[0]);
    const fpEl = document.getElementById(`bc-fp-${firstPid}`);
    if (fpEl) fpEl.style.removeProperty("display");
    const firstColEl = document.getElementById(`bc-col-fp-${firstPid}`);
    if (firstColEl) firstColEl.style.removeProperty("visibility");

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
      if (cardObj.type) {
        const snap = { ...cardObj };
        setTimeout(() => {
          const el = this.cardManager.getCardElement(snap);
          if (el?.id) this.bga.gameui?.addTooltipHtml?.(el.id, this._cardTooltipHtml(snap));
        }, 0);
      }
    }

    // Initial gem + rage values
    for (const [pidStr, player] of Object.entries(gamedatas.players)) {
      const rageEl = document.getElementById(`bc-rage-${pidStr}`);
      if (rageEl) rageEl.dataset.rage = parseInt(player.rage, 10) === 1 ? "enraged" : "calm";
      const gemsZone = document.getElementById(`bc-gems-zone-${pidStr}`);
      if (gemsZone) {
        gemsZone.dataset.gemCol = String(this._colorToGemCol(player.color || ""));
        this._updateGemDisplay(pidStr, parseInt(player.gems_charged, 10) || 0);
      }
    }

    // Restore token visuals from page-load snapshot
    for (const token of gamedatas.tokens || []) {
      this._placeToken(String(token.player_id), parseInt(String(token.grid_position), 10), token.token_type, parseInt(String(token.value), 10));
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

  _cardForce(type, typeArg) {
    const F = {
      "1:1": 2,
      "1:2": 2,
      "1:3": 1,
      "1:4": 3,
      "1:5": 2,
      "1:6": 1,
      "2:1": 3,
      "2:2": 2,
      "2:3": 3,
      "2:4": 0,
      "2:5": 3,
      "2:6": 1,
      "2:7": 2,
      "2:8": 3,
      "2:9": 2,
      "2:10": 3,
      "2:11": 3,
      "2:12": 3,
      "2:13": 4,
      "2:14": 2,
      "2:15": 3,
      "2:16": 3,
      "2:17": 4,
      "2:18": 4,
      "3:1": 4,
      "3:2": 2,
      "3:3": 6,
      "3:4": 4,
      "3:5": 5,
      "3:6": 2,
      "3:7": 0,
      "3:8": 0,
      "3:9": 2,
    };
    return F[`${type}:${typeArg}`] ?? 0;
  }

  _cardTraits(type, typeArg) {
    const T = {
      "1:1": ["gambler", "arcane"],
      "1:2": ["gambler", "mastery"],
      "1:3": ["brute", "impact"],
      "1:4": ["brute", "mastery"],
      "1:5": ["pirate", "energy"],
      "1:6": ["pirate", "arcane"],
      "2:1": ["gambler", "arcane"],
      "2:2": ["gambler", "impact"],
      "2:3": ["gambler", "arcane"],
      "2:4": ["gambler", "impact"],
      "2:5": ["gambler", "mastery"],
      "2:6": ["gambler", "impact"],
      "2:7": ["brute", "impact"],
      "2:8": ["brute", "impact"],
      "2:9": ["brute", "impact"],
      "2:10": ["brute", "impact"],
      "2:11": ["brute", "mastery"],
      "2:12": ["brute", "impact"],
      "2:13": ["pirate", "mastery"],
      "2:14": ["pirate", "impact"],
      "2:15": ["pirate", "impact"],
      "2:16": ["pirate", "mastery"],
      "2:17": ["pirate", "impact"],
      "2:18": ["pirate", "arcane"],
      "3:1": ["gambler", "arcane"],
      "3:2": ["gambler", "mastery"],
      "3:3": ["gambler", "impact"],
      "3:4": ["brute", "mastery"],
      "3:5": ["brute", "impact"],
      "3:6": ["brute", "impact"],
      "3:7": ["pirate", "impact"],
      "3:8": ["pirate", "mastery"],
      "3:9": ["pirate", "impact"],
    };
    return T[`${type}:${typeArg}`] ?? [];
  }

  _cardTooltipHtml(card) {
    const t = parseInt(card.type, 10);
    const a = parseInt(card.type_arg, 10);
    const f = parseInt(card.family, 10);
    const pos = this._spritePos(t, a, f);
    const traits = this._cardTraits(t, a).join(" · ");
    const effect = this._influenceEffectDesc(`${t}:${a}`, null);
    return `<div style="display:flex;gap:8px;padding:4px;max-width:520px">` + `<div class="bc-card bc-card-sprite bc-card-rank-${t}" ` + `style="width:344px;height:238px;background-size:4008px 714px;background-position:${pos.x * 2}px ${pos.y * 2}px;flex-shrink:0"></div>` + `<div><strong>${this._cardName(t, a)}</strong><br>` + `${this._rankName(t)} · ${this._familyName(f)} · ⚔ ${this._cardForce(t, a)}<br>` + `<em>${traits}</em><br>` + `<small>${effect}</small></div>` + `</div>`;
  }

  _tokenTooltipHtml(tokenType, value) {
    if (tokenType === "gambler") {
      const sign = value >= 0 ? "+" : "";
      return `<strong>${sign}${value} force</strong>`;
    }
    return `<strong>Gold rank</strong> (Pirate Gold token)`;
  }

  // Map BGA player color (hex string, e.g. "ff0000") to gem sprite column (0–3).
  _colorToGemCol(hex) {
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    if (r > g && r > b) return 0; // red
    if (g > r && g > b) return 1; // green
    if (b > r && b > g) return 2; // blue
    return 3; // yellow / orange / other
  }

  // Update the 3 gem icons for a player. Pass animate=true to flip the changing gem.
  async _updateGemDisplay(pid, charged, animate = false) {
    const zone = document.getElementById(`bc-gems-zone-${pid}`);
    if (!zone) return;
    const gems = [...zone.querySelectorAll(".bc-gem")];

    if (!animate) {
      gems.forEach((gem, i) => {
        gem.dataset.state = i < charged ? "charged" : "uncharged";
      });
      return;
    }

    // Identify the gem that changes state
    const currentCharged = gems.filter((g) => g.dataset.state === "charged").length;
    const newState = charged > currentCharged ? "charged" : "uncharged";
    const changingIdx = charged < currentCharged ? charged : currentCharged;
    const changingGem = gems[changingIdx];

    if (!changingGem) {
      gems.forEach((gem, i) => {
        gem.dataset.state = i < charged ? "charged" : "uncharged";
      });
      return;
    }

    // Flip: rotate to edge → swap face → rotate back
    changingGem.style.transition = "transform 150ms ease-in";
    changingGem.style.transform = "rotateY(90deg)";
    await new Promise((r) => setTimeout(r, 160));
    changingGem.dataset.state = newState;
    changingGem.style.transition = "transform 150ms ease-out";
    changingGem.style.transform = "rotateY(0deg)";
    await new Promise((r) => setTimeout(r, 160));
    changingGem.style.transition = "";
    changingGem.style.transform = "";
  }

  // Animate a dice roll on a cell: rapidly cycles faces then lands on finalValue.
  async _animateDice(cell, finalValue) {
    const die = document.createElement("div");
    die.className = "bc-dice-anim";
    cell.appendChild(die);
    const frames = 8;
    for (let i = 0; i < frames; i++) {
      const face = i === frames - 1 ? finalValue : Math.floor(Math.random() * 6) + 1;
      die.style.backgroundPositionX = `${-(face - 1) * 60}px`;
      await new Promise((r) => setTimeout(r, i < frames - 2 ? 80 : 150));
    }
    await new Promise((r) => setTimeout(r, 500));
    die.remove();
  }

  // Returns background-position for a gambler token sprite based on its value.
  // Sprite cols (0-indexed): 6=±1, 7=±4, 8=±3, 9=±8. Row 0=green (+), row 1=red (−).
  _gamblerTokenSprite(value) {
    const abs = Math.abs(value);
    let colIdx;
    if (abs <= 2) colIdx = 6;
    else if (abs === 3) colIdx = 8;
    else if (abs === 4) colIdx = 7;
    else colIdx = 9;
    const row = value >= 0 ? 0 : 1;
    return { x: -(colIdx * 60), y: -(row * 60) };
  }

  // Place a token visual on a grid cell (appended inside the cell div, no animation).
  _placeToken(pidStr, gridPos, tokenType, value) {
    const cell = document.getElementById(`bc-cell-${pidStr}-${gridPos}`);
    if (!cell) return;
    const tokenCount = cell.querySelectorAll(".bc-token").length;
    const div = document.createElement("div");
    div.className = "bc-token";
    div.id = `bc-token-${pidStr}-${gridPos}-${tokenCount}`;
    div.dataset.tokenType = tokenType;
    div.dataset.gridPos = String(gridPos);
    div.dataset.tokenValue = String(value);
    div.style.top = `${3 + tokenCount * 40}px`;
    div.style.right = "3px";
    if (tokenType === "gambler") {
      const s = this._gamblerTokenSprite(parseInt(value, 10));
      div.style.backgroundPosition = `${s.x}px ${s.y}px`;
    } else {
      div.style.backgroundPosition = `${-(11 * 60)}px 0`; // pirate_gold: col 12
    }
    cell.appendChild(div);
    this.bga.gameui?.addTooltipHtml?.(div.id, this._tokenTooltipHtml(tokenType, value));
    const flankCell = this._getFlankCell(pidStr, gridPos);
    if (flankCell) {
      const flankCount = flankCell.querySelectorAll(".bc-token").length;
      const flankDiv = div.cloneNode(true);
      flankDiv.id = "";
      flankDiv.style.top = `${3 + flankCount * 40}px`;
      flankCell.appendChild(flankDiv);
    }
  }

  // Place a token visual with a slide-in animation from the top of the screen.
  async _placeTokenAnimated(pidStr, gridPos, tokenType, value) {
    const cell = document.getElementById(`bc-cell-${pidStr}-${gridPos}`);
    if (!cell) {
      this._placeToken(pidStr, gridPos, tokenType, value);
      return;
    }
    const tokenCount = cell.querySelectorAll(".bc-token").length;
    const bgPos =
      tokenType === "gambler"
        ? (() => {
            const s = this._gamblerTokenSprite(parseInt(value, 10));
            return `${s.x}px ${s.y}px`;
          })()
        : `${-(11 * 60)}px 0`;

    const cellRect = cell.getBoundingClientRect();
    const topOffset = 3 + tokenCount * 40;
    const finalLeft = cellRect.right - 60 - 3;
    const finalTop = cellRect.top + topOffset;

    const ghost = document.createElement("div");
    ghost.className = "bc-token";
    ghost.style.backgroundPosition = bgPos;
    ghost.style.position = "fixed";
    ghost.style.left = `${finalLeft}px`;
    ghost.style.top = `-70px`;
    ghost.style.zIndex = "1000";
    ghost.style.transition = "top 0.35s ease-out";
    document.body.appendChild(ghost);
    void ghost.offsetHeight;
    ghost.style.top = `${finalTop}px`;
    await new Promise((r) => setTimeout(r, 370));
    ghost.remove();

    const div = document.createElement("div");
    div.className = "bc-token";
    div.id = `bc-token-${pidStr}-${gridPos}-${tokenCount}`;
    div.dataset.tokenType = tokenType;
    div.dataset.gridPos = String(gridPos);
    div.dataset.tokenValue = String(value);
    div.style.backgroundPosition = bgPos;
    div.style.top = `${topOffset}px`;
    div.style.right = "3px";
    cell.appendChild(div);
    this.bga.gameui?.addTooltipHtml?.(div.id, this._tokenTooltipHtml(tokenType, value));
    const flankCell = this._getFlankCell(pidStr, gridPos);
    if (flankCell) {
      const flankCount = flankCell.querySelectorAll(".bc-token").length;
      const flankDiv = div.cloneNode(true);
      flankDiv.id = "";
      flankDiv.style.top = `${3 + flankCount * 40}px`;
      flankCell.appendChild(flankDiv);
    }
  }

  // Animate a token element sliding up and fading out, then remove it.
  async _animateTokenRemove(el) {
    el.style.transition = "transform 0.3s ease-in, opacity 0.3s ease-in";
    el.style.transform = "translateY(-80px)";
    el.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 320));
    el.remove();
  }

  // Remove all token elements from a player's grid cells and their flank mirrors.
  _clearPlayerTokens(pidStr) {
    for (let pos = 0; pos < 9; pos++) {
      const cell = document.getElementById(`bc-cell-${pidStr}-${pos}`);
      if (cell) cell.querySelectorAll(".bc-token").forEach((el) => el.remove());
      const flankCell = this._getFlankCell(pidStr, pos);
      if (flankCell) flankCell.querySelectorAll(".bc-token").forEach((el) => el.remove());
    }
  }

  // Flat card HTML for flank mirror cells and deck pile (no CardManager tracking).
  // Face-down: standalone div needs explicit flex centering (no inner .card-side).
  _cardHtml(card) {
    if (!card || !card.type) {
      const family = parseInt(card?.family, 10);
      if (family >= 1 && family <= 3) {
        return `<div class="bc-card bc-card-sprite" style="background-position:${-(11 * 167)}px ${-((family - 1) * 119)}px"></div>`;
      }
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

  // Returns the flank cell mirroring the given opponent's border position, or null.
  // col 2 of prevOpp → flank-left; col 0 of nextOpp → flank-right.
  _getFlankCell(pidStr, pos) {
    const col = pos % 3;
    const row = Math.floor(pos / 3);
    if (pidStr === this._prevOppPid && col === 2) {
      return document.getElementById(`bc-flank-left-${row}`);
    }
    if (pidStr === this._nextOppPid && col === 0) {
      return document.getElementById(`bc-flank-right-${row}`);
    }
    return null;
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
        await gridStock?.addCard({ id: c.id, type: null, family: c.family || null, position: pos });
      }
      this._updateFlankMirror(pid, pos, c);
    }
  }

  // Gem count changed (mulligan, produce, upgrade)
  async notif_gemUpdated(args) {
    await this._updateGemDisplay(String(args.player_id), args.charged, true);
  }

  // Current-row cards flipped face-up — 3D card flip via bga-cards setCardVisible.
  // No wobble here: each card wobbles individually when its notify fires (influence / combat).
  async notif_cardsRevealed(args) {
    const pid = String(args.player_id);
    for (const c of args.cards || []) {
      const pos = parseInt(c.position, 10);
      const cardObj = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family, position: pos };
      this.cardManager.setCardVisible(cardObj, true);
      this._updateFlankMirror(pid, pos, c);
      if (c.type) {
        const cardEl = this.cardManager.getCardElement({ id: c.id });
        if (cardEl?.id) this.bga.gameui?.addTooltipHtml?.(cardEl.id, this._cardTooltipHtml(c));
      }
    }
    if (args.cards?.length > 0) {
      await new Promise((r) => setTimeout(r, 550));
    }
  }

  // Center card effect applied during Influence phase
  async notif_influenceResolved(args) {
    const pid = String(args.player_id);
    const centerPos = ((this._currentTurn || 1) - 1) * 3 + 1;
    const centerCell = document.getElementById(`bc-cell-${pid}-${centerPos}`);
    if (!centerCell) return;

    // Wobble the center card + rage flip in parallel
    const cardEl = centerCell.querySelector(".bc-card");
    if (cardEl) {
      cardEl.classList.add("bc-card-activating");
      setTimeout(() => cardEl.classList.remove("bc-card-activating"), 350);
    }
    if (args.rage_toggle !== null && args.rage_toggle !== undefined) {
      this._animateRage(pid, args.rage_toggle);
    }

    if (args.dice_roll > 0) {
      await this._animateDice(centerCell, args.dice_roll);
    }

    const [rankStr, designStr] = (args.effect_type || "").split(":");
    const name = this._cardName(rankStr, designStr);
    const desc = args.effect_desc && args.effect_desc !== "—" ? args.effect_desc : this._influenceEffectDesc(args.effect_type, args.dice_roll);

    this.bga.statusBar.setTitle(`${name} — ${desc}`);
    const badge = document.createElement("div");
    badge.className = "bc-effect-badge";
    badge.innerHTML = `<strong>${name}</strong><br>${desc}`;
    centerCell.appendChild(badge);

    await new Promise((r) => setTimeout(r, 3000));
    badge.remove();
  }

  // Combat start announced — pause before first effect badge
  async notif_combatStarted(_args) {
    this.bga.statusBar.setTitle(_("⚔ Combat!"));
    await new Promise((r) => setTimeout(r, 3000));
  }

  // One side's combat effect — brief badge on the card cell (and its flank mirror)
  async notif_combatEffectApplied(args) {
    let cell;
    let flankCell = null;
    if (args.solo_combat) {
      const flankSide = args.bot_side === "right" ? "left" : "right";
      cell = document.getElementById(`bc-flank-${flankSide}-${args.bot_row}`);
    } else {
      const pid = String(args.player_id);
      const pos = parseInt(String(args.position), 10);
      cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      flankCell = this._getFlankCell(pid, pos);
    }
    if (!cell) return;
    const text = args.effect_desc === "—" ? `⚔ ${args.final_strength}` : `${args.effect_desc} → ⚔ ${args.final_strength}`;
    this.bga.statusBar.setTitle(text);
    const badge = document.createElement("div");
    badge.className = "bc-effect-badge";
    badge.textContent = text;
    cell.appendChild(badge);

    const cardEl = cell.querySelector(".bc-card");
    if (cardEl) {
      cardEl.classList.add("bc-card-activating");
      setTimeout(() => cardEl.classList.remove("bc-card-activating"), 350);
    }
    if (args.rage_toggle !== null && args.rage_toggle !== undefined && !args.solo_combat) {
      this._animateRage(String(args.player_id), args.rage_toggle);
    }

    let flankBadge = null;
    if (flankCell) {
      flankBadge = document.createElement("div");
      flankBadge.className = "bc-effect-badge";
      flankBadge.textContent = text;
      flankCell.appendChild(flankBadge);
      const flankCardEl = flankCell.querySelector(".bc-card");
      if (flankCardEl) {
        flankCardEl.classList.add("bc-card-activating");
        setTimeout(() => flankCardEl.classList.remove("bc-card-activating"), 350);
      }
    }

    await new Promise((r) => setTimeout(r, 3000));
    badge.remove();
    flankBadge?.remove();
  }

  // One combat result — show strength popups on border cards (and flank mirrors), fade the loser
  async notif_combatResolved(args) {
    const rightPid = String(args.right_player_id);
    const lStr = args.left_strength ?? 0;
    const rStr = args.right_strength ?? 0;

    let leftCardEl, rightCardEl;
    let leftFlankCardEl = null,
      rightFlankCardEl = null;

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
      leftFlankCardEl = this._getFlankCell(leftPid, leftPos)?.firstElementChild ?? null;
      rightFlankCardEl = this._getFlankCell(rightPid, rightPos)?.firstElementChild ?? null;
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

    const resultTitle = tie ? `⚔ ${_("Tie")} (${lStr} vs ${rStr})` : leftWon ? `⚔ ${lStr} > ${rStr}` : `⚔ ${rStr} > ${lStr}`;
    this.bga.statusBar.setTitle(resultTitle);

    const lBadge = addStrBadge(leftCardEl, lStr, tie ? null : leftWon);
    const rBadge = addStrBadge(rightCardEl, rStr, tie ? null : rightWon);
    const lFlankBadge = addStrBadge(leftFlankCardEl, lStr, tie ? null : leftWon);
    const rFlankBadge = addStrBadge(rightFlankCardEl, rStr, tie ? null : rightWon);

    const scoreColor = (won) => (won === null ? "#f39c12" : won ? "#27ae60" : "#c0392b");
    if (leftCardEl) this.bga.gameui?.displayScoring?.(leftCardEl, scoreColor(tie ? null : leftWon), lStr);
    if (rightCardEl) this.bga.gameui?.displayScoring?.(rightCardEl, scoreColor(tie ? null : rightWon), rStr);
    if (leftFlankCardEl) this.bga.gameui?.displayScoring?.(leftFlankCardEl, scoreColor(tie ? null : leftWon), lStr);
    if (rightFlankCardEl) this.bga.gameui?.displayScoring?.(rightFlankCardEl, scoreColor(tie ? null : rightWon), rStr);

    if (!tie) {
      if (rightWon && leftCardEl) leftCardEl.classList.add("bc-card-loser");
      if (leftWon && rightCardEl) rightCardEl.classList.add("bc-card-loser");
      if (rightWon && leftFlankCardEl) leftFlankCardEl.classList.add("bc-card-loser");
      if (leftWon && rightFlankCardEl) rightFlankCardEl.classList.add("bc-card-loser");
    }

    await new Promise((r) => setTimeout(r, 3000));

    lBadge?.remove();
    rBadge?.remove();
    lFlankBadge?.remove();
    rFlankBadge?.remove();
    leftCardEl?.classList.remove("bc-card-loser");
    rightCardEl?.classList.remove("bc-card-loser");
    leftFlankCardEl?.classList.remove("bc-card-loser");
    rightFlankCardEl?.classList.remove("bc-card-loser");
  }

  async notif_rageUpdated(args) {
    this._animateRage(args.player_id, args.rage);
    // Fire-and-forget — don't await so notification queue is not blocked
  }

  _animateRage(playerId, rage) {
    const el = document.getElementById(`bc-rage-${playerId}`);
    if (!el) return;
    el.style.transition = "transform 150ms ease-in";
    el.style.transform = "perspective(200px) rotateY(90deg)";
    setTimeout(() => {
      el.dataset.rage = rage === 1 ? "enraged" : "calm";
      el.style.transition = "transform 150ms ease-out";
      el.style.transform = "perspective(200px) rotateY(0deg)";
      setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, 160);
    }, 160);
  }

  async notif_tokenAdded(args) {
    await this._placeTokenAnimated(String(args.player_id), parseInt(String(args.grid_position), 10), args.token_type, parseInt(String(args.value), 10));
  }

  async notif_tokensSyncPlayer(args) {
    const pid = String(args.player_id);
    const makeKey = (pos, type, value) => `${pos}:${type}:${value}`;

    // Collect current token elements for this player
    const currentPool = [];
    for (let pos = 0; pos < 9; pos++) {
      const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (!cell) continue;
      cell.querySelectorAll(".bc-token").forEach((el) => {
        currentPool.push({
          el,
          key: makeKey(parseInt(el.dataset.gridPos, 10), el.dataset.tokenType, parseInt(el.dataset.tokenValue || "0", 10)),
        });
      });
    }

    // Build incoming token list
    const newPool = (args.tokens || []).map((t) => ({
      pos: parseInt(String(t.grid_position), 10),
      type: t.token_type,
      value: parseInt(String(t.value), 10),
      key: makeKey(parseInt(String(t.grid_position), 10), t.token_type, parseInt(String(t.value), 10)),
      used: false,
    }));

    // Match current elements against incoming — unchanged tokens stay in place
    const toRemove = [];
    for (const curr of currentPool) {
      const match = newPool.find((n) => !n.used && n.key === curr.key);
      if (match) {
        match.used = true;
      } else {
        toRemove.push(curr.el);
      }
    }
    const toAdd = newPool.filter((n) => !n.used);

    if (toRemove.length === 0 && toAdd.length === 0) return;

    // Animate removed tokens sliding up, then add new ones sliding in from top
    await Promise.all(toRemove.map((el) => this._animateTokenRemove(el)));
    await Promise.all(toAdd.map((t) => this._placeTokenAnimated(pid, t.pos, t.type, t.value)));

    // Rebuild flank mirrors from final main cell state (border positions only)
    for (let pos = 0; pos < 9; pos++) {
      const col = pos % 3;
      if (col !== 0 && col !== 2) continue;
      const flankCell = this._getFlankCell(pid, pos);
      if (!flankCell) continue;
      flankCell.querySelectorAll(".bc-token").forEach((el) => el.remove());
      const mainCell = document.getElementById(`bc-cell-${pid}-${pos}`);
      if (!mainCell) continue;
      [...mainCell.querySelectorAll(".bc-token")].forEach((el, i) => {
        const clone = el.cloneNode(true);
        clone.style.top = `${3 + i * 40}px`;
        clone.style.right = "3px";
        flankCell.appendChild(clone);
      });
    }
  }

  async notif_tokensCleared() {
    document.querySelectorAll(".bc-token").forEach((el) => el.remove());
  }

  // Upgrade confirmed: produced cards flip face-down; upgraded cards removed from grid stock
  async notif_upgradeConfirmed(args) {
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    if (!gridStock) return;

    const isOwnNotif = pid === String(this._myPid);

    // Produced cards: flip face-down (own player already flipped locally via _onFlipDown)
    if (!isOwnNotif) {
      for (const cardId of args.produced_ids || []) {
        const card = gridStock.getCards().find((c) => c.id === parseInt(String(cardId), 10));
        if (card) this.cardManager.setCardVisible(card, false);
      }
    }
    // Upgraded cards: remove from grid stock (returned to shared pile server-side)
    for (const cardId of args.upgraded_ids || []) {
      const card = gridStock.getCards().find((c) => c.id === parseInt(String(cardId), 10));
      if (card) await gridStock.removeCard(card);
    }
    // Place replacement cards face-down at their grid positions
    for (const c of args.placed_cards || []) {
      const pos = parseInt(String(c.position), 10);
      const existing = gridStock.getCards().find((card) => card.id === parseInt(String(c.id), 10));
      if (existing) continue;
      await gridStock.addCard({ id: parseInt(String(c.id), 10), position: pos });
    }
    await new Promise((r) => setTimeout(r, 400));
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

    document.querySelectorAll(".bc-col-fp-marker").forEach((el) => el.style.setProperty("visibility", "hidden"));
    const firstColEl = document.getElementById(`bc-col-fp-${args.first_player_id}`);
    if (firstColEl) firstColEl.style.removeProperty("visibility");
  }

  // All grid cards returned to deck at start of new round — animate then clear
  async notif_deckShuffled(args) {
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    if (gridStock) {
      // Animate each card flying to the deck pile (staggered)
      const deckTarget = document.getElementById(`bc-deck-pile-${pid}`) ?? document.getElementById(`bc-hand-area-${pid}`);
      const cards = gridStock.getCards();
      if (deckTarget && cards.length > 0) {
        const toRect = deckTarget.getBoundingClientRect();
        const toCx = toRect.left + toRect.width / 2;
        const toCy = toRect.top + toRect.height / 2;
        const anims = cards.map(
          (card, i) =>
            new Promise((resolve) => {
              const el = this.cardManager.getCardElement(card);
              if (!el) {
                resolve();
                return;
              }
              const from = el.getBoundingClientRect();
              const dx = toCx - (from.left + from.width / 2);
              const dy = toCy - (from.top + from.height / 2);
              setTimeout(() => {
                el.style.transition = "transform 350ms ease-in, opacity 350ms ease-in";
                el.style.transform = `translate(${dx}px,${dy}px) scale(0.55)`;
                el.style.opacity = "0";
                el.style.zIndex = "200";
                setTimeout(resolve, 360);
              }, i * 60);
            }),
        );
        await Promise.all(anims);
        await new Promise((r) => setTimeout(r, 60));
      }
      await gridStock.removeAll();
    }

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
    const botCard = args.family ? { family: args.family } : null;
    for (const side of ["left", "right"]) {
      const count = side === "left" ? (args.left_count ?? 3) : (args.right_count ?? 3);
      const flankSide = side === "right" ? "left" : "right";
      for (let row = 0; row < 3; row++) {
        const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
        if (flank) {
          flank.innerHTML = row < count ? this._cardHtml(botCard) : "";
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

  // Private: server pushes the draft hand at state entry (reliable delivery path).
  async notif_draftCardsDealt(args) {
    const draftCards = args.draft_cards || [];
    const deckCards = args.deck_cards || [];
    const draftRound = args.draft_round || 1;

    await this.silverDraft._build(draftCards, deckCards, draftRound);
  }

  // Private: pass 1 → pass 2 transition.
  // Animate out the cards still in hand (the unchosen ones from pass 1).
  // The incoming cards are NOT added here — _build() (via onPlayerActivationChange or
  // notif_draftCardsDealt) is the single source of truth for populating the hand.
  async notif_silverCardsReceived(args) {
    const pid = this.silverDraft._pid ?? this._myPid;
    const handStock = this._handStocks[pid];
    if (!handStock) return;

    // Animate out whatever is currently in the hand stock.
    const remaining = handStock.getCards();

    const outEls = remaining.map((c) => this.cardManager.getCardElement(c)).filter(Boolean);
    if (outEls.length > 0) {
      outEls.forEach((el, i) => {
        el.style.transition = `transform 0.3s ${i * 60}ms ease-in, opacity 0.3s ${i * 60}ms ease-in`;
        el.style.transform = "translateY(40px)";
        el.style.opacity = "0";
      });
      await new Promise((r) => setTimeout(r, 300 + outEls.length * 60));
    }
    await handStock.removeAll();

    // _build() fires next (via onPlayerActivationChange or notif_draftCardsDealt)
    // and will slide in the new cards with its own animation.
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

  // Silver draft complete: flip face-down → stack into pile.
  // Shuffle animation is deferred to notif_handDealt (first Deploy entry).
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
        // Deck area and fanStock are intentionally left alive for the shuffle in notif_handDealt.
      }
    }
    document.getElementById("bc-draft-ui")?.remove();
    this.silverDraft._confirmedThisSession = false;
    console.log("[bc] Silver draft complete — deck stacked, shuffle deferred to Deploy");
  }

  // Gambler combat effect rolled a die — animate the roll centered on the triggering card.
  // Fires before tokensSyncPlayer and combatEffectApplied so the dice animation plays first.
  async notif_combatDiceRolled(args) {
    const pid = String(args.player_id);
    const pos = parseInt(String(args.position), 10);
    const cell = document.getElementById(`bc-cell-${pid}-${pos}`);
    const target = cell ?? document.getElementById(`bc-dice-area-${pid}`);
    if (!target) return;
    await this._animateDice(target, parseInt(String(args.dice_roll), 10));
  }

  // Mousse (1:5) flipped face-down during combat — animate the flip and update the flank mirror
  async notif_cardFlippedFaceDown(args) {
    const pid = String(args.player_id);
    const pos = parseInt(String(args.position), 10);
    const gridStock = this._gridStocks[pid];
    if (!gridStock) return;
    const card = gridStock.getCards().find((c) => c.position === pos);
    if (card) {
      await this.cardManager.setCardVisible(card, false);
    }
    const flankCell = this._getFlankCell(pid, pos);
    if (flankCell) {
      flankCell.innerHTML = this._cardHtml({ family: args.family });
    }
  }

  // Private: hand dealt at Deploy state entry (sent per player from onEnteringState).
  // This is the reliable path when BGA SDK doesn't forward private getArgs.
  // Also handles the reload race: notification can arrive before onPlayerActivationChange
  // calls _build(), so we seed deploy._myPid from the game-level _myPid (always set in setup).
  async notif_handDealt(args) {
    this.deploy._handDealtThisSession = true;
    if (!this.deploy._myPid) {
      // onPlayerActivationChange has not fired yet — store args so it can consume them.
      this.deploy._pendingHandArgs = { hand: args.hand || [], deck_count: args.deck_count || 0, gems_charged: args.gems_charged || 0 };
      return;
    }

    // If the Silver Draft deck area is still visible, animate the shuffle before dealing.
    const fanStock = this.silverDraft._draftFanStock;
    if (fanStock) {
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
        deckArea.style.transition = "opacity 0.35s ease";
        deckArea.style.transform = "";
        deckArea.style.opacity = "0";
        await new Promise((r) => setTimeout(r, 380));
      }
      await fanStock.removeAll();
      this.silverDraft._draftFanStock = null;
      document.getElementById(`bc-draft-deck-${this._myPid}`)?.remove();
    }

    await this.deploy._buildHand(args.hand || [], args.deck_count || 0, args.gems_charged || 0);
  }

  // Private: UpgradeMain entered — send center cards + options to player.
  // Authoritative path for private state args delivery.
  async notif_upgradeMainEntered(args) {
    console.log("[DBG notif_upgradeMainEntered] center_cards=", JSON.stringify(args.center_cards), "placed_cards=", JSON.stringify(args.placed_cards), "upgrade_options keys=", Object.keys(args.upgrade_options || {}));
    if (!this.upgradeMain._myPid) this.upgradeMain._myPid = this._myPid;
    this.upgradeMain._teardown();

    // Sync placed replacement cards into the grid stock (notify->player delivery is unreliable
    // for private notifs — upgradeMainEntered is the authoritative delivery path instead).
    const pid = String(this._myPid);
    const gridStock = this._gridStocks[pid];
    if (gridStock && args.placed_cards?.length > 0) {
      for (const pc of args.placed_cards) {
        const id = parseInt(String(pc.id), 10);
        const pos = parseInt(String(pc.position), 10);
        const family = parseInt(String(pc.family), 10);
        // Remove any card currently occupying this slot (the original card being replaced)
        const slotCards = gridStock.getCards().filter((c) => c.position === pos);
        for (const sc of slotCards) {
          if (sc.id !== id) await gridStock.removeCard(sc);
        }
        const existing = gridStock.getCards().find((c) => c.id === id);
        if (!existing) await gridStock.addCard({ id, position: pos, family });
        console.log("[DBG notif_upgradeMainEntered] placed card", id, "at pos", pos, "family", family);
      }
    }

    this.upgradeMain._applyArgs(args);

    // All cards handled — set flag so onEnteringState (which fires next) calls actConfirmUpgrade.
    if ((args.center_cards || []).length === 0) {
      this.upgradeMain._pendingConfirm = true;
      return;
    }

    await new Promise((r) => setTimeout(r, 150));
    this.upgradeMain._build();
  }

  // Private: UpgradePickReplacement entered — send 3 options to player.
  async notif_upgradePickReplacementEntered(args) {
    console.log("[UpgradePickReplacement] notif_upgradePickReplacementEntered", args);
    if (!this.upgradePickReplacement._myPid) this.upgradePickReplacement._myPid = this._myPid;
    this.upgradePickReplacement._teardown();
    this.upgradePickReplacement._applyArgs(args);
    await new Promise((r) => setTimeout(r, 150));
    this.upgradePickReplacement._build();
  }

  // Public: a card was flipped face-down (produced) — update opponent's grid.
  async notif_upgradeFlipDown(args) {
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    if (!gridStock) return;
    if (pid === String(this._myPid)) return; // own player already flipped locally in _onFlipDown
    const card = gridStock.getCards().find((c) => c.id === parseInt(String(args.card_id), 10));
    if (card) this.cardManager.setCardVisible(card, false);
  }

  // Private: own player's replacement card placed — remove the upgraded card, add new one.
  async notif_upgradeReplacementPicked(args) {
    const pid = String(this._myPid);
    const gridStock = this._gridStocks[pid];
    console.log("[DBG notif_upgradeReplacementPicked] args=", JSON.stringify(args), "gridStock=", !!gridStock);
    if (!gridStock) return;
    const origId = parseInt(String(args.orig_card_id), 10);
    const chosenId = parseInt(String(args.chosen_id), 10);
    const pos = parseInt(String(args.position), 10);
    const family = parseInt(String(args.family ?? 1), 10);
    const cardsInStock = gridStock.getCards().map((c) => c.id);
    console.log("[DBG notif_upgradeReplacementPicked] origId=", origId, "chosenId=", chosenId, "pos=", pos, "family=", family, "cardsInStock=", cardsInStock);
    const origCard = gridStock.getCards().find((c) => c.id === origId);
    console.log("[DBG notif_upgradeReplacementPicked] origCard found=", !!origCard);
    if (origCard) await gridStock.removeCard(origCard);
    const existing = gridStock.getCards().find((c) => c.id === chosenId);
    console.log("[DBG notif_upgradeReplacementPicked] existing chosenId=", !!existing, "→ will addCard=", !existing);
    if (!existing) await gridStock.addCard({ id: chosenId, position: pos, family });
    console.log(
      "[DBG notif_upgradeReplacementPicked] done. cardsInStock after=",
      gridStock.getCards().map((c) => c.id),
    );
    document.getElementById(`bc-upgrade-opts-${args.orig_card_id}`)?.remove();
  }

  // Public: another player placed a replacement card — remove the upgraded card, add new one.
  async notif_upgradeReplacementPlaced(args) {
    const pid = String(args.player_id);
    if (pid === String(this._myPid)) return; // own handled by notif_upgradeReplacementPicked
    const gridStock = this._gridStocks[pid];
    if (!gridStock) return;
    const origId = parseInt(String(args.orig_card_id ?? 0), 10);
    const chosenId = parseInt(String(args.chosen_id), 10);
    const pos = parseInt(String(args.position), 10);
    if (origId) {
      const origCard = gridStock.getCards().find((c) => c.id === origId);
      if (origCard) await gridStock.removeCard(origCard);
    }
    const existing = gridStock.getCards().find((c) => c.id === chosenId);
    if (!existing) await gridStock.addCard({ id: chosenId, position: pos });
  }

  async notif_debugLog(args) {
    console.log("[DBG PHP]", args.msg);
  }

  // Legacy: kept for backward compat in case old notifs replay
  async notif_upgradeDealt(args) {
    console.log("[UpgradeMain] notif_upgradeDealt (legacy)", args);
    if (!this.upgradeMain._myPid) this.upgradeMain._myPid = this._myPid;
    this.upgradeMain._teardown();
    this.upgradeMain._applyArgs(args);
    this.upgradeMain._build();
  }

  async notif_upgradeCardsDealt(args) {
    console.log("[UpgradePickReplacement] notif_upgradeCardsDealt (legacy)", args);
  }

  async notif_upgradeCardsConfirmed(args) {
    document.getElementById("bc-upgrade-cards-ui")?.remove();
    const pid = String(args.player_id);
    const gridStock = this._gridStocks[pid];
    if (!gridStock) return;
    for (const c of args.placed_cards || []) {
      const pos = parseInt(String(c.position), 10);
      const existing = gridStock.getCards().find((card) => card.id === parseInt(String(c.id), 10));
      if (existing) continue;
      await gridStock.addCard({ id: parseInt(String(c.id), 10), position: pos });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Private: new card drawn after mulligan (sent only to the active player)
  async notif_mulliganCard(args) {
    const discardedId = args.discarded_card_id;
    const handStock = this._handStocks[this.deploy._myPid];
    const discardedCard = handStock?.getCards().find((c) => c.id === discardedId);

    if (discardedCard) {
      // Clean up slot state
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

      // Animate: flip face-down, then slide under deck pile (no fade — looks like going under)
      const cardEl = this.cardManager.getCardElement(discardedCard);
      if (cardEl) {
        this.cardManager.setCardVisible(discardedCard, false);
        await new Promise((r) => setTimeout(r, 400));

        const deckEl = document.getElementById(`bc-deck-pile-${this.deploy._myPid}`);
        if (deckEl) {
          const cRect = cardEl.getBoundingClientRect();
          const dRect = deckEl.getBoundingClientRect();
          const dx = dRect.left + dRect.width / 2 - (cRect.left + cRect.width / 2);
          const dy = dRect.top + dRect.height / 2 - (cRect.top + cRect.height / 2);
          cardEl.style.zIndex = "0"; // slide behind deck pile visually
          cardEl.style.transition = "transform 350ms ease-in";
          cardEl.style.transform = `translate(${dx}px, ${dy}px)`;
          await new Promise((r) => setTimeout(r, 380));
        }
      }

      await handStock.removeCard(discardedCard);
    }

    const c = args.new_card;
    if (c && handStock) {
      const newCard = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family };
      const deckEl = document.getElementById(`bc-deck-pile-${this.deploy._myPid}`);
      await handStock.addCard(newCard, deckEl ? { fromElement: deckEl } : undefined);
      const newEl = this.cardManager.getCardElement(newCard);
      if (newEl) {
        newEl.classList.add("bc-hand-card");
        newEl.dataset.cardId = String(newCard.id);
        newEl.onclick = (e) => this.deploy._onCardClick(e);
        if (newEl?.id) this.bga.gameui?.addTooltipHtml?.(newEl.id, this._cardTooltipHtml(newCard));
      }
    }
  }
}
