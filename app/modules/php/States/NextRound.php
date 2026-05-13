<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

class NextRound extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 50, type: StateType::GAME);
    }

    public function onEnteringState()
    {
        $playerOrder = (array)($this->game->bga->globals->get('player_order') ?? []);
        $round       = (int)($this->game->bga->globals->get('round_number') ?? 1);
        $isSolo      = (bool)($this->game->bga->globals->get('is_solo') ?? false);

        // Solo: run bot upgrade (reads from bot_grid before clearing), then collect bot grid
        if ($isSolo) {
            $this->upgradeBotDeck();
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'bot_deck', card_location_arg = 0, card_face_up = 0
                 WHERE card_location IN ('bot_grid_left', 'bot_grid_right')"
            );
            // Clear bot tokens
            $this->game->DbQuery("DELETE FROM bc_token WHERE player_id = 0");
            $this->game->bga->notify->all('botUpgraded', clienttranslate('The bot upgrades its deck'), []);
        }

        // Return all remaining grid cards to each player's deck (face-down).
        // Tokens and border-card flipping were already handled by Upgrade.
        foreach ($playerOrder as $rawPid) {
            $pid = (int)$rawPid;
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'deck', card_location_arg = {$pid}, card_face_up = 0
                 WHERE card_location = 'grid_{$pid}'"
            );
            $this->game->bga->notify->all('deckShuffled', '', ['player_id' => $pid]);
        }

        // Advance round, reset turn to 1
        $this->game->bga->globals->set('round_number', $round + 1);
        $this->game->bga->globals->set('turn_number', 1);

        // Rotate first player anticlockwise (shift player_order left by 1)
        $newOrder = $playerOrder;
        if (count($playerOrder) > 1) {
            $newOrder = array_merge(array_slice($playerOrder, 1), array_slice($playerOrder, 0, 1));
            $this->game->bga->globals->set('player_order', $newOrder);
            $this->game->bga->globals->set('turn_order_start_id', (int)$newOrder[0]);
        }

        $this->game->bga->tableStats->inc('rounds_played', 1);

        $this->game->bga->notify->all('roundStarted',
            clienttranslate('Round ${round_number} begins'), [
                'round_number'    => $round + 1,
                'turn_number'     => 1,
                'first_player_id' => (int)$newOrder[0],
            ]
        );

        return Deploy::class;
    }

    // Bot upgrade: shuffle deck + grid, pick 2 non-Gold, return them, draw 1 higher rank.
    // Must be called BEFORE clearing the bot grid back to bot_deck.
    private function upgradeBotDeck(): void
    {
        $allRows = $this->game->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type
             FROM bc_card
             WHERE card_location IN ('bot_grid_left', 'bot_grid_right', 'bot_deck')"
        );
        if (empty($allRows)) {
            return;
        }

        // Pick 2 non-Gold at random (skip Gold; give up if not enough non-Gold)
        $ids = array_keys($allRows);
        shuffle($ids);
        $nonGoldIds = [];
        foreach ($ids as $rawId) {
            if (count($nonGoldIds) >= 2) {
                break;
            }
            if ((int)$allRows[$rawId]['type'] !== 3) {
                $nonGoldIds[] = (int)$rawId;
            }
        }
        if (count($nonGoldIds) < 2) {
            return; // All Gold cards — no upgrade possible
        }

        // Determine the next rank (highest rank of the 2 removed cards + 1, capped at Gold)
        $maxRank  = 0;
        foreach ($nonGoldIds as $cid) {
            $maxRank = max($maxRank, (int)$allRows[$cid]['type']);
        }
        $nextRank = min($maxRank + 1, 3);
        $piles    = [1 => 'shared_bronze', 2 => 'shared_silver', 3 => 'shared_gold'];

        // Return 2 non-Gold cards to their shared piles
        foreach ($nonGoldIds as $cid) {
            $pile = $piles[(int)$allRows[$cid]['type']];
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = '{$pile}', card_location_arg = 0, card_face_up = 0
                 WHERE card_id = {$cid}"
            );
        }

        // Draw 1 card from the next-rank shared pile into bot_deck
        $newCard = $this->game->getObjectFromDB(
            "SELECT card_id FROM bc_card
             WHERE card_location = '{$piles[$nextRank]}'
             ORDER BY RAND() LIMIT 1"
        );
        if (!empty($newCard)) {
            $ncid = (int)$newCard['card_id'];
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'bot_deck', card_location_arg = 0
                 WHERE card_id = {$ncid}"
            );
        }
    }
}
