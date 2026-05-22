<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\borderclash\Game;

class UpgradeMain extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 41, type: StateType::PRIVATE);
    }

    // Send private args to this player: center cards, options, gems, pending upgrades in progress.
    public function onEnteringState(int $playerId): void
    {
        $this->game->bga->notify->player($playerId, 'upgradeMainEntered', '', $this->getArgs($playerId));
    }

    public function getArgs(int $playerId): array
    {
        $pid = $playerId;

        $centerCards = array_values($this->game->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family, card_location_arg AS position
             FROM bc_card
             WHERE card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        ));

        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);

        $upgradeOptions = [];
        foreach ($myOptionsMap as $origCardId => $optionIds) {
            $details = [];
            foreach ($optionIds as $oid) {
                $row = $this->game->getObjectFromDB(
                    "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                            card_family AS family
                     FROM bc_card WHERE card_id = {$oid}"
                );
                if ($row) {
                    $details[] = [
                        'id'       => (int)$row['id'],
                        'type'     => (int)$row['type'],
                        'type_arg' => (int)$row['type_arg'],
                        'family'   => (int)$row['family'],
                    ];
                }
            }
            $upgradeOptions[(int)$origCardId] = $details;
        }

        // Cards already produced in this upgrade phase (flipped face-down by actFlipDown)
        $allProduced = (array)($this->game->bga->globals->get('upgrade_produced') ?? []);
        $myProduced  = (array)($allProduced[$pid] ?? []);

        // Cards already upgraded (sent to UpgradePickReplacement or done)
        $allUpgraded = (array)($this->game->bga->globals->get('upgrade_done') ?? []);
        $myUpgraded  = (array)($allUpgraded[$pid] ?? []);

        return [
            'center_cards'    => $centerCards,
            'upgrade_options' => $upgradeOptions,
            'gems_charged'    => $this->game->gemsCharged->get($pid),
            'gems_uncharged'  => $this->game->gemsUncharged->get($pid),
            'produced_ids'    => array_values($myProduced),
            'upgraded_ids'    => array_values($myUpgraded),
        ];
    }

    // Player flips one center card face-down and gains 1 gem.
    #[PossibleAction]
    public function actFlipDown(int $cardId): void
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        // Validate card belongs to player's center
        $card = $this->game->getObjectFromDB(
            "SELECT card_id, card_face_up, card_location_arg AS position
             FROM bc_card
             WHERE card_id = {$cardId}
               AND card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );
        if (!$card) {
            throw new UserException("Invalid card for flip");
        }

        // Flip face-down
        $this->game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$cardId}");

        // Charge 1 gem if possible
        if ($this->game->gemsUncharged->get($pid) > 0) {
            $this->game->gemsCharged->inc($pid, 1, null);
            $this->game->gemsUncharged->inc($pid, -1, null);
        }

        // Return this card's options to shared pile
        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);
        $this->returnOptionsToPile($myOptionsMap[(string)$cardId] ?? $myOptionsMap[$cardId] ?? []);
        unset($myOptionsMap[$cardId], $myOptionsMap[(string)$cardId]);
        $allOptions[$pid] = $myOptionsMap;
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        // Track produced card
        $allProduced         = (array)($this->game->bga->globals->get('upgrade_produced') ?? []);
        $myProduced          = (array)($allProduced[$pid] ?? []);
        $myProduced[]        = $cardId;
        $allProduced[$pid]   = $myProduced;
        $this->game->bga->globals->set('upgrade_produced', $allProduced);

        // Notify: flip + gem
        $this->game->bga->notify->all('upgradeFlipDown', '', [
            'player_id' => $pid,
            'card_id'   => $cardId,
            'position'  => (int)$card['position'],
        ]);
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        $this->game->bga->playerStats->inc('cards_produced', 1, $pid);

        $this->checkDone($pid);
    }

    // Player spends 1 gem to upgrade a center card — card returns to pile, player enters UpgradePickReplacement.
    #[PossibleAction]
    public function actSpendGem(int $cardId): void
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        if ($this->game->gemsCharged->get($pid) < 1) {
            throw new UserException("No charged gems available");
        }

        $card = $this->game->getObjectFromDB(
            "SELECT card_id, card_type, card_location_arg AS position
             FROM bc_card
             WHERE card_id = {$cardId}
               AND card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );
        if (!$card) {
            throw new UserException("Invalid card for upgrade");
        }

        // Validate options exist for this card
        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);
        $optionIds    = array_map('intval', (array)($myOptionsMap[(string)$cardId] ?? $myOptionsMap[$cardId] ?? []));
        if (empty($optionIds)) {
            throw new UserException("No upgrade options available for this card");
        }

        // Discharge 1 gem
        $this->game->gemsCharged->inc($pid, -1, null);
        $this->game->gemsUncharged->inc($pid, 1, null);

        // Return card to its origin pile
        $originPile = match((int)$card['card_type']) {
            Game::RANK_BRONZE => 'shared_bronze',
            Game::RANK_SILVER => 'shared_silver',
            default           => 'shared_gold',
        };
        $this->game->DbQuery(
            "UPDATE bc_card
             SET card_location = '{$originPile}', card_location_arg = 0, card_face_up = 0
             WHERE card_id = {$cardId}"
        );

        // Store which card is being upgraded (so UpgradePickReplacement knows what slot to fill)
        $this->game->bga->globals->set("upgrade_current_{$pid}", [
            'card_id'   => $cardId,
            'position'  => (int)$card['position'],
            'option_ids' => $optionIds,
        ]);

        // Notify: card flies out, gem discharged
        $this->game->bga->notify->player($pid, 'upgradeSpendGem', '', [
            'card_id'   => $cardId,
            'position'  => (int)$card['position'],
        ]);
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        // Move to replacement-picking private state
        $this->gamestate->nextPrivateState($pid, UpgradePickReplacement::class);
    }

    // Check if all center cards are handled — if so, deactivate player.
    private function checkDone(int $pid): void
    {
        $remaining = $this->game->getObjectFromDB(
            "SELECT COUNT(*) AS cnt FROM bc_card
             WHERE card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );
        if ((int)($remaining['cnt'] ?? 1) === 0) {
            $this->finishPlayer($pid);
        }
        // else: stay in UpgradeMain, waiting for more actFlipDown / actSpendGem
    }

    // All cards handled — clean up and deactivate.
    private function finishPlayer(int $pid): void
    {
        $allProduced = (array)($this->game->bga->globals->get('upgrade_produced') ?? []);
        $myProduced  = array_map('intval', (array)($allProduced[$pid] ?? []));

        $allDone = (array)($this->game->bga->globals->get('upgrade_done') ?? []);
        $myDone  = array_map('intval', (array)($allDone[$pid] ?? []));

        // Clean up globals for this player
        unset($allProduced[$pid]);
        $this->game->bga->globals->set('upgrade_produced', $allProduced);
        unset($allDone[$pid]);
        $this->game->bga->globals->set('upgrade_done', $allDone);

        // Also clean upgrade_options
        $allOptions = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        unset($allOptions[$pid]);
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        // Public notification: player done
        $this->game->bga->notify->all('upgradeConfirmed',
            clienttranslate('${player_name} confirms their upgrades'), [
                'player_id'      => $pid,
                'player_name'    => $this->game->getPlayerNameById($pid),
                'produced_count' => count($myProduced),
                'upgraded_count' => count($myDone),
                'produced_ids'   => $myProduced,
                'upgraded_ids'   => $myDone,
                'placed_cards'   => [],
            ]
        );

        $this->gamestate->unsetPrivateState($pid);
        $this->gamestate->setPlayerNonMultiactive($pid, NextRound::class);
    }

    public function zombie(int $playerId): void
    {
        $pid = (int)$playerId;

        // Auto-produce all remaining face-up center cards
        $faceUpCards = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );

        $allOptions = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);

        foreach (array_keys($faceUpCards) as $rawCardId) {
            $cardId = (int)$rawCardId;
            $this->game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$cardId}");
            if ($this->game->gemsUncharged->get($pid) > 0) {
                $this->game->gemsCharged->inc($pid, 1, null);
                $this->game->gemsUncharged->inc($pid, -1, null);
            }
            $this->returnOptionsToPile($myOptionsMap[(string)$cardId] ?? $myOptionsMap[$cardId] ?? []);
        }

        unset($allOptions[$pid]);
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        $allProduced       = (array)($this->game->bga->globals->get('upgrade_produced') ?? []);
        unset($allProduced[$pid]);
        $this->game->bga->globals->set('upgrade_produced', $allProduced);

        $allDone = (array)($this->game->bga->globals->get('upgrade_done') ?? []);
        unset($allDone[$pid]);
        $this->game->bga->globals->set('upgrade_done', $allDone);

        $this->game->bga->notify->all('upgradeConfirmed',
            clienttranslate('${player_name} confirms their upgrades'), [
                'player_id'      => $pid,
                'player_name'    => $this->game->getPlayerNameById($pid),
                'produced_count' => count($faceUpCards),
                'upgraded_count' => 0,
                'produced_ids'   => array_map('intval', array_keys($faceUpCards)),
                'upgraded_ids'   => [],
                'placed_cards'   => [],
            ]
        );
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        $this->gamestate->unsetPrivateState($pid);
    }

    private function returnOptionsToPile(array $optionIds): void
    {
        foreach ($optionIds as $oid) {
            $card = $this->game->getObjectFromDB(
                "SELECT card_type FROM bc_card WHERE card_id = {$oid}"
            );
            if (!$card) {
                continue;
            }
            $pile = match((int)$card['card_type']) {
                Game::RANK_SILVER => 'shared_silver',
                Game::RANK_GOLD   => 'shared_gold',
                default           => 'shared_silver',
            };
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = '{$pile}', card_location_arg = 0, card_face_up = 0
                 WHERE card_id = {$oid}"
            );
        }
    }
}
