<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\borderclash\Game;

class Deploy extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 10, type: StateType::MULTIPLE_ACTIVE_PLAYER);
    }

    // Draw 3 cards from each player's deck to their hand when the state is entered.
    // Idempotent: skips any player whose hand is already non-empty (handles re-entry).
    // In solo mode, also places all 6 bot cards face-down at the start of each round.
    public function onEnteringState()
    {
        $this->gamestate->setAllPlayersMultiactive();

        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        foreach (array_keys($players) as $playerId) {
            $pid      = (int)$playerId;
            $countRow = $this->game->getObjectFromDB(
                "SELECT COUNT(*) AS cnt FROM bc_card
                 WHERE card_location = 'hand' AND card_location_arg = {$pid}"
            );
            if ((int)($countRow['cnt'] ?? 0) !== 0) {
                continue;
            }
            $rows = $this->game->getCollectionFromDb(
                "SELECT card_id FROM bc_card
                 WHERE card_location = 'deck' AND card_location_arg = {$pid}
                 ORDER BY RAND() LIMIT 3"
            );
            if (empty($rows)) {
                continue;
            }
            $cardIds = implode(',', array_map('intval', array_keys($rows)));
            $this->game->DbQuery(
                "UPDATE bc_card SET card_location = 'hand'
                 WHERE card_id IN ({$cardIds})"
            );
        }

        // Solo: distribute bot cards at the start of each round (turn == 1 only)
        $isSolo = (bool)($this->game->bga->globals->get('is_solo') ?? false);
        if ($isSolo) {
            $turn = (int)($this->game->bga->globals->get('turn_number') ?? 1);
            if ($turn === 1) {
                $this->deployBotCards();
            }
        }
    }

    private function deployBotCards(): void
    {
        // Idempotency: already placed this round?
        $check = $this->game->getObjectFromDB(
            "SELECT card_id FROM bc_card WHERE card_location = 'bot_grid_left' LIMIT 1"
        );
        if (!empty($check)) {
            return;
        }

        $deck = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'bot_deck'
             ORDER BY RAND()"
        );
        $cardIds = array_map('intval', array_keys($deck));
        $total   = count($cardIds);

        // Distribute up to 3 cards per column (bot deck may be < 6 after upgrades)
        $leftCount  = min(3, $total);
        $rightCount = min(3, max(0, $total - $leftCount));

        for ($row = 0; $row < $leftCount; $row++) {
            $cid = $cardIds[$row];
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'bot_grid_left', card_location_arg = {$row}, card_face_up = 0
                 WHERE card_id = {$cid}"
            );
        }
        for ($row = 0; $row < $rightCount; $row++) {
            $cid = $cardIds[$leftCount + $row];
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'bot_grid_right', card_location_arg = {$row}, card_face_up = 0
                 WHERE card_id = {$cid}"
            );
        }

        $this->game->bga->notify->all(
            'botCardsDeployed',
            clienttranslate('The bot deploys its cards'),
            ['left_count' => $leftCount, 'right_count' => $rightCount]
        );
    }

    // Returns the current player's hand + gem count (private — called per active player).
    public function getArgs(?int $currentPlayerId = null): array
    {
        if ($currentPlayerId === null) {
            return [];
        }
        return [
            'hand'         => array_values($this->game->getCollectionFromDb(
                "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
                 FROM bc_card
                 WHERE card_location = 'hand' AND card_location_arg = {$currentPlayerId}"
            )),
            'gems_charged' => $this->game->gemsCharged->get($currentPlayerId),
        ];
    }

    // Place 3 hand cards face-down in the grid at the current row.
    // col1 = left border, col2 = center, col3 = right border.
    #[PossibleAction]
    public function actDeployCards(int $col1CardId, int $col2CardId, int $col3CardId)
    {
        $pid        = (int)$this->game->getCurrentPlayerId();
        $turnNumber = (int)($this->game->bga->globals->get('turn_number') ?? 1);
        $row        = $turnNumber - 1; // row 0 = turn 1, row 1 = turn 2, row 2 = turn 3

        if (count(array_unique([$col1CardId, $col2CardId, $col3CardId])) !== 3) {
            throw new UserException("All three cards must be different");
        }

        $gridLocation = "grid_{$pid}";
        $placements   = [
            [$col1CardId, $row * 3 + 0],
            [$col2CardId, $row * 3 + 1],
            [$col3CardId, $row * 3 + 2],
        ];

        foreach ($placements as [$cardId, $position]) {
            $check = $this->game->getObjectFromDB(
                "SELECT card_id FROM bc_card
                 WHERE card_id = {$cardId}
                   AND card_location = 'hand'
                   AND card_location_arg = {$pid}"
            );
            if (!$check) {
                throw new UserException("Card {$cardId} is not in your hand");
            }
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = '{$gridLocation}',
                     card_location_arg = {$position},
                     card_face_up = 0
                 WHERE card_id = {$cardId}"
            );
        }

        $this->game->bga->notify->all('cardsDeployed', clienttranslate('${player_name} deploys 3 cards'), [
            'player_id'   => $pid,
            'player_name' => $this->game->getPlayerNameById($pid),
            'cards'       => [
                ['id' => $col1CardId, 'position' => $row * 3 + 0],
                ['id' => $col2CardId, 'position' => $row * 3 + 1],
                ['id' => $col3CardId, 'position' => $row * 3 + 2],
            ],
        ]);

        return RevealAndResolve::class;
    }

    // Spend 1 charged gem: return a hand card to the deck, draw a replacement.
    // Does NOT end the player's turn — returns nothing so the player stays active.
    #[PossibleAction]
    public function actMulligan(int $cardId)
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        if ($this->game->gemsCharged->get($pid) <= 0) {
            throw new UserException("No charged gems available for mulligan");
        }

        $check = $this->game->getObjectFromDB(
            "SELECT card_id FROM bc_card
             WHERE card_id = {$cardId}
               AND card_location = 'hand'
               AND card_location_arg = {$pid}"
        );
        if (!$check) {
            throw new UserException("Card {$cardId} is not in your hand");
        }

        // Discharge one gem
        $this->game->gemsCharged->inc($pid, -1, null);
        $this->game->gemsUncharged->inc($pid, 1, null);
        $this->game->bga->playerStats->inc('mulligans_used', 1, $pid);

        // Return card to deck
        $this->game->DbQuery(
            "UPDATE bc_card SET card_location = 'deck', card_face_up = 0
             WHERE card_id = {$cardId}"
        );

        // Draw 1 new card from deck (may draw the same card back if deck had only 1 card)
        $newCard = $this->game->getObjectFromDB(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
             FROM bc_card
             WHERE card_location = 'deck' AND card_location_arg = {$pid}
             ORDER BY RAND() LIMIT 1"
        );
        if ($newCard) {
            $this->game->DbQuery(
                "UPDATE bc_card SET card_location = 'hand'
                 WHERE card_id = {$newCard['id']}"
            );
        }

        // Public: log the mulligan and update gem display for all
        $this->game->bga->notify->all('gemUpdated', clienttranslate('${player_name} mulligans a card'), [
            'player_id'   => $pid,
            'player_name' => $this->game->getPlayerNameById($pid),
            'charged'     => $this->game->gemsCharged->get($pid),
            'uncharged'   => $this->game->gemsUncharged->get($pid),
        ]);

        // Private: send new card data only to the current player
        if ($newCard) {
            $this->game->bga->notify->player($pid, 'mulliganCard', '', [
                'discarded_card_id' => $cardId,
                'new_card'          => [
                    'id'       => (int)$newCard['id'],
                    'type'     => (int)$newCard['type'],
                    'type_arg' => (int)$newCard['type_arg'],
                    'family'   => (int)$newCard['family'],
                ],
            ]);
        }
        // No return → player stays active in Deploy state
    }

    // Auto-deploy 3 random hand cards for a zombie (disconnected) player.
    public function zombie(int $playerId)
    {
        $pid        = (int)$playerId;
        $turnNumber = (int)($this->game->bga->globals->get('turn_number') ?? 1);
        $row        = $turnNumber - 1;

        $rows    = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'hand' AND card_location_arg = {$pid}
             ORDER BY RAND() LIMIT 3"
        );
        $cardIds = array_map('intval', array_keys($rows));

        if (count($cardIds) < 3) {
            return RevealAndResolve::class;
        }

        $gridLocation = "grid_{$pid}";
        foreach (array_values($cardIds) as $i => $cid) {
            $position = $row * 3 + $i;
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = '{$gridLocation}',
                     card_location_arg = {$position},
                     card_face_up = 0
                 WHERE card_id = {$cid}"
            );
        }

        $this->game->bga->notify->all('cardsDeployed', clienttranslate('${player_name} deploys 3 cards'), [
            'player_id'   => $pid,
            'player_name' => $this->game->getPlayerNameById($pid),
            'cards'       => [
                ['id' => $cardIds[0], 'position' => $row * 3 + 0],
                ['id' => $cardIds[1], 'position' => $row * 3 + 1],
                ['id' => $cardIds[2], 'position' => $row * 3 + 2],
            ],
        ]);

        return RevealAndResolve::class;
    }
}
