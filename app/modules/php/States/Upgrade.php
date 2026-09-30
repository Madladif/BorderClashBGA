<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

class Upgrade extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 40,
            type: StateType::MULTIPLE_ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} is upgrading their cards'),
            descriptionMyTurn: clienttranslate('${you} must upgrade your cards'),
            initialPrivate: UpgradeMain::class,
        );
    }

    // Runs once when entering the state:
    // 1. Delete all tokens
    // 2. Flip border cards face-down (only center column stays face-up)
    // 3. Pre-draw 3 upgrade options per face-up center card per player (private)
    // 4. Initialize private parallel states so each player enters UpgradeMain independently
    public function onEnteringState(): void
    {
        $this->gamestate->setAllPlayersMultiactive();

        $round       = (int)($this->game->bga->globals->get('round_number') ?? 1);
        $playerOrder = (array)($this->game->bga->globals->get('player_order') ?? []);

        // Idempotency guard: skip setup if already prepared for this round
        if ((int)($this->game->bga->globals->get('upgrade_round') ?? 0) !== $round) {
            $this->game->bga->globals->set('upgrade_round', $round);

            // Step 1: Clear all tokens
            $this->game->DbQuery("DELETE FROM bc_token");
            $this->game->bga->notify->all('tokensCleared', '', []);

            // Effect-resolution badges and gauge strength-gap history are cleared once per
            // round too (client already clears them on notif_upgradeMainEntered; this keeps
            // the F5-restore snapshot in sync).
            $this->game->bga->globals->set('effect_badges', []);
            $this->game->bga->globals->set('gauge_diff_history', []);

            // Step 2: Flip border cards face-down (positions 0,2,3,5,6,8 — all except center 1,4,7)
            foreach ($playerOrder as $rawPid) {
                $pid = (int)$rawPid;
                $this->game->DbQuery(
                    "UPDATE bc_card SET card_face_up = 0
                     WHERE card_location = 'grid_{$pid}'
                       AND card_location_arg NOT IN (1, 4, 7)"
                );
            }

            // Step 3: Pre-draw 3 upgrade options per face-up center card
            $allOptions = [];
            foreach ($playerOrder as $rawPid) {
                $pid         = (int)$rawPid;
                $centerCards = $this->game->getCollectionFromDb(
                    "SELECT card_id AS id, card_type AS type
                     FROM bc_card
                     WHERE card_location = 'grid_{$pid}'
                       AND card_location_arg IN (1, 4, 7)
                       AND card_face_up = 1"
                );

                $playerOptions = [];
                foreach ($centerCards as $card) {
                    $cardType = (int)$card['type'];
                    if ($cardType === Game::RANK_GOLD) {
                        continue; // Gold is the max rank — no further upgrade options
                    }
                    $nextPile = $cardType === Game::RANK_BRONZE ? 'shared_silver' : 'shared_gold';

                    $optRows = $this->game->getCollectionFromDb(
                        "SELECT card_id FROM bc_card
                         WHERE card_location = '{$nextPile}'
                         ORDER BY RAND() LIMIT 3"
                    );
                    $optionIds = array_map('intval', array_keys($optRows));

                    if (!empty($optionIds)) {
                        $idsStr = implode(',', $optionIds);
                        $this->game->DbQuery(
                            "UPDATE bc_card
                             SET card_location = 'upgrade_options', card_location_arg = {$pid}
                             WHERE card_id IN ({$idsStr})"
                        );
                    }
                    $playerOptions[(int)$card['id']] = $optionIds;
                }
                $allOptions[$pid] = $playerOptions;
            }
            $this->game->bga->globals->set('upgrade_options', $allOptions);
        }

        // Enter private parallel states — each player gets their own independent UpgradeMain state
        $this->gamestate->initializePrivateStateForAllActivePlayers();
    }

    public function zombie(int $playerId): string
    {
        $pid          = (int)$playerId;
        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);

        $centerCards = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );

        foreach (array_keys($centerCards) as $rawCardId) {
            $cardId = (int)$rawCardId;
            $this->game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$cardId}");
            if ($this->game->gemsUncharged->get($pid) > 0) {
                $this->game->gemsCharged->inc($pid, 1, null);
                $this->game->gemsUncharged->inc($pid, -1, null);
            }
            $optIds = array_map('intval', (array)($myOptionsMap[(string)$cardId] ?? $myOptionsMap[$cardId] ?? []));
            foreach ($optIds as $oid) {
                $card = $this->game->getObjectFromDB("SELECT card_type FROM bc_card WHERE card_id = {$oid}");
                if (!$card) continue;
                $pile = match((int)$card['card_type']) {
                    Game::RANK_SILVER => 'shared_silver',
                    Game::RANK_GOLD   => 'shared_gold',
                    default           => 'shared_silver',
                };
                $this->game->DbQuery(
                    "UPDATE bc_card SET card_location = '{$pile}', card_location_arg = 0, card_face_up = 0
                     WHERE card_id = {$oid}"
                );
            }
        }

        unset($allOptions[$pid]);
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        $this->game->bga->notify->all('upgradeConfirmed',
            clienttranslate('${player_name} confirms their upgrades'), [
                'player_id'      => $pid,
                'player_name'    => $this->game->getPlayerNameById($pid),
                'produced_count' => count($centerCards),
                'upgraded_count' => 0,
                'produced_ids'   => array_map('intval', array_keys($centerCards)),
                'upgraded_ids'   => [],
                'placed_cards'   => [],
            ]
        );

        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        return NextRound::class;
    }
}
