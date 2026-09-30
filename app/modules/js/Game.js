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
      const el = this.game.cardManager.getCardElement(keptCard);
      el?.classList.remove("bc-draft-card", "bc-card-selected");
      if (el?.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(keptCard));
    }

    this._confirmedThisSession = true;
    this.bga.actions.performAction("actPickSilver", { keptCardId });
  }

  async _buildDeckFan(deckCards) {
    // Built inside #bc-footer-deck-{pid} — the same slot Deploy's own deck pile (.bc-deck-pile)
    // occupies later — so the deck sits in the exact same spot across both phases instead of
    // wherever it happened to land appended at the end of the whole player board.
    const deckZone = document.getElementById(`bc-footer-deck-${this._pid}`);
    if (!deckZone) return;
    deckZone.insertAdjacentHTML(
      "beforeend",
      `<div id="bc-draft-deck-${this._pid}" class="bc-draft-deck-area">
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
      deckCardObjs.forEach((c) => {
        const el = this.game.cardManager.getCardElement(c);
        if (el?.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(c));
      });
    }
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

    this.bga.statusBar.setTitle(_("${you} must deploy 3 cards"));
    this.bga.statusBar.addActionButton(_("Cancel"), () => this._cancelDeployment(), { id: "btn-bc-cancel", color: "secondary" });

    // Delegated click listener for grid cards placed this turn (not yet confirmed), bound
    // once on the persistent grid container. A direct .onclick assigned to the card's own
    // element (the previous approach) is lost whenever bga-cards recreates that element on
    // a later move/reflow, which is why placed cards would stop being clickable. Delegation
    // survives element recreation since it only reads dataset.cardId at click time.
    const gridEl = document.getElementById(`bc-grid-${this._myPid}`);
    if (gridEl && !gridEl._bcCardClickBound) {
      gridEl.addEventListener("click", (e) => {
        if (this._selectedCard !== null) return; // slot-assign handler owns clicks while a card is selected
        const cardEl = e.target.closest(".bc-card");
        if (!cardEl) return;
        const cardId = parseInt(cardEl.dataset.cardId, 10);
        if (!this._cardSlot[cardId]) return; // only cards placed this turn, not yet confirmed
        this._selectCard(cardEl, cardId);
      });
      gridEl._bcCardClickBound = true;
    }

    // Same delegation fix for hand cards: a direct .onclick on the card element (the
    // previous approach) is lost whenever bga-cards recreates that element (deal, mulligan
    // draw, return-to-hand from grid) — the intermittent "some hand cards not clickable" bug.
    // Scoped to .bc-hand-card (not the generic .bc-card) — UpgradePickReplacement renders its
    // 3 replacement options inside this same persistent bc-hand-area container, and those are
    // .bc-card too; matching generically leaked Deploy's Left/Center/Right buttons into that
    // unrelated phase whenever an option was clicked.
    const handEl = document.getElementById(`bc-hand-area-${this._myPid}`);
    if (handEl && !handEl._bcCardClickBound) {
      handEl.addEventListener("click", (e) => {
        const cardEl = e.target.closest(".bc-hand-card");
        if (!cardEl) return;
        const cardId = parseInt(cardEl.dataset.cardId, 10);
        this._selectCard(cardEl, cardId);
      });
      handEl._bcCardClickBound = true;
    }
  }

  // Populate the hand area: face-down deck pile + 3 face-up hand cards.
  // Called from both onPlayerActivationChange and notif_handDealt. The sequence
  // counter ensures the second concurrent call aborts after removeAll() so the
  // last caller wins without double-animation or duplicate click handlers.
  async _buildHand(hand, deckCount, gemsCharged) {
    if (!this._myPid) return;

    const handStock = this.game._handStocks[this._myPid];
    if (!handStock) return;

    // onPlayerActivationChange (SDK-forwarded args) and notif_handDealt can both fire for the
    // same deal (BGA private-notif delivery timing isn't strictly serialized against state
    // transitions). Racing two concurrent removeAll()/addCards() on the same stock left it in
    // an inconsistent DOM state that only a full reload (fresh render from gamedatas) fixed —
    // this was the "need F5 after a freshly-shuffled deck" bug. Drop the redundant concurrent
    // call outright; both carry the same hand data in the legitimate case.
    if (this._buildingHand) return;
    this._buildingHand = true;

    try {
      const seq = ++this._handBuildSeq;

      await handStock.removeAll();
      if (seq !== this._handBuildSeq) return; // a newer call started; abort

      // Deck pile: a non-card element in its own dedicated footer zone (left of the hand)
      document.getElementById(`bc-deck-pile-${this._myPid}`)?.remove();
      const deckZone = document.getElementById(`bc-footer-deck-${this._myPid}`);
      if (deckCount > 0 && deckZone) {
        const myFamily = hand.length > 0 ? parseInt(String(hand[0].family), 10) : 0;
        deckZone.insertAdjacentHTML(
          "beforeend",
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

      // Card ids being dealt can be elements bga-cards has reused before (any card that
      // spent last round untouched in the deck, or was mid-animation elsewhere, may still
      // carry inline transform/opacity/z-index from an earlier flight). Clear them before
      // this stock lays the cards out, or they render stuck at the deck pile until F5.
      for (const cardObj of cardObjs) {
        const el = this.game.cardManager.getCardElement(cardObj);
        if (el) {
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
          el.style.zIndex = "";
          el.style.visibility = ""; // e.g. left hidden by _onSpendGem's ghost-flight handoff
          // Mobile grid crop (_watchMobileGridCardWidth) forces width + these 2 custom props
          // directly on .bc-card elements while a card sits in the grid (83.5px, half a hand
          // card's real 167px). Same reused-DOM-element issue as above: left uncleared, a card
          // that spent last round in the grid comes out of the deck still carrying its grid
          // half-width into the hand's LineStock layout math — cards land stacked/unclickable.
          el.style.removeProperty("width");
          el.style.removeProperty("--bga-cards_card-width");
          el.style.removeProperty("--bga-cards_card-effective-width");
        }
      }

      const deckPileEl = document.getElementById(`bc-deck-pile-${this._myPid}`);
      await handStock.addCards(cardObjs, deckPileEl ? { fromElement: deckPileEl } : undefined);
      if (seq !== this._handBuildSeq) return; // aborted by a newer call

      // Ensure hand cards are rendered face-up even if the manager reused a previously hidden
      // element. Must await: setCardVisible() flips via bga-cards' own animation and can swap
      // in a new DOM element mid-flip (same class of bug as an un-awaited addCard/removeCard
      // elsewhere in this file) — reading getCardElement() right after without waiting could
      // grab the stale pre-flip node, so the class/dataset/tooltip below silently landed on
      // an element that wasn't the one actually left on screen: whichever card's flip settled
      // last (typically the rightmost, dealt last) came out as a stuck face-down ghost that
      // also never got dataset.cardId, i.e. unclickable.
      await Promise.all(cardObjs.map((cardObj) => this.game.cardManager.setCardVisible(cardObj, true)));

      for (const cardObj of cardObjs) {
        const el = this.game.cardManager.getCardElement(cardObj);
        if (el) {
          el.classList.add("bc-hand-card");
          el.dataset.cardId = String(cardObj.id); // clicks handled by the delegated listener bound in _build()
          if (el?.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(cardObj));
        }
      }

      this._gemsCharged = gemsCharged;
      this._updateMulliganButton();
    } finally {
      this._buildingHand = false;
    }
  }

  // Mulligan needs a selected (hand) card, a charged gem, before the last turn, and only
  // before any card has been placed this turn (R-x: decide mulligan first, then deploy).
  // Clicking it mulligans the currently selected card directly (no separate target-picking mode).
  // Works on a hand card OR one already placed this turn on the active row (not yet confirmed):
  // server-side the card still sits in 'hand' location until Confirm fires actDeployCards, so
  // mulliganing a "placed" card is legal — the slot is just freed client-side first.
  _updateMulliganButton() {
    document.getElementById("btn-bc-mulligan")?.remove();
    if (this._selectedCard !== null && (this._gemsCharged ?? 0) > 0 && (this.game._currentTurn || 1) < 3) {
      this.bga.statusBar.addActionButton(_("Mulligan (1 gem)"), () => this._doMulligan(), { id: "btn-bc-mulligan", color: "secondary" });
    }
  }

  _doMulligan() {
    const cardId = this._selectedCard;
    if (cardId === null) return;
    this.game.cardManager.getCardElement({ id: cardId })?.classList.remove("bc-card-selected");

    // If this card was already assigned to a slot this turn, free it (server hasn't
    // committed the placement yet — see comment above).
    const slot = this._cardSlot[cardId];
    if (slot) {
      delete this._cardSlot[cardId];
      this._slots[slot] = null;
    }

    this._selectedCard = null;
    this._hideSlotButtons();
    document.getElementById("btn-bc-mulligan")?.remove();
    this.bga.actions.performAction("actMulligan", { cardId });
  }

  // Shared select/deselect toggle for both hand cards and already-placed grid cards
  // (placed cards stay clickable — clicking one lets you pick a different slot for it,
  // reusing _assignSlot's existing "displace whatever is there" logic).
  _selectCard(cardEl, cardId) {
    if (this._selectedCard === cardId) {
      this._selectedCard = null;
      cardEl.classList.remove("bc-card-selected");
      this._hideSlotButtons();
      this._updateMulliganButton();
      return;
    }

    if (this._selectedCard !== null) {
      this.game.cardManager.getCardElement({ id: this._selectedCard })?.classList.remove("bc-card-selected");
      this._hideSlotButtons();
    }

    this._selectedCard = cardId;
    cardEl.classList.add("bc-card-selected");
    this._showSlotButtons(cardId);
    this._updateMulliganButton();
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

  async _assignSlot(slot, cardId) {
    // If this card was already placed in a different slot this turn, free that slot
    // (this is what makes "click a placed card, then pick a new slot" work as a move).
    const oldSlot = this._cardSlot[cardId];
    if (oldSlot && oldSlot !== slot) {
      this._slots[oldSlot] = null;
    }

    // Displace any (other) card currently in the target slot
    const displaced = this._slots[slot];
    if (displaced !== null && displaced !== undefined && displaced !== cardId) {
      await this._returnCardToHand(displaced, slot);
    }

    const pos = this._slotToGridPos(slot);
    const handStock = this.game._handStocks[this._myPid];
    const gridStock = this.game._gridStocks[this._myPid];
    const cardInHand = handStock?.getCards().find((c) => c.id === cardId);
    const card = cardInHand || gridStock?.getCards().find((c) => c.id === cardId);

    if (card && gridStock) {
      // Must await: moving between (or within) bga-cards stocks recreates the DOM element,
      // so getCardElement() right after would return null/a soon-discarded node otherwise
      // (this was why clicking a placed card to move it silently failed to stay clickable).
      await gridStock.addCard({ ...card, position: pos }, { fromStock: cardInHand ? handStock : gridStock });
    }

    const movedEl = this.game.cardManager.getCardElement({ id: cardId });
    if (movedEl) {
      movedEl.classList.remove("bc-card-selected", "bc-hand-card");
      movedEl.dataset.cardId = String(cardId);
      movedEl.onclick = null; // grid clicks are handled by the delegated listener bound in _build()
    }

    this._slots[slot] = cardId;
    this._cardSlot[cardId] = slot;
    this._selectedCard = null;
    this._hideSlotButtons();
    this._refreshHandCardAttrs();

    if (["col1", "col2", "col3"].every((s) => this._slots[s] !== null)) {
      this.bga.statusBar.addActionButton(_("Confirm Deployment"), () => this._confirm(), { id: "btn-bc-deploy" });
    }
    this._updateMulliganButton();
  }

  _slotToGridPos(slot) {
    const col = { col1: 0, col2: 1, col3: 2 }[slot];
    const row = (this.game._currentTurn || 1) - 1;
    return row * 3 + col;
  }

  // Return a card from grid slot back to hand — animated via addCard/fromStock.
  async _returnCardToHand(cardId, slot) {
    this._slots[slot] = null;
    delete this._cardSlot[cardId];

    const gridStock = this.game._gridStocks[this._myPid];
    const handStock = this.game._handStocks[this._myPid];
    const card = gridStock?.getCards().find((c) => c.id === cardId);
    if (card && handStock) {
      // Must await: bga-cards recreates the DOM element on a stock-to-stock move, so
      // getCardElement() right after would grab a stale/soon-discarded node otherwise
      // (same class of bug as _assignSlot's — this was one cause of "some hand cards
      // aren't clickable" when a displaced card came back to hand).
      await handStock.addCard(card, { fromStock: gridStock });
      const el = this.game.cardManager.getCardElement({ id: cardId });
      if (el) {
        el.classList.add("bc-hand-card");
        el.dataset.cardId = String(cardId); // clicks handled by the delegated listener bound in _build()
      }
      this._refreshHandCardAttrs();
    }
    this._updateMulliganButton();
  }

  // Re-apply .bc-hand-card + dataset.cardId (+ tooltip) to every card currently in hand.
  // bga-cards' LineStock can recreate a card's DOM element on ANY stock mutation, not just
  // the card actually being moved — reflowing the remaining hand cards into their new slots
  // can silently strip a still-in-hand card's class/dataset, which our delegated click
  // listener depends on. This was "my rightmost hand card is sometimes unclickable" (the
  // last card left in hand survives the most reflows, so it was hit most often) — fixed by
  // reasserting these on every card whenever the hand stock's contents change.
  _refreshHandCardAttrs() {
    const handStock = this.game._handStocks[this._myPid];
    if (!handStock) return;
    for (const cardObj of handStock.getCards()) {
      const el = this.game.cardManager.getCardElement(cardObj);
      if (!el) continue;
      el.classList.add("bc-hand-card");
      el.dataset.cardId = String(cardObj.id);
      if (el.id) this.game.bga.gameui?.addTooltipHtml?.(el.id, this.game._cardTooltipHtml(cardObj));
    }
  }

  async _cancelDeployment() {
    for (const slot of ["col1", "col2", "col3"]) {
      const cardId = this._slots[slot];
      if (cardId !== null && cardId !== undefined) {
        await this._returnCardToHand(cardId, slot);
      }
    }
    this._slots = { col1: null, col2: null, col3: null };
    this._cardSlot = {};
    this._selectedCard = null;
    document.getElementById("btn-bc-deploy")?.remove();
    this._hideSlotButtons();
    this._updateMulliganButton();
  }

  _confirm() {
    const { col1, col2, col3 } = this._slots;
    if (col1 === null || col2 === null || col3 === null) return;

    // Lock these cards immediately: once submitted they're no longer this-turn-editable,
    // and _cardSlot being empty is exactly what the delegated grid click listener (bound in
    // _build()) checks before letting a click re-select a card (this also stops these cards'
    // leftover onclick from re-opening deploy slot buttons during the later Reveal/Upgrade
    // phases of this same round).
    for (const cardId of [col1, col2, col3]) {
      delete this._cardSlot[cardId];
      const el = this.game.cardManager.getCardElement({ id: cardId });
      if (el) el.onclick = null;
    }
    this._slots = { col1: null, col2: null, col3: null };

    this.bga.actions.performAction("actDeployCards", {
      col1CardId: col1,
      col2CardId: col2,
      col3CardId: col3,
    });
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
      // Stop propagation: gridEl carries a permanent delegated click listener (bound once by
      // Deploy._build(), never removed since the grid container is reused across phases) —
      // without this, clicking a center card here would also bubble into that listener and
      // could re-open Deploy's Left/Center/Right border buttons during the Upgrade phase.
      cardEl._bcUpgradeClick = (e) => {
        e.stopPropagation();
        this._onCardClick(cardId, cardEl);
      };
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
    // Already at 3/3 charged gems — flipping this card down would gain nothing (a
    // "lost" action, since it still uses up the card's only choice). Confirm first.
    if (this._gemsUncharged <= 0) {
      if (!confirm(_("You already have 3 charged gems — flipping this card down will gain nothing. Continue anyway?"))) {
        return;
      }
    }
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

    // Ghost-clone flight, fully decoupled from the real tracked element — two earlier attempts
    // animated cardEl directly (with or without awaiting gridStock.removeCard() first) and
    // both still visibly popped the real card back into place, because removeCard() has its
    // own internal handling of the element that fights whatever inline styles we set on it
    // directly. Same trick already used elsewhere in this file (notif_deckShuffled,
    // _placeTokenAnimated) for exactly this class of conflict: animate a disposable clone,
    // hide the real element immediately and hand it to the stock independently.
    const rect = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.margin = "0";
    ghost.style.zIndex = "200";
    document.body.appendChild(ghost);
    cardEl.style.visibility = "hidden";
    void ghost.offsetWidth;
    ghost.style.transition = "transform 400ms ease-in, opacity 400ms ease-in";
    ghost.style.transform = "translateY(-70px)";
    ghost.style.opacity = "0";
    setTimeout(() => ghost.remove(), 420);

    // This card id goes to a shared pile and can resurface anywhere later (another player's
    // draw, a future round) — remove it from the grid stock right away, independent of the
    // ghost's flight timing. Leftover visibility:hidden on reuse is cleaned up defensively in
    // _buildHand (and notif_deckShuffled) like the other inline styles this file guards against.
    const gridStock = this.game._gridStocks[this._myPid];
    const stillThere = gridStock?.getCards().find((c) => c.id === cardId);
    if (stillThere) gridStock.removeCard(stillThere);
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
    this._gemsCharged = args.gems_charged ?? 0;
    this._chosenId = null;
  }

  _teardown() {
    document.getElementById("bc-upgrade-pick-ui")?.remove();
    document.querySelectorAll(".bc-upgrade-opts-panel").forEach((el) => el.remove());
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    document.getElementById("btn-bc-upgrade-reroll")?.remove();
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
    this._updateRerollButton();
  }

  // Reroll needs a charged gem — same currency as the deploy-phase mulligan, spent here instead.
  _updateRerollButton() {
    document.getElementById("btn-bc-upgrade-reroll")?.remove();
    if (this._gemsCharged > 0) {
      this.bga.statusBar.addActionButton(_("Reroll (1 gem)"), () => this._doReroll(), { id: "btn-bc-upgrade-reroll", color: "secondary" });
    }
  }

  _doReroll() {
    document.getElementById("btn-bc-upgrade-reroll")?.remove();
    document.getElementById("btn-bc-upgrade-confirm")?.remove();
    document.querySelectorAll(".bc-upgrade-option").forEach((e) => (e.style.pointerEvents = "none"));
    this.bga.actions.performAction("actRerollOptions", {});
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

    // Bronze cards are printed per player color and never change owner once dealt
    // (no bronze re-draw mid-game — see rules), so this map only needs building once,
    // from whichever locations can ever show a face-up bronze card to this viewer:
    // own hand, own personal deck (pre-Deploy / draft), and any player's grid.
    this._bronzeOwnerPid = new Map();
    const viewerPid = String(gamedatas.current_player_id);
    for (const card of gamedatas.hand || []) this._bronzeOwnerPid.set(parseInt(card.id, 10), viewerPid);
    for (const card of gamedatas.deck_cards || []) this._bronzeOwnerPid.set(parseInt(card.id, 10), viewerPid);
    for (const card of gamedatas.grid_cards || []) {
      this._bronzeOwnerPid.set(parseInt(card.id, 10), card.card_location.replace("grid_", ""));
    }

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
        const pos = this._spritePos(card.type, card.type_arg, card.family, card.id);
        element.classList.add("bc-card-sprite", `bc-card-rank-${card.type}`);
        // --sprite-x/--sprite-y (read by .bc-card-sprite's background-position), not a
        // literal inline background-position — see _cardHtml()'s comment for why.
        element.style.setProperty("--sprite-x", `${pos.x}px`);
        element.style.setProperty("--sprite-y", `${pos.y}px`);
        const traits = this._cardTraits(card.type, card.type_arg);
        // bga-cards can call setupFrontDiv again on the same element (reuse/reflow) — drop
        // any overlay from a previous call first, or they stack up as duplicate siblings.
        element.querySelector(".bc-card-traits-overlay")?.remove();
        if (traits.length > 0) {
          // One span per trait (not a joined text node) with the " · " separator drawn via
          // CSS ::before on each non-first span — lets the mobile grid-card media query drop
          // the separator and stack traits onto their own line without touching this string.
          const overlay = document.createElement("div");
          overlay.className = "bc-card-traits-overlay";
          traits.forEach((t) => {
            const span = document.createElement("span");
            span.className = "bc-card-trait";
            span.textContent = t;
            overlay.appendChild(span);
          });
          element.appendChild(overlay);
        }
      },
      setupBackDiv: (card, element) => {
        const family = parseInt(card.family, 10);
        if (family >= 1 && family <= 3) {
          element.classList.add("bc-card-sprite");
          element.style.setProperty("--sprite-x", `${-(17 * 167)}px`);
          element.style.setProperty("--sprite-y", `${-((family - 1) * 119)}px`);
        } else {
          element.classList.add("bc-card-hidden");
          element.textContent = "▪";
        }
      },
      cardWidth: 167,
      cardHeight: 119,
    });

    // current_player_id (from PHP getAllDatas) is authoritative for the viewer's player ID.
    // Falls back to bga.player_id for forward-compatibility. A spectator is neither (viewer
    // id 0/empty, not in the players list) — _myPid must stay "" for them, not silently
    // default to some real player's id: every per-state class gates its private hand/grid
    // logic on `if (!this._myPid) return`, and this fallback used to defeat every one of
    // those guards, plus it broke the player-order math below (indexOf(realPid) succeeding
    // with the WRONG anchor still works by luck, but indexOf(fakeId) landing on some other
    // real seat scrambles who counts as "next"/"previous" opponent for flank rendering).
    const allPids = Object.keys(gamedatas.players ?? {});
    const cid = String(gamedatas.current_player_id ?? this.bga.player_id ?? "");
    this._myPid = allPids.includes(cid) ? cid : "";
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

    // Current player first, then opponents in play order. A spectator has no seat of their
    // own (_myPid === "") — anchor the layout on the first seat instead, purely for display
    // (who's drawn first / who gets the flank+gauge board); _myPid itself stays "" so no
    // per-player private logic mistakes the spectator for that seat's owner.
    const rawOrder = Array.isArray(gamedatas.player_order) && gamedatas.player_order.length ? gamedatas.player_order.map(String) : Object.keys(gamedatas.players);
    const myPid = this._myPid;
    const anchorPid = myPid || rawOrder[0] || "";
    const myIndexInRaw = rawOrder.indexOf(anchorPid);
    const n = rawOrder.length;
    const orderedOpps = [];
    for (let i = 1; i < n; i++) orderedOpps.push(rawOrder[(myIndexInRaw + i) % n]);
    const playerOrder = [anchorPid, ...orderedOpps];
    // Kept separately from _myPid: used only to give a spectator's gauge "mine"-side tracking
    // (_gaugeAnchorPid()) someone to be relative to. For a real player it's just their own pid.
    this._spectatorAnchorPid = anchorPid;

    this._prevOppPid = n >= 2 ? rawOrder[(myIndexInRaw - 1 + n) % n] : null;
    this._nextOppPid = n >= 2 ? rawOrder[(myIndexInRaw + 1) % n] : null;

    for (const pidStr of playerOrder) {
      const player = gamedatas.players[pidStr];
      if (!player) continue;
      const isMe = pidStr === anchorPid;

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
            ${this._gaugeHtml("left", player.color, this._prevOppPid ? gamedatas.players[this._prevOppPid]?.color : null)}
            <div class="bc-grid-container">
              <div class="bc-col-header">
                <div class="bc-col-h"></div>
                <div class="bc-col-h"></div>
                <div class="bc-col-h"></div>
              </div>
              <div class="bc-grid" id="bc-grid-${pidStr}"></div>
            </div>
            ${this._gaugeHtml("right", player.color, this._nextOppPid ? gamedatas.players[this._nextOppPid]?.color : null)}
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
              <div class="bc-col-h"></div>
            </div>
            <div class="bc-grid" id="bc-grid-${pidStr}"></div>
          </div>`;
      }

      playersArea.insertAdjacentHTML(
        "beforeend",
        `
        <div class="bc-player-board${isMe ? " bc-my-board" : ""}" data-player-id="${pidStr}">
          <div class="bc-player-label" style="color:#${player.color || "000000"}">
            ${player.name || pidStr}
          </div>
          ${gridHtml}
          <div class="bc-board-footer">
            <div class="bc-footer-deck" id="bc-footer-deck-${pidStr}"></div>
            <div class="bc-footer-hand">
              <div class="bc-hand-area" id="bc-hand-area-${pidStr}"></div>
            </div>
            <div class="bc-footer-extras">
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
          </div>
        </div>
      `,
      );
    }

    // Gauges sized from the now-rendered grid height (80% of it — user spec).
    this._sizeGauges();
    if (!this._gaugeResizeBound) {
      window.addEventListener("resize", () => this._sizeGauges());
      this._gaugeResizeBound = true;
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
        this._watchMobileGridCardWidth(gridEl);
      }
    }

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

    // Restore effect-resolution badges from page-load snapshot (persist through the round —
    // rebuilt with the same helpers the live notif_influenceResolved/notif_combatEffectApplied
    // handlers use, so the F5'd view matches what a non-reloading player already sees).
    for (const b of gamedatas.effect_badges || []) {
      let cell = null;
      let flankCell = null;
      if (b.badge_kind === "influence") {
        cell = document.getElementById(`bc-cell-${b.player_id}-${b.position}`);
      } else if (b.solo_combat) {
        const flankSide = b.bot_side === "right" ? "left" : "right";
        cell = document.getElementById(`bc-flank-${flankSide}-${b.bot_row}`);
      } else {
        const pidStr = String(b.player_id);
        const pos = parseInt(String(b.position), 10);
        cell = document.getElementById(`bc-cell-${pidStr}-${pos}`);
        flankCell = this._getFlankCell(pidStr, pos);
      }
      for (const target of [cell, flankCell]) {
        if (!target) continue;
        const badge = document.createElement("div");
        badge.className = "bc-effect-badge";
        if (b.badge_kind === "influence") {
          badge.textContent = this._influenceBadgeParts(b).desc;
        } else {
          badge.textContent = this._combatBadgeText(b);
        }
        target.appendChild(badge);
      }
    }

    // Restore the gauge strength-gap history from page-load snapshot (persist through the
    // round, one line per turn) — replays each stored notif_combatResolved payload through
    // the same helper the live handler uses, so order (and thus top/bottom stacking) matches.
    for (const entry of gamedatas.gauge_diff_history || []) {
      this._recordGaugeDiffLine(entry);
    }

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
    // Canonical EN names per docs/GLOSSARY.md §8 — keyed like CardEffects.php $DATA.
    const NAMES = {
      "1:1": "High Roller",
      "1:2": "Amateur",
      "1:3": "Cabin Boy",
      "1:4": "Freebooter",
      "1:5": "Berserker",
      "1:6": "Troll",
      "2:1": "Barbarian",
      "2:2": "Goon",
      "2:3": "The Defender",
      "2:4": "Werewolf",
      "2:5": "Mercenary",
      "2:6": "Bouncer",
      "2:7": "Bookie",
      "2:8": "Lucky Dog",
      "2:9": "Accomplice",
      "2:10": "Dealer",
      "2:11": "Benefactor",
      "2:12": "Cheater",
      "2:13": "Bombardier",
      "2:14": "Navigator",
      "2:15": "Raider",
      "2:16": "First Mate",
      "2:17": "Lookout",
      "2:18": "Buccaneer",
      "3:1": "Brunhilde",
      "3:2": "Goliath",
      "3:3": "Shock Fang",
      "3:4": "Crazy 6",
      "3:5": "Mad Dice",
      "3:6": "Poker Face",
      "3:7": "Davy Jones",
      "3:8": "Flying Dutchman",
      "3:9": "Lady Fortune",
    };
    return NAMES[`${t}:${a}`] || `${this._rankName(t)} #${a}`;
  }

  // Keyed by `${type}:${typeArg}` — typeArg is the CardEffects.php $DATA design key
  // (= cartes.csv id − 6 for Silver, − 24 for Gold). Short blurbs condensed from
  // docs/CARD_EFFECTS.md's EN text (the verified source of truth for effect wording).
  _influenceEffectDesc(effectType, diceRoll) {
    const d = diceRoll;
    const EFFECTS = {
      "1:1": () => `🎲 ${d} → token ${d <= 2 ? "−1" : "+1"}`,
      "1:2": () => `On border: charge gem per shared trait w/ rival`,
      "1:3": () => `Place [Gold] token on this card`,
      "1:4": () => `On border: flip face down → charge 2 gems`,
      "1:5": () => `Highest force in column (strictly) → charge 1 gem`,
      "1:6": () => `Enraged: +2 power. In all cases: flip rage`,
      "2:1": () => `Enraged: +1 power/Impact card in grid. In all cases: flip rage`,
      "2:2": () => `On border: discharge gem → +4 power`,
      "2:3": () => `Calm: +rival's strength. In all cases: flip rage`,
      "2:4": () => `Enraged: +3 power`,
      "2:5": () => `Enraged: +4 power. Calm: flip rage`,
      "2:6": () => `Rival strength > 2 → +6 power`,
      "2:7": () => `🎲 ${d} → token on right border ${d <= 2 ? "−2" : "+4"}`,
      "2:8": () => `Add die value (${d ?? "?"}) to power`,
      "2:9": () => `+1 power per token in grid`,
      "2:10": () => `🎲 ${d} → token ${d <= 2 ? "−3" : "+3"}`,
      "2:11": () => `Charge 1 gem, +2 power per charged gem`,
      "2:12": () => `Gather row+column tokens here, flip + face up`,
      "2:13": () => `On border: flip card below → +5/+3/+1 (Gold/Silver/Bronze)`,
      "2:14": () => `[Gold] token on both border cards this row`,
      "2:15": () => `Have a [Gold] card in grid → charge 2 gems`,
      "2:16": () => `+3 power per [Gold] card in column`,
      "2:17": () => `Rival is [Gold] → +5 power`,
      "2:18": () => `No [Bronze] card in column → +5 power`,
      "3:1": () => `Add other cards' strength in column to power`,
      "3:2": () => `Enraged: +8 power. In all cases: flip rage`,
      "3:3": () => `Discharge all gems → +4 power/gem`,
      "3:4": () => `Roll die per token in grid, +6 power per 6`,
      "3:5": () => `🎲 ${d} → token ${d <= 2 ? "−4" : "+8"}`,
      "3:6": () => `Gather all grid tokens here, flip + face up`,
      "3:7": () => `+4 power per other [Gold] in row+column`,
      "3:8": () => `Flip other [Gold] cards face down, +3 power each`,
      "3:9": () => `+1 VP per [Gold] card in grid`,
    };
    const fn = EFFECTS[effectType];
    return fn ? fn() : effectType;
  }

  // Sheet color order is now Red/Green/Blue/Yellow — same order as _colorToGemCol.
  _bronzeColorIndex(cardId) {
    const pid = this._bronzeOwnerPid?.get(parseInt(cardId, 10));
    const hex = (pid != null ? this.gamedatas?.players?.[pid]?.color : null) || "";
    return this._colorToGemCol(hex);
  }

  // Returns the CSS background-position (in display px) for a face-up card.
  // Sprite sheet: cards_scoundrels.png — 18 cols × 3 rows, background-size 3006×357.
  _spritePos(type, typeArg, family, cardId) {
    const row = (parseInt(family, 10) || 1) - 1;
    let col;
    const t = parseInt(type, 10);
    const a = parseInt(typeArg, 10);
    if (t === 1) {
      col = this._bronzeColorIndex(cardId) * 2 + ((a - 1) % 2); // bronze → 0-7 (per owner color)
    } else if (t === 2) {
      // Silver design (CardEffects.php $DATA key, = cartes.csv id - 6) → column within its
      // family's 6-wide block. NOT a simple (design-1)%6 cycle — verified against the real
      // cards_scoundrels.png pixel-by-pixel (the artist's in-family order isn't the csv order).
      const SILVER_COL = { 1: 5, 2: 1, 3: 3, 4: 4, 5: 0, 6: 2, 7: 0, 8: 5, 9: 1, 10: 2, 11: 4, 12: 3, 13: 3, 14: 5, 15: 0, 16: 1, 17: 4, 18: 2 };
      col = 8 + (SILVER_COL[a] ?? (a - 1) % 6);
    } else {
      // Gold design → column within its family's 3-wide block, same caveat as silver.
      const GOLD_COL = { 1: 0, 2: 2, 3: 1, 4: 2, 5: 0, 6: 1, 7: 2, 8: 0, 9: 1 };
      col = 14 + (GOLD_COL[a] ?? (a - 1) % 3);
    }
    return { x: -(col * 167), y: -(row * 119) };
  }

  // Printed strength — mirrors CardEffects.php $DATA (verified vs cartes.csv).
  _cardForce(type, typeArg) {
    const F = {
      "1:1": 2,
      "1:2": 2,
      "1:3": 2,
      "1:4": 2,
      "1:5": 3,
      "1:6": 2,
      "2:1": 3,
      "2:2": 3,
      "2:3": 3,
      "2:4": 4,
      "2:5": 2,
      "2:6": 2,
      "2:7": 3,
      "2:8": 2,
      "2:9": 3,
      "2:10": 4,
      "2:11": 0,
      "2:12": 2,
      "2:13": 3,
      "2:14": 4,
      "2:15": 4,
      "2:16": 2,
      "2:17": 4,
      "2:18": 2,
      "3:1": 3,
      "3:2": 5,
      "3:3": 4,
      "3:4": 6,
      "3:5": 6,
      "3:6": 3,
      "3:7": 2,
      "3:8": 0,
      "3:9": 3,
    };
    return F[`${type}:${typeArg}`] ?? 0;
  }

  // Mirrors CardEffects.php $DATA (verified vs cartes.csv). Note the family here is
  // the card's own family (gambler/brute/pirate) regardless of which sprite row it's
  // rendered in — a card never changes family, only its owner's color/position does.
  _cardTraits(type, typeArg) {
    const T = {
      "1:1": ["gambler", "arcane"],
      "1:2": ["gambler", "mastery"],
      "1:3": ["pirate", "arcane"],
      "1:4": ["pirate", "mastery"],
      "1:5": ["brute", "mastery"],
      "1:6": ["brute", "impact"],
      "2:1": ["brute", "impact"],
      "2:2": ["brute", "impact"],
      "2:3": ["brute", "impact"],
      "2:4": ["brute", "mastery"],
      "2:5": ["brute", "impact"],
      "2:6": ["brute", "impact"],
      "2:7": ["gambler", "arcane"],
      "2:8": ["gambler", "impact"],
      "2:9": ["gambler", "impact"],
      "2:10": ["gambler", "arcane"],
      "2:11": ["gambler", "impact"],
      "2:12": ["gambler", "mastery"],
      "2:13": ["pirate", "impact"],
      "2:14": ["pirate", "arcane"],
      "2:15": ["pirate", "mastery"],
      "2:16": ["pirate", "impact"],
      "2:17": ["pirate", "impact"],
      "2:18": ["pirate", "impact"],
      "3:1": ["brute", "impact"],
      "3:2": ["brute", "impact"],
      "3:3": ["brute", "impact"],
      "3:4": ["gambler", "impact"],
      "3:5": ["gambler", "arcane"],
      "3:6": ["gambler", "mastery"],
      "3:7": ["pirate", "impact"],
      "3:8": ["pirate", "impact"],
      "3:9": ["pirate", "mastery"],
    };
    return T[`${type}:${typeArg}`] ?? [];
  }

  // Bronze-only rules clarification, from cartes.csv's `texte_italique` column (translated
  // to EN — draft, awaiting user validation per TODO). Silver/Gold's texte_italique is flavor
  // text (quotes), not a rules clarification, so this table intentionally stops at 1:6.
  _bronzeClarification(typeArg) {
    const C = {
      1: "(Die: roll the die.)",
      2: "(Trait: Gambler or Mastery for this card.)",
      3: "([Gold] token: this card now counts as a [Gold] card.)",
      4: "(A face-down card loses its tokens, has strength 0, and adds no power.)",
      5: "(Strength: the value printed at the top of the card.)",
      6: '("In all cases": applies whether your card is at the center or on a border.)',
    };
    return C[typeArg] || "";
  }

  // Small (18×18) inline sprite icon for a specific token, same sheet/columns as the
  // full-size .bc-token (60×60) — scale everything by 0.3 (60*0.3=18, a clean number).
  _tokenIconHtml(tokenType, value) {
    const scale = 0.3;
    let x, y;
    if (tokenType === "gambler") {
      const s = this._gamblerTokenSprite(value);
      x = s.x * scale;
      y = s.y * scale;
    } else {
      x = -(11 * 60) * scale; // pirate_gold: col 12
      y = 0;
    }
    return `<span style="display:inline-block;width:18px;height:18px;vertical-align:middle;background-image:url('img/components_scoundrels.png');background-size:${720 * scale}px ${120 * scale}px;background-position:${x}px ${y}px;"></span>`;
  }

  // Tooltip-only rich-text pass over an effect string: swaps recognizable token-icon
  // placeholders for the actual token sprite, and highlights "Enraged:" in red. The shared
  // _influenceEffectDesc()/_bronzeClarification() strings themselves stay plain text — they're
  // also used for the status bar title, which can't render HTML.
  _effectWithTokenIcons(text) {
    // Signed gambler value, e.g. "token −1" / "token +4" (− is U+2212, not a hyphen — see
    // _influenceEffectDesc's own dice-roll ternaries).
    text = text.replace(/token ([−+]\d+)/g, (_m, signed) => this._tokenIconHtml("gambler", parseInt(signed.replace("−", "-"), 10)));
    // Bare "[Gold] token" (token TYPE, no value) → pirate gold token icon.
    text = text.replace(/\[Gold\] token/g, () => `${this._tokenIconHtml("pirate_gold", 0)} token`);
    // "Enraged:" highlighted red — tooltip only, same reasoning as the icon swap above.
    text = text.replace(/Enraged:/g, '<span style="color:#c0392b;font-weight:bold">Enraged:</span>');
    return text;
  }

  _cardTooltipHtml(card) {
    const t = parseInt(card.type, 10);
    const a = parseInt(card.type_arg, 10);
    const f = parseInt(card.family, 10);
    const pos = this._spritePos(t, a, f, card.id);
    const traits = this._cardTraits(t, a).join(" · ");
    const effect = this._effectWithTokenIcons(this._influenceEffectDesc(`${t}:${a}`, null));
    const clarification = t === 1 ? this._effectWithTokenIcons(this._bronzeClarification(a)) : "";
    return (
      `<div class="bc-card-tooltip" style="display:flex;gap:8px;padding:4px;max-width:520px;font-size:12px">` +
      // 334×238 = card's native 167×119 at exactly 2x (was 344 — 10px too wide, letting the
      // background bleed into the start of the next card's frame in the sprite sheet).
      // --sprite-x/--sprite-y (native, unscaled) alongside the literal 2x background-position:
      // read by the mobile media query, which shrinks this back to native 1x size.
      `<div class="bc-card bc-card-sprite bc-card-rank-${t} bc-tooltip-card-img" style="width:334px;height:238px;background-size:6012px 714px;background-position:${pos.x * 2}px ${pos.y * 2}px;--sprite-x:${pos.x}px;--sprite-y:${pos.y}px;flex-shrink:0"></div>` +
      `<div><strong>⚔ ${this._cardForce(t, a)}</strong> <strong>${this._cardName(t, a)}</strong><br>` +
      `<strong><em>${traits}</em></strong><br>` +
      `${effect}` +
      (clarification ? `<br><span style="font-style:italic;opacity:0.8">${clarification}</span>` : "") +
      `</div>` +
      `</div>`
    );
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

    const currentCharged = gems.filter((g) => g.dataset.state === "charged").length;
    if (currentCharged === charged) return;
    const newState = charged > currentCharged ? "charged" : "uncharged";

    // Every gem index between the old and new counts changes state — this used to assume
    // exactly ONE gem ever changed per call (true for most ±1 effects) and only flipped
    // gems[changingIdx], silently ignoring the rest. Freebooter's own +2 charge broke that:
    // only the first of the two newly-charged gems got flipped, the second stayed visually
    // uncharged even though the server (and a fresh F5, which redraws with animate=false) had
    // it right — a pure display bug, not a server one. Flip each gem in the affected range.
    const lo = Math.min(currentCharged, charged);
    const hi = Math.max(currentCharged, charged);
    for (let idx = lo; idx < hi; idx++) {
      const changingGem = gems[idx];
      if (!changingGem) continue;
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
  // Sprite cols (0-indexed): 6=(-1/+1), 7=(-2/+4), 8=(-3/+3), 9=(-4/+8). Row 0=green (+), row 1=red (−).
  // Pairs share an abs() value across each other (abs(4) is both +4 of pair2 and -4 of pair4),
  // so the column must be looked up from the signed value, not from Math.abs(value).
  _gamblerTokenSprite(value) {
    const colIdx = { "-1": 6, "1": 6, "-2": 7, "4": 7, "-3": 8, "3": 8, "-4": 9, "8": 9 }[String(value)] ?? 6;
    const row = value >= 0 ? 0 : 1;
    return { x: -(colIdx * 60), y: -(row * 60) };
  }

  // Mirrors CardEffects.php's plusValueOf() — pairs aren't symmetric (e.g. -2 ↔ +4), so this
  // must be a lookup, not Math.abs(). Used to flip a red token's sprite to its plus face for
  // the Cheater/Poker Face gather animation.
  _plusValueOf(value) {
    const v = { "-1": 1, "1": 1, "-2": 4, "4": 4, "-3": 3, "3": 3, "-4": 8, "8": 8 }[String(value)];
    return v ?? Math.abs(value);
  }

  // Place a token visual on a grid cell (appended inside the cell div, no animation).
  // forcedOffset lets a caller placing several tokens at once (Promise.all) pre-assign each
  // one's stacking slot instead of a live DOM count — see notif_tokensSyncPlayer's
  // posOffsetSeed for why a live read is unsafe when multiple calls race concurrently.
  _placeToken(pidStr, gridPos, tokenType, value, forcedOffset) {
    const cell = document.getElementById(`bc-cell-${pidStr}-${gridPos}`);
    if (!cell) return;
    const tokenCount = forcedOffset ?? cell.querySelectorAll(".bc-token").length;
    const div = document.createElement("div");
    div.className = "bc-token";
    // A monotonic sequence, not the live on-cell count: tokens can be removed out of order
    // (gather/flip effects), so "count at creation time" can collide with an id already worn
    // by a still-present token — two elements sharing one id broke tooltip targeting for one
    // of them, part of the "multiple tokens" display glitches.
    this._tokenSeq = (this._tokenSeq || 0) + 1;
    div.id = `bc-token-${pidStr}-${gridPos}-${this._tokenSeq}`;
    div.dataset.tokenType = tokenType;
    div.dataset.gridPos = String(gridPos);
    div.dataset.tokenValue = String(value);
    div.style.top = "3px";
    div.style.right = `${3 + tokenCount * 30}px`; // 30px = 50% of 60px token width
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
      // Mirrors the main cell's own slot (tokenCount), not a separate live count of the flank
      // — same race hazard as the main cell if read live during a concurrent batch.
      const flankDiv = div.cloneNode(true);
      flankDiv.id = "";
      flankDiv.style.right = `${3 + tokenCount * 30}px`;
      flankCell.appendChild(flankDiv);
    }
  }

  // Place a token visual with a slide-in animation from the top of the screen.
  // forcedOffset: see _placeToken's comment.
  async _placeTokenAnimated(pidStr, gridPos, tokenType, value, forcedOffset) {
    const cell = document.getElementById(`bc-cell-${pidStr}-${gridPos}`);
    if (!cell) {
      this._placeToken(pidStr, gridPos, tokenType, value, forcedOffset);
      return;
    }
    const tokenCount = forcedOffset ?? cell.querySelectorAll(".bc-token").length;
    const bgPos =
      tokenType === "gambler"
        ? (() => {
            const s = this._gamblerTokenSprite(parseInt(value, 10));
            return `${s.x}px ${s.y}px`;
          })()
        : `${-(11 * 60)}px 0`;

    const cellRect = cell.getBoundingClientRect();
    const rightOffset = 3 + tokenCount * 30; // 30px = 50% of 60px token width
    const finalLeft = cellRect.right - 60 - rightOffset;
    const finalTop = cellRect.top + 3;

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
    // Monotonic sequence, not the DOM count — see _placeToken for why.
    this._tokenSeq = (this._tokenSeq || 0) + 1;
    div.id = `bc-token-${pidStr}-${gridPos}-${this._tokenSeq}`;
    div.dataset.tokenType = tokenType;
    div.dataset.gridPos = String(gridPos);
    div.dataset.tokenValue = String(value);
    div.style.backgroundPosition = bgPos;
    div.style.top = "3px";
    div.style.right = `${rightOffset}px`;
    cell.appendChild(div);
    this.bga.gameui?.addTooltipHtml?.(div.id, this._tokenTooltipHtml(tokenType, value));
    const flankCell = this._getFlankCell(pidStr, gridPos);
    if (flankCell) {
      // Mirrors the main cell's own slot (tokenCount), not a separate live count of the flank
      // — same race hazard as the main cell if read live during a concurrent batch.
      const flankDiv = div.cloneNode(true);
      flankDiv.id = "";
      flankDiv.style.right = `${3 + tokenCount * 30}px`;
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
  // Position set via --sprite-x/--sprite-y custom props (read by .bc-card-sprite's
  // background-position), not a literal inline background-position — the mobile media
  // query overrides --sprite-x on cards inside .bc-cell/.bc-flank-cell to show only the
  // sprite's right half, which a plain inline shorthand couldn't be overridden past.
  _cardHtml(card) {
    if (!card || !card.type) {
      const family = parseInt(card?.family, 10);
      if (family >= 1 && family <= 3) {
        return `<div class="bc-card bc-card-sprite" style="--sprite-x:${-(17 * 167)}px;--sprite-y:${-((family - 1) * 119)}px"></div>`;
      }
      return `<div class="bc-card bc-card-hidden">▪</div>`;
    }
    const pos = this._spritePos(card.type, card.type_arg, card.family, card.id);
    return `<div class="bc-card bc-card-sprite bc-card-rank-${card.type}"
                 style="--sprite-x:${pos.x}px;--sprite-y:${pos.y}px"></div>`;
  }

  // Update the current player's flank mirror cells when an opponent border card changes.
  // Flank cells are plain innerHTML (no CardManager tracking needed).
  // mode: null (no animation, e.g. F5 restore), "slide" (opponent deploys — see
  // _slideFlankIn), or "flip" (opponent's border card turns face-up at reveal, matching the
  // real flip _cardManager.setCardVisible() plays for my own cards at the same moment).
  _updateFlankMirror(pidStr, pos, card, mode = null) {
    const col = pos % 3;
    const row = Math.floor(pos / 3);
    if (pidStr === this._prevOppPid && col === 2) {
      const flank = document.getElementById(`bc-flank-left-${row}`);
      if (flank) {
        flank.innerHTML = this._cardHtml(card);
        if (card.type) this.bga.gameui?.addTooltipHtml?.(flank.id, this._cardTooltipHtml(card));
        if (mode === "slide") this._slideFlankIn(flank, "left");
        if (mode === "flip") this._flipFlankIn(flank);
      }
    }
    if (pidStr === this._nextOppPid && col === 0) {
      const flank = document.getElementById(`bc-flank-right-${row}`);
      if (flank) {
        flank.innerHTML = this._cardHtml(card);
        if (card.type) this.bga.gameui?.addTooltipHtml?.(flank.id, this._cardTooltipHtml(card));
        if (mode === "slide") this._slideFlankIn(flank, "right");
        if (mode === "flip") this._flipFlankIn(flank);
      }
    }
  }

  // Slide a just-inserted flank-mirror card in from off-board, matching the edge it
  // mirrors: my left flank (opponent's border) enters from the left, my right flank
  // enters from the right. Used when an opponent deploys.
  _slideFlankIn(flankCell, side) {
    const cardEl = flankCell.querySelector(".bc-card");
    if (!cardEl) return;
    const dx = side === "left" ? -60 : 60;
    cardEl.style.transition = "none";
    cardEl.style.transform = `translateX(${dx}px)`;
    cardEl.style.opacity = "0";
    void cardEl.offsetWidth; // force reflow so the transition below actually animates
    cardEl.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
    cardEl.style.transform = "";
    cardEl.style.opacity = "";
  }

  // Turn the flank-mirror card face-up at reveal, echoing the 3D flip bga-cards plays on my
  // own row's cards at the same moment (the mirror is a plain div, not a managed card, so it
  // gets a simple rotate+fade rather than a true two-sided flip).
  _flipFlankIn(flankCell) {
    const cardEl = flankCell.querySelector(".bc-card");
    if (!cardEl) return;
    cardEl.style.transition = "none";
    cardEl.style.transform = "rotateY(90deg)";
    cardEl.style.opacity = "0";
    void cardEl.offsetWidth;
    cardEl.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
    cardEl.style.transform = "";
    cardEl.style.opacity = "";
  }

  // Returns the flank cell mirroring the given opponent's border position, or null.
  // col 2 of prevOpp → flank-left; col 0 of nextOpp → flank-right.
  // Name + description for an influence-resolution badge — shared between the live
  // notif_influenceResolved handler and the F5-restore loop in setup().
  _influenceBadgeParts(args) {
    const [rankStr, designStr] = (args.effect_type || "").split(":");
    const name = this._cardName(rankStr, designStr);
    // "—" is the server's explicit "this card's effect did not apply" sentinel (e.g. a
    // rival-only card like Bouncer placed at center, where there is no rival) — falling back
    // to the card's generic rule text on that sentinel showed a misleading "as if it fired"
    // description. Only fall back when effect_desc is truly absent, matching _combatBadgeText.
    const desc = args.effect_desc ?? this._influenceEffectDesc(args.effect_type, args.dice_roll);
    return { name, desc };
  }

  // Text for a combat-resolution badge — shared between the live notif_combatEffectApplied
  // handler and the F5-restore loop in setup().
  _combatBadgeText(args) {
    return args.effect_desc === "—" ? `⚔ ${args.final_strength}` : `${args.effect_desc} → ⚔ ${args.final_strength}`;
  }

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

  // -------------------------------------------------------------------------
  // Shared power gauges (R-2.2, R-5.8): one per border ("left"/"right" of my
  // own board), reused every turn, reset at the start of each new row.
  // -------------------------------------------------------------------------

  // mineHex/theirsHex: hex color of the gauge's two owners — picks the disc's
  // sprite column once at creation (a player's color never changes mid-game).
  // --disc-col is read by CSS; --disc-size is set later by _sizeGauges() once the
  // grid's real rendered height is known (gauge is 80% of it, art scales to match).
  _gaugeHtml(side, mineHex, theirsHex) {
    let ticks = "";
    for (let i = 10; i >= 1; i--) ticks += `<div class="bc-gauge-tick"></div>`;
    const mineCol = 4 + this._colorToGemCol(mineHex || "");
    const theirsCol = 4 + this._colorToGemCol(theirsHex || "");
    // --disc-hex alongside --disc-col: only read by the mobile media query, which drops the
    // sprite image (disc-col picks its column) in favor of a plain solid-color circle.
    return `
      <div class="bc-gauge-col">
        <div class="bc-power-gauge" id="bc-gauge-${side}">
          <div class="bc-gauge-track">${ticks}</div>
          <div class="bc-gauge-marker bc-gauge-marker-mine" id="bc-gauge-${side}-mine" style="--disc-col:${mineCol};--disc-hex:#${mineHex || "888888"}"></div>
          <div class="bc-gauge-marker bc-gauge-marker-theirs" id="bc-gauge-${side}-theirs" style="--disc-col:${theirsCol};--disc-hex:#${theirsHex || "888888"}"></div>
        </div>
        <div class="bc-gauge-diff" id="bc-gauge-diff-${side}"></div>
      </div>`;
  }

  // Mobile grid-card crop (right-half-only, see borderclash.css's mobile media query): CSS
  // !important lost repeatedly (5 rounds) to bga-cards' own inline sizing — both on the slot
  // div (.bc-cell, sized by SlotStock to match cardWidth/cardHeight) AND the card wrapper it
  // holds. Force BOTH via JS instead: a plain sequential inline-style write always wins over
  // whatever bga-cards set earlier, regardless of any !important either side used, since
  // there's only one live inline value per property — no cascade to lose. Applied once for
  // cells/cards already present (F5 restore) and to every one bga-cards adds afterward, via
  // MutationObserver (same pattern already used just above for slot id assignment) — covers
  // every placement code path at once instead of chasing each call site.
  _watchMobileGridCardWidth(gridEl) {
    const isMobile = () => window.matchMedia("(max-width: 700px)").matches;
    const applyCellCrop = (cellEl) => {
      if (!isMobile()) return;
      cellEl.style.setProperty("width", "83.5px", "important");
      cellEl.style.setProperty("overflow", "hidden", "important");
    };
    // The real bga-cards classes are "bga-cards_card-sides" (a wrapper, PLURAL, sitting
    // between .bc-card and the actual faces — holds the 3D flip transform) and
    // "bga-cards_card-side" (SINGULAR, one per face, front/back) — neither is ".card-side"
    // (used elsewhere in this file and in borderclash.css, never matched anything). Both
    // need forcing to 100%/100%: the faces are width:100% of the SIDES WRAPPER, not of
    // .bc-card directly — forcing only the singular face left it at 100% of an
    // untouched, still-167px "sides" wrapper, which is why the computed width stayed ~167
    // despite the face's own inline width:100%!important (confirmed via live DevTools
    // inspection: --bga-cards_card-effective-width still resolved to 167px at the face).
    const applyFaceCrop = (faceEl) => {
      if (!isMobile()) return;
      faceEl.style.setProperty("width", "100%", "important");
      faceEl.style.setProperty("height", "100%", "important");
    };
    const FACE_SELECTOR = ".bga-cards_card-side, .bga-cards_card-sides";
    const applyCardCrop = (cardEl) => {
      if (!isMobile()) return;
      cardEl.style.setProperty("width", "83.5px", "important");
      // The card element ALSO carries its own inline --bga-cards_card-width: 167px (a
      // per-card redefinition, not just inherited from .bc-grid) — confirmed via a manual
      // DevTools test (unchecking it fixed the display): bga-cards uses this variable for
      // some internal 3D-flip transform/position math independent of the element's actual
      // rendered width, so as long as it stays 167 here the flip geometry keeps assuming a
      // card twice the real width — showing real content only in the left half and nothing
      // in the right (the half that should have "slid over" to fill the now-narrower box).
      cardEl.style.setProperty("--bga-cards_card-width", "83.5px", "important");
      cardEl.style.setProperty("--bga-cards_card-effective-width", "83.5px", "important");
      cardEl.querySelectorAll(FACE_SELECTOR).forEach(applyFaceCrop);
    };
    const applyAll = () => {
      gridEl.querySelectorAll(".bc-cell, [data-slot-id]").forEach(applyCellCrop);
      gridEl.querySelectorAll(".bc-card").forEach(applyCardCrop);
      gridEl.querySelectorAll(FACE_SELECTOR).forEach(applyFaceCrop);
    };
    applyAll();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.classList?.contains("bc-cell") || node.hasAttribute?.("data-slot-id")) applyCellCrop(node);
          if (node.classList?.contains("bc-card")) applyCardCrop(node);
          if (node.classList?.contains("bga-cards_card-side") || node.classList?.contains("bga-cards_card-sides")) applyFaceCrop(node);
          node.querySelectorAll?.(".bc-cell, [data-slot-id]").forEach(applyCellCrop);
          node.querySelectorAll?.(".bc-card").forEach(applyCardCrop);
          node.querySelectorAll?.(FACE_SELECTOR).forEach(applyFaceCrop);
        }
      }
    });
    observer.observe(gridEl, { childList: true, subtree: true });
    window.addEventListener("resize", applyAll);
  }

  // Gauge height = 80% of the actual rendered grid height (per user spec), scaled down an
  // extra 10% on top (border images + token, per later request), art scales to match
  // (native 220×900 → gaugeW×gaugeH, keeping aspect ratio). Marker/disc size follows from
  // the gauge height (one slot = gaugeH / 10) via the --disc-size custom property, which
  // cascades down to .bc-gauge-marker in CSS.
  _sizeGauges() {
    const grid = document.querySelector(".bc-grid-with-flanks .bc-grid");
    if (!grid) return;
    const gridH = grid.getBoundingClientRect().height;
    if (!gridH) return;
    const gaugeH = gridH * 0.8 * 0.9; // 80% of grid height, then 10% smaller per user request
    const scale = gaugeH / 900; // native gauge height
    const gaugeW = 220 * scale;
    const discSize = gaugeH / 10;
    for (const side of ["left", "right"]) {
      const el = document.getElementById(`bc-gauge-${side}`);
      if (!el) continue;
      el.style.height = `${gaugeH}px`;
      el.style.width = `${gaugeW}px`;
      el.style.backgroundSize = `${3020 * scale}px ${gaugeH}px`;
      el.style.backgroundPositionX = `${-2800 * scale}px`;
      el.style.setProperty("--disc-size", `${discSize}px`);
      el.style.setProperty("--gauge-w", `${gaugeW}px`);
      // Also set on the gauge+diff-box wrapper: --disc-size is read there too (by
      // .bc-gauge-diff's margin-top, so the diff box clears the resting disc below the
      // gauge), but custom properties only cascade to descendants, not siblings.
      el.parentElement?.style.setProperty("--disc-size", `${discSize}px`);
    }
    // Also set on the player board root: .bc-footer-deck/.bc-footer-extras (siblings of
    // .bc-grid-with-flanks, not descendants of the gauge) read --gauge-w to size themselves
    // to "border column + gauge" width, so the footer row lines up under the grid above it.
    const myBoard = grid.closest(".bc-player-board");
    myBoard?.style.setProperty("--gauge-w", `${gaugeW}px`);

    // Other players' boards only render a bare grid (no flank columns/gauges either side),
    // so without this they end up visibly narrower than mine. Match every board's width to
    // mine's actual rendered (border-box) width once it's settled.
    if (myBoard) {
      const myWidth = myBoard.getBoundingClientRect().width;
      document.querySelectorAll(".bc-player-board").forEach((board) => {
        if (board !== myBoard) board.style.width = `${myWidth}px`;
      });
    }
  }

  // For a spectator (_myPid === ""), falls back to the anchor seat setup() picked to draw
  // the flank+gauge board for — otherwise gauge "mine"-side tracking has no owner at all.
  _gaugeAnchorPid() {
    return this._myPid || this._spectatorAnchorPid || "";
  }

  // My own left-column card feeds the left gauge, right-column feeds the right gauge.
  _gaugeMineSide(pidStr, pos) {
    if (pidStr !== this._gaugeAnchorPid()) return null;
    const col = pos % 3;
    if (col === 0) return "left";
    if (col === 2) return "right";
    return null;
  }

  // Same neighbor-mirroring rule as _getFlankCell: prevOpp's right column → my left gauge,
  // nextOpp's left column → my right gauge.
  _gaugeRivalSide(pidStr, pos) {
    const col = pos % 3;
    if (pidStr === this._prevOppPid && col === 2) return "left";
    if (pidStr === this._nextOppPid && col === 0) return "right";
    return null;
  }

  // Place one side's token. Always visible: rests just below the gauge at power 0
  // (tick=0 → bottom=-10%), climbs one tick per point, and flips to its "+10" face
  // past 10 (physical disc flip — see .bc-gauge-over10 in borderclash.css).
  _setGaugeMarker(side, who, strength) {
    const el = document.getElementById(`bc-gauge-${side}-${who}`);
    if (!el) return;
    const clamped = Math.max(0, Math.min(20, strength ?? 0));
    const tick = clamped > 10 ? clamped - 10 : clamped;
    el.style.bottom = `${(tick - 1) * 10}%`;
    el.classList.toggle("bc-gauge-over10", clamped > 10);
  }

  // Reset both gauges (R-5.13: cleared at the start of every new turn) — both
  // tokens drop back to their below-gauge resting position (power 0). The per-turn
  // strength-gap history (see notif_combatResolved) is NOT cleared here on purpose —
  // it stays visible all round, one line per turn (see _clearGaugeDiffHistory).
  _resetGauges() {
    for (const side of ["left", "right"]) {
      for (const who of ["mine", "theirs"]) this._setGaugeMarker(side, who, 0);
    }
  }

  // Wipes the accumulated per-turn strength-gap lines under each gauge — called only at
  // end of round (see notif_upgradeMainEntered), alongside _clearEffectBadges().
  _clearGaugeDiffHistory() {
    for (const side of ["left", "right"]) {
      const diffEl = document.getElementById(`bc-gauge-diff-${side}`);
      if (diffEl) diffEl.innerHTML = "";
    }
  }

  // Compute + append one line to my own gauge's diff history for a resolved combat — shared
  // between the live notif_combatResolved handler and the F5-restore loop in setup() (which
  // replays stored combatResolved payloads in order — see Game::getAllDatas 'gauge_diff_history',
  // populated server-side by RevealAndResolve::recordGaugeDiffHistory).
  _recordGaugeDiffLine(args) {
    const rightPid = String(args.right_player_id);
    const leftPid = args.solo_combat ? null : String(args.left_player_id);
    const leftPos = args.solo_combat ? null : parseInt(args.left_position, 10);
    const rightPos = parseInt(args.right_position, 10);
    const lStr = args.left_strength ?? 0;
    const rStr = args.right_strength ?? 0;
    const isTie = lStr === rStr;

    let mySide = null;
    if (args.solo_combat) {
      mySide = this._gaugeMineSide(rightPid, rightPos);
    } else if (leftPid === this._gaugeAnchorPid()) {
      mySide = this._gaugeMineSide(leftPid, leftPos);
    } else if (rightPid === this._gaugeAnchorPid()) {
      mySide = this._gaugeMineSide(rightPid, rightPos);
    }
    if (!mySide) return;

    // Tie: gray "0" line, same permanent-history treatment as a real gap (used to be
    // skipped entirely, silently dropping the turn's line from the history).
    const winnerPid = isTie ? null : lStr > rStr ? leftPid : rightPid;
    const winnerHex = isTie ? "7f8c8d" : (winnerPid && this.gamedatas.players?.[winnerPid]?.color) || "7f8c8d";
    const diffEl = document.getElementById(`bc-gauge-diff-${mySide}`);
    if (!diffEl) return;
    const line = document.createElement("div");
    line.className = "bc-gauge-diff-line";
    line.textContent = isTie ? "0" : String(Math.abs(lStr - rStr));
    line.style.background = `#${winnerHex}`;
    diffEl.appendChild(line);
  }

  // Effect-resolution badges stay on cards permanently through the round (all 3 turns) —
  // cleared only here, at end of round (see notif_upgradeMainEntered).
  _clearEffectBadges() {
    document.querySelectorAll(".bc-effect-badge").forEach((el) => el.remove());
  }

  _placeBotCard(side, row, card, mode = null) {
    const flankSide = side === "right" ? "left" : "right";
    const flank = document.getElementById(`bc-flank-${flankSide}-${row}`);
    if (!flank) return;
    flank.innerHTML = this._cardHtml(card);
    if (card.type) this.bga.gameui?.addTooltipHtml?.(flank.id, this._cardTooltipHtml(card));
    if (mode === "flip") this._flipFlankIn(flank);
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
      this._updateFlankMirror(pid, pos, c, "slide");
    }
  }

  // Gem count changed (mulligan, produce, upgrade)
  async notif_gemUpdated(args) {
    await this._updateGemDisplay(String(args.player_id), args.charged, true);
  }

  // Current-row cards flipped face-up — 3D card flip via bga-cards setCardVisible.
  // No wobble here: each card wobbles individually when its notify fires (influence / combat).
  async notif_cardsRevealed(args) {
    // New row starting: clear both power gauges (R-5.13). Fires once per player, idempotent.
    this._resetGauges();

    const pid = String(args.player_id);
    for (const c of args.cards || []) {
      const pos = parseInt(c.position, 10);
      const cardObj = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family, position: pos };
      // Must await: setCardVisible() can swap in a new DOM element mid-flip, so reading
      // getCardElement() right after without waiting could grab the stale pre-flip node
      // (same fix as _buildHand's identical case).
      await this.cardManager.setCardVisible(cardObj, true);
      this._updateFlankMirror(pid, pos, c, "flip");
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

    const { name, desc } = this._influenceBadgeParts(args);

    this.bga.statusBar.setTitle(`${name} — ${desc}`);
    centerCell.querySelector(".bc-effect-badge")?.remove(); // this cell's badge from an earlier turn, if any
    const badge = document.createElement("div");
    badge.className = "bc-effect-badge";
    badge.textContent = desc; // name shown in the title bar above, not repeated on the card
    centerCell.appendChild(badge);

    // Badge stays on the card permanently (cleared only at end of round, see
    // _clearEffectBadges()) — the pause below is just pacing before the next notify.
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Pause before first effect badge (no announcement — see TODO.md)
  async notif_combatStarted(_args) {
    await new Promise((r) => setTimeout(r, 1500));
  }

  // One side's combat effect — brief badge on the card cell (and its flank mirror)
  async notif_combatEffectApplied(args) {
    let cell;
    let flankCell = null;
    if (args.solo_combat) {
      // Bot's own contribution (notifySoloCombatEffect): shown-as flank side feeds "theirs".
      const flankSide = args.bot_side === "right" ? "left" : "right";
      cell = document.getElementById(`bc-flank-${flankSide}-${args.bot_row}`);
      this._setGaugeMarker(flankSide, "theirs", args.final_strength);
    } else {
      // My own card (multiplayer or the player's side of a solo combat).
      const pid = String(args.player_id);
      const pos = parseInt(String(args.position), 10);
      cell = document.getElementById(`bc-cell-${pid}-${pos}`);
      flankCell = this._getFlankCell(pid, pos);

      const mineSide = this._gaugeMineSide(pid, pos);
      if (mineSide) this._setGaugeMarker(mineSide, "mine", args.final_strength);
      const rivalSide = this._gaugeRivalSide(pid, pos);
      if (rivalSide) this._setGaugeMarker(rivalSide, "theirs", args.final_strength);
    }
    if (!cell) return;
    const text = this._combatBadgeText(args);
    this.bga.statusBar.setTitle(text);
    cell.querySelector(".bc-effect-badge")?.remove(); // this cell's badge from an earlier turn, if any
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

    if (flankCell) {
      flankCell.querySelector(".bc-effect-badge")?.remove();
      const flankBadge = document.createElement("div");
      flankBadge.className = "bc-effect-badge";
      flankBadge.textContent = text;
      flankCell.appendChild(flankBadge);
      const flankCardEl = flankCell.querySelector(".bc-card");
      if (flankCardEl) {
        flankCardEl.classList.add("bc-card-activating");
        setTimeout(() => flankCardEl.classList.remove("bc-card-activating"), 350);
      }
    }

    // Badges stay on the cards permanently (cleared only at end of round, see
    // _clearEffectBadges()) — the pause below is just pacing before the next notify.
    await new Promise((r) => setTimeout(r, 1500));
  }

  // One combat result — show strength popups on border cards (and flank mirrors), fade the loser
  async notif_combatResolved(args) {
    const rightPid = String(args.right_player_id);
    const leftPid = args.solo_combat ? null : String(args.left_player_id);
    const leftPos = args.solo_combat ? null : parseInt(args.left_position, 10);
    const rightPos = parseInt(args.right_position, 10);
    const lStr = args.left_strength ?? 0;
    const rStr = args.right_strength ?? 0;

    let leftCardEl, rightCardEl;
    let leftFlankCardEl = null,
      rightFlankCardEl = null;

    if (args.solo_combat) {
      const botFlankSide = args.bot_side === "right" ? "left" : "right";
      const botCell = document.getElementById(`bc-flank-${botFlankSide}-${args.bot_row}`);
      leftCardEl = botCell?.firstElementChild ?? null;
      rightCardEl = document.getElementById(`bc-cell-${rightPid}-${rightPos}`)?.firstElementChild ?? null;
    } else {
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

    // Append a strength-gap line under my own gauge for this turn's combat (see
    // _recordGaugeDiffLine — shared with the F5-restore loop in setup()).
    this._recordGaugeDiffLine(args);

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

    await new Promise((r) => setTimeout(r, 1500));

    lBadge?.remove();
    rBadge?.remove();
    lFlankBadge?.remove();
    rFlankBadge?.remove();
    leftCardEl?.classList.remove("bc-card-loser");
    rightCardEl?.classList.remove("bc-card-loser");
    leftFlankCardEl?.classList.remove("bc-card-loser");
    rightFlankCardEl?.classList.remove("bc-card-loser");

    // VP for this combat is already awarded server-side by this point — drop the power
    // gauges back to 0 right away instead of leaving them showing the final tally until
    // the next reveal/Upgrade entry resets them.
    this._resetGauges();
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

    // Multiple tokens can land on the very same position in one sync batch (e.g. a gather
    // effect). _placeTokenAnimated/_placeToken each compute their 50%-overlap offset from a
    // live DOM read at call time, but when fired concurrently via Promise.all below, NONE of
    // them has appended its own div yet when the others read that count — every one in the
    // batch saw the same starting count and landed at the same offset, i.e. full overlap
    // instead of staggered. Precompute each one's offset up front instead, seeded from what's
    // already on screen, so the whole batch staggers correctly regardless of timing.
    const posOffsetSeed = {};
    for (const t of toAdd) {
      if (!(t.pos in posOffsetSeed)) {
        const cell = document.getElementById(`bc-cell-${pid}-${t.pos}`);
        posOffsetSeed[t.pos] = cell ? cell.querySelectorAll(".bc-token").length : 0;
      }
      t.offsetIndex = posOffsetSeed[t.pos]++;
    }

    if (toRemove.length === 0 && toAdd.length === 0) return;

    if (toRemove.length > 0 && toAdd.length > 0) {
      // Both a removal and an addition in the same sync only happens for a gather effect
      // (Cheater/Poker Face: existing tokens vanish from their old spots and a flipped
      // token appears at the target) — animate the old ones converging into the target
      // cell instead of vanishing-then-reappearing-from-the-top, so the absorption reads
      // as a single movement rather than two unrelated events.
      const targetCell = document.getElementById(`bc-cell-${pid}-${toAdd[0].pos}`);
      if (targetCell) {
        const toRect = targetCell.getBoundingClientRect();
        const toCx = toRect.left + toRect.width / 2;
        const toCy = toRect.top + toRect.height / 2;
        await Promise.all(
          toRemove.map(
            (el, i) =>
              new Promise((resolve) => {
                const from = el.getBoundingClientRect();
                const dx = toCx - (from.left + from.width / 2);
                const dy = toCy - (from.top + from.height / 2);
                const value = parseInt(el.dataset.tokenValue || "0", 10);
                const converge = () => {
                  el.style.transition = "transform 300ms ease-in, opacity 300ms ease-in";
                  el.style.transform = `translate(${dx}px, ${dy}px) scale(0.6)`;
                  el.style.opacity = "0";
                  el.style.zIndex = "50";
                  setTimeout(resolve, 320);
                };
                setTimeout(() => {
                  if (value < 0) {
                    // Rule text is "gather + flip to plus face" — flip this red token to its
                    // green face right as it starts converging, instead of it just shrinking
                    // away still showing red.
                    const s = this._gamblerTokenSprite(this._plusValueOf(value));
                    el.style.transition = "transform 150ms ease-in";
                    el.style.transform = "rotateY(90deg)";
                    setTimeout(() => {
                      el.style.backgroundPosition = `${s.x}px ${s.y}px`;
                      converge();
                    }, 150);
                  } else {
                    converge();
                  }
                }, i * 50);
              }),
          ),
        );
        toRemove.forEach((el) => el.remove());
        // Plain (non-animated) placement here, not _placeTokenAnimated — the old tokens just
        // converging into this exact spot above already conveyed "arriving from the field";
        // dropping the new consolidated token in from the top of the screen on top of that
        // read as two unrelated arrivals instead of one gather.
        toAdd.forEach((t) => this._placeToken(pid, t.pos, t.type, t.value, t.offsetIndex));
      } else {
        await Promise.all(toRemove.map((el) => this._animateTokenRemove(el)));
        await Promise.all(toAdd.map((t) => this._placeTokenAnimated(pid, t.pos, t.type, t.value, t.offsetIndex)));
      }
    } else {
      // Animate removed tokens sliding up, then add new ones sliding in from top
      await Promise.all(toRemove.map((el) => this._animateTokenRemove(el)));
      await Promise.all(toAdd.map((t) => this._placeTokenAnimated(pid, t.pos, t.type, t.value, t.offsetIndex)));
    }

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
        // Match the main cell's horizontal 50%-overlap offset (see _placeToken) — this
        // rebuild path was left on the old vertical-stack offset, so a gathered card's
        // tokens looked indistinguishable on the flank mirror even after that fix.
        clone.style.top = "3px";
        clone.style.right = `${3 + i * 30}px`;
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

  // New round started: update counters (R-4.4: no first-player marker, no turn order between players)
  async notif_roundStarted(args) {
    const roundEl = document.getElementById("bc-round-counter");
    if (roundEl) roundEl.textContent = args.round_number;
    const turnEl = document.getElementById("bc-turn-counter");
    if (turnEl) turnEl.textContent = args.turn_number;
    this._currentTurn = args.turn_number;
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
        // The real card elements live inside .bc-cell, which is overflow:hidden — animating
        // them in place clipped the flight the instant a card crossed its own cell's edge,
        // making it look like the card vanished on the spot instead of flying to the deck.
        // Animate a fixed-position ghost clone instead (same trick as _placeTokenAnimated's
        // ghost) and hide the real element immediately; it gets reset/reused afterward.
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
              const ghost = el.cloneNode(true);
              ghost.style.position = "fixed";
              ghost.style.left = `${from.left}px`;
              ghost.style.top = `${from.top}px`;
              ghost.style.width = `${from.width}px`;
              ghost.style.height = `${from.height}px`;
              ghost.style.margin = "0";
              ghost.style.zIndex = "200";
              document.body.appendChild(ghost);
              el.style.visibility = "hidden";
              setTimeout(() => {
                ghost.style.transition = "transform 350ms ease-in, opacity 350ms ease-in";
                ghost.style.transform = `translate(${dx}px,${dy}px) scale(0.55)`;
                ghost.style.opacity = "0";
                setTimeout(() => {
                  ghost.remove();
                  resolve();
                }, 360);
              }, i * 60);
            }),
        );
        await Promise.all(anims);
        await new Promise((r) => setTimeout(r, 60));

        // Shuffle wiggle needs an actual visible card to shake — at this point deckTarget is
        // just the empty hand-area container (the real #bc-deck-pile-{pid} div is only built
        // later by _buildHand), and BgaCards.AllVisibleDeck had no cards ever added to it
        // (nothing to animate), so the whole shuffle used to play on nothing visible at all.
        // Build a throwaway placeholder pile with that same id instead — _buildHand already
        // removes/replaces any existing #bc-deck-pile-{pid} before dealing the hand right
        // after this notif, so it's cleaned up automatically.
        let shufflePile = document.getElementById(`bc-deck-pile-${pid}`);
        if (!shufflePile) {
          const family = parseInt(String(this.gamedatas.players?.[pid]?.family ?? 0), 10);
          deckTarget.insertAdjacentHTML("beforeend", `<div class="bc-deck-pile" id="bc-deck-pile-${pid}">${this._cardHtml({ family })}</div>`);
          shufflePile = document.getElementById(`bc-deck-pile-${pid}`);
        }
        // Plain CSS wiggle on that pile (a real Deck.shuffle() needs tracked card elements we
        // don't have here — this is a flourish, not an actual managed stock).
        for (const [angle, dur] of [[5, 80], [-5, 80], [3, 70], [-3, 70], [0, 70]]) {
          shufflePile.style.transition = `transform ${dur}ms ease-in-out`;
          shufflePile.style.transform = `rotate(${angle}deg)`;
          await new Promise((r) => setTimeout(r, dur + 15));
        }
        shufflePile.style.transform = "";
        await new Promise((r) => setTimeout(r, 100));

        // bga-cards' CardManager reuses the same DOM element for a card id across stocks
        // (needed for move animations) — it does NOT reset inline styles on its own. Left
        // as-is, the transform/opacity/z-index set above would still be sitting on these
        // elements when the SAME card ids reappear in the new hand a moment later (via
        // _buildHand), making them render stacked/misplaced until a fresh page load (F5)
        // recreated everything from scratch. This was the "first hand after reshuffle"
        // display bug — clear them explicitly before the elements get reused. visibility is
        // reset too: the ghost-clone flight above hides the real element for the animation.
        for (const card of cards) {
          const el = this.cardManager.getCardElement(card);
          if (!el) continue;
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
          el.style.zIndex = "";
          el.style.visibility = "";
          // Same reuse hazard as above but for the mobile grid-crop forced properties
          // (_watchMobileGridCardWidth): these cards are heading to the deck, then straight
          // back out into the hand — cleared here too, belt-and-braces with _buildHand's
          // own clear right before dealing.
          el.style.removeProperty("width");
          el.style.removeProperty("--bga-cards_card-width");
          el.style.removeProperty("--bga-cards_card-effective-width");
        }
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
    this._placeBotCard(args.side, args.row, args.card, "flip");
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
  async notif_botUpgraded(args) {
    for (let row = 0; row < 3; row++) {
      const left = document.getElementById(`bc-flank-left-${row}`);
      if (left) left.innerHTML = "";
      const right = document.getElementById(`bc-flank-right-${row}`);
      if (right) right.innerHTML = "";
    }

    const removed = args.removed || [];
    const added   = args.added   || null;
    if (removed.length > 0 || added) {
      const removedNames = removed.map(c => this._cardName(c.type, c.type_arg)).join(", ");
      const addedName    = added ? this._cardName(added.type, added.type_arg) : "—";
      console.log(`[Bot upgrade] Removed: ${removedNames} → Added: ${addedName}`);
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

    // Slide left + fade toward the next player (the incoming cards from the previous
    // player slide in from the right — see _build()'s entry animation).
    const outEls = remaining.map((c) => this.cardManager.getCardElement(c)).filter(Boolean);
    if (outEls.length > 0) {
      outEls.forEach((el, i) => {
        el.style.transition = `transform 0.3s ${i * 60}ms ease-in, opacity 0.3s ${i * 60}ms ease-in`;
        el.style.transform = "translateX(-80px)";
        el.style.opacity = "0";
      });
      await new Promise((r) => setTimeout(r, 300 + outEls.length * 60));
      // These 2 unchosen cards get passed on (next player's hand, or one becomes the
      // draft's "last card" auto-added to a deck) — bga-cards reuses the same DOM element
      // by id, and removeAll() does not clear inline styles on its own, so left as-is this
      // translateX(-80px)/opacity:0 stuck around and reappeared as an offset/invisible
      // ghost wherever that card turned up next (e.g. stacked into the deck fan). Same fix
      // as notif_deckShuffled / notif_silverDraftComplete's fan cleanup.
      outEls.forEach((el) => {
        el.style.transition = "";
        el.style.transform = "";
        el.style.opacity = "";
      });
    }
    await handStock.removeAll();

    // _build() fires next (via onPlayerActivationChange or notif_draftCardsDealt)
    // and will slide in the new cards with its own animation.
  }

  // Private: the last unchosen card from pass 2 was auto-added to this player's deck.
  // Choreography: arrive in hand (slide in from the right, like a normal deal), pause
  // 3s to read it, then slide into the deck fan STILL FACE UP. Left un-flipped on purpose:
  // it lands last in the fan stock's card order, so notif_silverDraftComplete's own
  // staggered flip-down sequence (which flips every fan card in array order) naturally
  // flips it last — flipping it here too made it flip down right away, effectively
  // together with that sequence's first card instead of properly last in the whole show.
  async notif_silverLastCardReceived(args) {
    const c = args.card;
    const cardObj = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family };
    const fanStock = this.silverDraft._draftFanStock;
    if (!fanStock) return;

    const handStock = this._handStocks[this._myPid];
    let inHand = handStock?.getCards().find((card) => card.id === c.id);

    if (!inHand && handStock) {
      // Multiplayer: card was in another player's hand — bring it into mine first
      // so the same arrive/read/flip/slide choreography applies for everyone.
      await handStock.addCard(cardObj);
      inHand = cardObj;
      const el = this.cardManager.getCardElement(cardObj);
      if (el) {
        el.classList.add("bc-draft-card");
        el.style.transform = "translateX(80px)";
        el.style.opacity = "0";
        void el.offsetWidth; // force reflow
        el.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
        el.style.transform = "";
        el.style.opacity = "";
        this.cardManager.setCardVisible(cardObj, true);
      }
    }

    if (inHand) {
      this.bga.statusBar.setTitle(_("Last Silver card of the draft…"));
      await new Promise((r) => setTimeout(r, 3000)); // read it face up
      await fanStock.addCard(inHand, { fromStock: handStock }); // slide to deck, stays face up
      const el = this.cardManager.getCardElement(inHand);
      el?.classList.remove("bc-draft-card", "bc-card-selected");
      if (el?.id) this.bga.gameui?.addTooltipHtml?.(el.id, this._cardTooltipHtml(inHand));
    } else {
      await fanStock.addCard(cardObj);
      const el = this.cardManager.getCardElement(cardObj);
      if (el?.id) this.bga.gameui?.addTooltipHtml?.(el.id, this._cardTooltipHtml(cardObj));
    }
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

        // 3. Fold the fan container down to one card's height — the stack transform above
        // is paint-only, it doesn't shrink the fan's own box (still sized for the spread-out
        // negative-margin layout).
        const fanEl = document.getElementById(`bc-draft-fan-${this._myPid}`);
        if (fanEl) {
          const cardH = els[0].getBoundingClientRect().height;
          fanEl.style.overflow = "hidden";
          fanEl.style.transition = "height 0.25s ease-in";
          fanEl.style.height = `${cardH}px`;
          await new Promise((r) => setTimeout(r, 260));
        }

        // 4. Shuffle wobble, fade out, then fully remove the deck area — this used to be
        // deferred to notif_handDealt (first Deploy entry), which left the folded block
        // lingering on screen for the whole draft→deploy transition ("il reste le bloc
        // bc-draft-deck à faire disparaître").
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
        // bga-cards reuses the same DOM element by id later (e.g. this same card ending up
        // in a hand) — clear the stacking transform before removeAll() or it reappears
        // offset/ghosted (same fix as the round-end deck shuffle / draft-pass cleanup).
        for (const card of cards) {
          const el = this.cardManager.getCardElement(card);
          if (!el) continue;
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
        }
        await fanStock.removeAll();
        this.silverDraft._draftFanStock = null;
        document.getElementById(`bc-draft-deck-${this._myPid}`)?.remove();
      }
    }
    document.getElementById("bc-draft-ui")?.remove();
    this.silverDraft._confirmedThisSession = false;
    console.log("[bc] Silver draft complete — deck folded, shuffled, and removed");
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

  // Cabin Boy (1:5) flipped face-down during combat — animate the flip and update the flank mirror
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

    // The Silver Draft deck area's shuffle-and-remove now happens right at
    // notif_silverDraftComplete() (so it doesn't linger on screen through the whole
    // draft→deploy transition) — nothing left to animate here.
    await this.deploy._buildHand(args.hand || [], args.deck_count || 0, args.gems_charged || 0);
  }

  // Private: UpgradeMain entered — send center cards + options to player.
  // Authoritative path for private state args delivery.
  async notif_upgradeMainEntered(args) {
    console.log("[DBG notif_upgradeMainEntered] center_cards=", JSON.stringify(args.center_cards), "placed_cards=", JSON.stringify(args.placed_cards), "upgrade_options keys=", Object.keys(args.upgrade_options || {}));
    // Round's points are now distributed (Upgrade phase starts right after the last
    // turn's scoring) — drop gauge tokens back to 0 and clear the effect-resolution badges.
    this._resetGauges();
    this._clearEffectBadges();
    this._clearGaugeDiffHistory();
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

  // Private: reroll discarded the 3 options and drew 3 new ones — same state, fresh options.
  async notif_upgradeOptionsRerolled(args) {
    console.log("[UpgradePickReplacement] notif_upgradeOptionsRerolled", args);
    this.upgradePickReplacement._teardown();
    this.upgradePickReplacement._applyArgs(args);
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
    if (!gridStock) return;
    const origId = parseInt(String(args.orig_card_id), 10);
    const chosenId = parseInt(String(args.chosen_id), 10);
    const pos = parseInt(String(args.position), 10);
    const family = parseInt(String(args.family ?? 1), 10);

    // Flip-then-slide flourish: the chosen option (still shown face-up in the hand-area
    // options panel) flips to its face-down back, then slides into the grid cell the upgraded
    // card just vacated — previously the replacement just silently appeared there via
    // addCard() with no transition at all.
    const optEl = document.getElementById(`bc-upgrade-opt-${chosenId}`);
    const targetCell = document.getElementById(`bc-cell-${pid}-${pos}`);
    if (optEl && targetCell) {
      const from = optEl.getBoundingClientRect();
      const to = targetCell.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const ghost = document.createElement("div");
      ghost.className = optEl.className;
      ghost.style.cssText = optEl.style.cssText;
      ghost.style.position = "fixed";
      ghost.style.left = `${from.left}px`;
      ghost.style.top = `${from.top}px`;
      ghost.style.width = `${from.width}px`;
      ghost.style.height = `${from.height}px`;
      ghost.style.margin = "0";
      ghost.style.zIndex = "200";
      document.body.appendChild(ghost);
      optEl.style.visibility = "hidden";
      void ghost.offsetWidth;

      // Phase 1: flip to edge-on
      ghost.style.transition = "transform 180ms ease-in";
      ghost.style.transform = "rotateY(90deg)";
      await new Promise((r) => setTimeout(r, 180));

      // Swap to the face-down back sprite at the midpoint (same markup as _cardHtml's
      // face-down cards) — this is a flat cloned div, not a real bga-cards managed element,
      // so its own front/back divs don't exist to flip between.
      ghost.className = "bc-card bc-card-sprite";
      ghost.style.setProperty("--sprite-x", `${-(17 * 167)}px`);
      ghost.style.setProperty("--sprite-y", `${-((family - 1) * 119)}px`);

      // Phase 2: slide to the vacated grid cell while flipping back to face-on
      ghost.style.transition = "transform 300ms ease-out";
      ghost.style.transform = `translate(${dx}px, ${dy}px) rotateY(0deg)`;
      await new Promise((r) => setTimeout(r, 300));
      ghost.remove();
    }

    const origCard = gridStock.getCards().find((c) => c.id === origId);
    if (origCard) await gridStock.removeCard(origCard);
    const existing = gridStock.getCards().find((c) => c.id === chosenId);
    if (!existing) await gridStock.addCard({ id: chosenId, position: pos, family });
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
    const gridStock = this._gridStocks[this.deploy._myPid];
    // The discarded card can currently be sitting in either stock: a hand card mulligans
    // straight from hand, but one already assigned to this turn's row (still 'hand' server-side
    // until Confirm) was moved into gridStock client-side, so look there first.
    const inGrid = gridStock?.getCards().find((c) => c.id === discardedId);
    const discardedCard = inGrid || handStock?.getCards().find((c) => c.id === discardedId);
    const sourceStock = inGrid ? gridStock : handStock;

    if (discardedCard) {
      // Clean up slot state
      const assignedSlot = this.deploy._cardSlot[discardedId];
      if (assignedSlot) {
        this.deploy._slots[assignedSlot] = null;
        delete this.deploy._cardSlot[discardedId];
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

      await sourceStock.removeCard(discardedCard);
    }

    const c = args.new_card;
    if (c && handStock) {
      const newCard = { id: c.id, type: c.type, type_arg: c.type_arg, family: c.family };
      const deckEl = document.getElementById(`bc-deck-pile-${this.deploy._myPid}`);
      await handStock.addCard(newCard, deckEl ? { fromElement: deckEl } : undefined);
      const newEl = this.cardManager.getCardElement(newCard);
      if (newEl) {
        newEl.classList.add("bc-hand-card");
        newEl.dataset.cardId = String(newCard.id); // clicks handled by the delegated listener bound in Deploy._build()
        if (newEl?.id) this.bga.gameui?.addTooltipHtml?.(newEl.id, this._cardTooltipHtml(newCard));
      }
      this.deploy._refreshHandCardAttrs();
    }
  }
}
