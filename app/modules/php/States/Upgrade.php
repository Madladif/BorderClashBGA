<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\Actions\Types\IntArrayParam;
use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\borderclash\Game;

class Upgrade extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 40, type: StateType::MULTIPLE_ACTIVE_PLAYER);
    }

    // Runs once when entering the state:
    // 1. Delete all tokens (rules: "remis au centre" before upgrade choices)
    // 2. Flip border cards face-down (only center column stays face-up for choices)
    // 3. Pre-draw 3 upgrade options per face-up center card per player (private)
    public function onEnteringState(): void
    {
        $this->gamestate->setAllPlayersMultiactive();

        $round       = (int)($this->game->bga->globals->get('round_number') ?? 1);
        $playerOrder = (array)($this->game->bga->globals->get('player_order') ?? []);

        // Idempotency guard: skip if already prepared for this round
        if ((int)($this->game->bga->globals->get('upgrade_round') ?? 0) === $round) {
            return;
        }
        $this->game->bga->globals->set('upgrade_round', $round);

        // Step 1: Clear all tokens
        $this->game->DbQuery("DELETE FROM bc_token");
        $this->game->bga->notify->all('tokensCleared', '', []);

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
        // Options moved to 'upgrade_options' location to remove them from shared piles.
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

    // Returns current player's face-up center cards + their private upgrade options.
    public function getArgs(?int $currentPlayerId = null): array
    {
        if ($currentPlayerId === null) {
            return [];
        }
        $pid = $currentPlayerId;

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

        return [
            'center_cards'    => $centerCards,
            'upgrade_options' => $upgradeOptions,
            'gems_charged'    => $this->game->gemsCharged->get($pid),
            'gems_uncharged'  => $this->game->gemsUncharged->get($pid),
        ];
    }

    // Player confirms all upgrade/production choices simultaneously.
    // produceCardIds: center card IDs to produce (flip face-down, charge gem)
    // upgradeCardIds + chosenOptionIds: parallel arrays — upgrade card + chosen replacement
    #[PossibleAction]
    public function actConfirmUpgrades(
        #[IntArrayParam] array $produceCardIds,
        #[IntArrayParam] array $upgradeCardIds,
        #[IntArrayParam] array $chosenOptionIds
    ): string {
        $pid = (int)$this->game->getCurrentPlayerId();

        if (count($upgradeCardIds) !== count($chosenOptionIds)) {
            throw new UserException("Mismatch between upgrade cards and chosen options");
        }

        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);

        // All face-up center cards must be in exactly one list (produce or upgrade)
        $faceUpCenterRows = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'grid_{$pid}'
               AND card_location_arg IN (1, 4, 7)
               AND card_face_up = 1"
        );
        $required  = array_map('intval', array_keys($faceUpCenterRows));
        $submitted = array_merge(
            array_map('intval', $produceCardIds),
            array_map('intval', $upgradeCardIds)
        );
        sort($required);
        sort($submitted);
        if ($required !== $submitted) {
            throw new UserException("All face-up center cards must have a Production or Upgrade choice");
        }

        // Need 1 charged gem per upgrade
        if (count($upgradeCardIds) > $this->game->gemsCharged->get($pid)) {
            throw new UserException("Not enough charged gems for upgrades");
        }

        // Deduplicate check
        if (count(array_unique($submitted)) !== count($submitted)) {
            throw new UserException("Duplicate card IDs in choices");
        }

        // Process productions: flip face-down, charge gem if possible
        $producedCount = 0;
        foreach ($produceCardIds as $rawCardId) {
            $cardId = (int)$rawCardId;
            $this->game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$cardId}");
            if ($this->game->gemsUncharged->get($pid) > 0) {
                $this->game->gemsCharged->inc($pid, 1, null);
                $this->game->gemsUncharged->inc($pid, -1, null);
            }
            $this->returnOptionsToPile($myOptionsMap[$cardId] ?? []);
            $producedCount++;
        }

        // Process upgrades
        $upgradedCount = 0;
        $pairs         = array_combine(
            array_map('intval', $upgradeCardIds),
            array_map('intval', $chosenOptionIds)
        );
        foreach ($pairs as $cardId => $chosenId) {
            $validOptions = $myOptionsMap[$cardId] ?? [];
            if (!in_array($chosenId, $validOptions, true)) {
                throw new UserException("Chosen card {$chosenId} is not a valid option for card {$cardId}");
            }

            $card = $this->game->getObjectFromDB(
                "SELECT card_id, card_type, card_location_arg AS position
                 FROM bc_card WHERE card_id = {$cardId}"
            );
            if (!$card) {
                continue;
            }
            $position   = (int)$card['position'];
            $originRank = (int)$card['card_type'];
            $originPile = match($originRank) {
                Game::RANK_BRONZE => 'shared_bronze',
                Game::RANK_SILVER => 'shared_silver',
                default           => 'shared_gold',
            };

            // Discharge 1 gem (already validated enough are available)
            $this->game->gemsCharged->inc($pid, -1, null);
            $this->game->gemsUncharged->inc($pid, 1, null);

            // Return original card to its origin pile
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = '{$originPile}', card_location_arg = 0, card_face_up = 0
                 WHERE card_id = {$cardId}"
            );

            // Place chosen replacement face-down at the freed grid position
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'grid_{$pid}', card_location_arg = {$position}, card_face_up = 0
                 WHERE card_id = {$chosenId}"
            );

            // Return unchosen options to their respective piles
            $unchosen = array_values(array_diff($validOptions, [$chosenId]));
            $this->returnOptionsToPile($unchosen);

            $upgradedCount++;
        }

        // Cleanup globals for this player
        unset($allOptions[$pid]);
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        if ($producedCount > 0) {
            $this->game->bga->playerStats->inc('cards_produced', $producedCount, $pid);
        }
        if ($upgradedCount > 0) {
            $this->game->bga->playerStats->inc('cards_upgraded', $upgradedCount, $pid);
        }

        // Public confirmation (no card details — upgrade is secret)
        $this->game->bga->notify->all('upgradeConfirmed',
            clienttranslate('${player_name} confirms their upgrades'), [
                'player_id'      => $pid,
                'player_name'    => $this->game->getPlayerNameById($pid),
                'produced_count' => $producedCount,
                'upgraded_count' => $upgradedCount,
            ]
        );

        // Update gem display for all
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        return NextRound::class;
    }

    // Auto-produce all face-up center cards for a disconnected player.
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
            $this->returnOptionsToPile($myOptionsMap[$cardId] ?? []);
        }

        unset($allOptions[$pid]);
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        $this->game->bga->notify->all('upgradeConfirmed',
            clienttranslate('${player_name} confirms their upgrades'), [
                'player_id'      => $pid,
                'player_name'    => $this->game->getPlayerNameById($pid),
                'produced_count' => count($centerCards),
                'upgraded_count' => 0,
            ]
        );

        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);

        return NextRound::class;
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
