<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\borderclash\Game;

class UpgradePickReplacement extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 42, type: StateType::PRIVATE);
    }

    // Send private args: the 3 replacement options for the card being upgraded.
    public function onEnteringState(int $playerId): void
    {
        $this->game->bga->notify->player($playerId, 'upgradePickReplacementEntered', '', $this->getArgs($playerId));
    }

    public function getArgs(int $playerId): array
    {
        $current = (array)($this->game->bga->globals->get("upgrade_current_{$playerId}") ?? []);

        $origCardId = (int)($current['card_id'] ?? 0);
        $position   = (int)($current['position'] ?? 0);
        $optionIds  = array_map('intval', (array)($current['option_ids'] ?? []));

        $options = [];
        foreach ($optionIds as $oid) {
            $row = $this->game->getObjectFromDB(
                "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                        card_family AS family
                 FROM bc_card WHERE card_id = {$oid}"
            );
            if ($row) {
                $options[] = [
                    'id'       => (int)$row['id'],
                    'type'     => (int)$row['type'],
                    'type_arg' => (int)$row['type_arg'],
                    'family'   => (int)$row['family'],
                ];
            }
        }

        return [
            'orig_card_id'  => $origCardId,
            'position'      => $position,
            'options'       => $options,
            'gems_charged'  => $this->game->gemsCharged->get($playerId),
        ];
    }

    // Discard the current 3 options back to their shared pile and draw 3 new ones from the
    // same pile, for the cost of 1 charged gem. Stays in this state (getArgs() re-reads the
    // refreshed option_ids, so the client just re-renders with the new notify payload).
    #[PossibleAction]
    public function actRerollOptions(): void
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        if ($this->game->gemsCharged->get($pid) <= 0) {
            throw new UserException(clienttranslate("No charged gems available to reroll"));
        }

        $current    = (array)($this->game->bga->globals->get("upgrade_current_{$pid}") ?? []);
        $origCardId = (int)($current['card_id'] ?? 0);
        $optionIds  = array_map('intval', (array)($current['option_ids'] ?? []));
        $origRank   = (int)($current['orig_rank'] ?? 0);

        $this->game->gemsCharged->inc($pid, -1, null);
        $this->game->gemsUncharged->inc($pid, 1, null);
        $this->game->bga->tableStats->inc('gems_spent_total', 1);

        $this->returnOptionsToPile($optionIds);

        $nextPile = $origRank === Game::RANK_BRONZE ? 'shared_silver' : 'shared_gold';
        $newRows  = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card WHERE card_location = '{$nextPile}' ORDER BY RAND() LIMIT 3"
        );
        $newOptionIds = array_map('intval', array_keys($newRows));
        if (!empty($newOptionIds)) {
            $idsStr = implode(',', $newOptionIds);
            $this->game->DbQuery(
                "UPDATE bc_card SET card_location = 'upgrade_options', card_location_arg = {$pid}
                 WHERE card_id IN ({$idsStr})"
            );
        }

        $current['option_ids'] = $newOptionIds;
        $this->game->bga->globals->set("upgrade_current_{$pid}", $current);

        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);
        $myOptionsMap[$origCardId] = $newOptionIds;
        $allOptions[$pid] = $myOptionsMap;
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        $this->game->bga->notify->player($pid, 'upgradeOptionsRerolled', '', $this->getArgs($pid));
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);
    }

    // Player picks one replacement card. The chosen card is placed face-down in the grid slot.
    // Unchosen cards return to shared pile. Player transitions back to UpgradeMain.
    #[PossibleAction]
    public function actPickReplacement(int $chosenId): void
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        $current    = (array)($this->game->bga->globals->get("upgrade_current_{$pid}") ?? []);
        $origCardId = (int)($current['card_id'] ?? 0);
        $position   = (int)($current['position'] ?? 0);
        $optionIds  = array_map('intval', (array)($current['option_ids'] ?? []));
        $origRank   = (int)($current['orig_rank'] ?? 0);

        if (!in_array($chosenId, $optionIds, true)) {
            throw new UserException(clienttranslate("Chosen card is not a valid option"));
        }

        $cardRow = $this->game->getObjectFromDB(
            "SELECT card_type AS type, card_family AS family FROM bc_card WHERE card_id = {$chosenId}"
        );
        if (!$cardRow) {
            throw new UserException(clienttranslate("Chosen card not found"));
        }

        // Defense in depth: one rank at a time only (Bronze → Silver, Silver → Gold — never
        // Bronze → Gold directly), regardless of what ended up in option_ids.
        if ($origRank > 0 && (int)$cardRow['type'] !== $origRank + 1) {
            throw new UserException(clienttranslate("Replacement card is not exactly one rank higher"));
        }

        // Place chosen replacement face-down at the original card's grid position
        $this->game->DbQuery(
            "UPDATE bc_card
             SET card_location = 'grid_{$pid}', card_location_arg = {$position}, card_face_up = 0
             WHERE card_id = {$chosenId}"
        );

        // Return unchosen options to shared pile
        $unchosen = array_filter($optionIds, fn($id) => $id !== $chosenId);
        $this->returnOptionsToPile(array_values($unchosen));

        // Also remove original card's options from upgrade_options global
        $allOptions   = (array)($this->game->bga->globals->get('upgrade_options') ?? []);
        $myOptionsMap = (array)($allOptions[$pid] ?? []);
        unset($myOptionsMap[$origCardId], $myOptionsMap[(string)$origCardId]);
        $allOptions[$pid] = $myOptionsMap;
        $this->game->bga->globals->set('upgrade_options', $allOptions);

        // Clear the current upgrade global
        $this->game->bga->globals->set("upgrade_current_{$pid}", null);

        // Track this card as upgraded (done)
        $allDone         = (array)($this->game->bga->globals->get('upgrade_done') ?? []);
        $myDone          = (array)($allDone[$pid] ?? []);
        $myDone[]        = $origCardId;
        $allDone[$pid]   = $myDone;
        $this->game->bga->globals->set('upgrade_done', $allDone);

        $this->game->bga->playerStats->inc('cards_upgraded', 1, $pid);

        // Notify: replacement card placed face-down in the slot (family needed for back sprite)
        $this->game->bga->notify->player($pid, 'upgradeReplacementPicked', '', [
            'orig_card_id' => $origCardId,
            'chosen_id'    => $chosenId,
            'position'     => $position,
            'family'       => (int)$cardRow['family'],
        ]);
        // Public: others see the old card removed and a face-down card appear in that slot
        $this->game->bga->notify->all('upgradeReplacementPlaced', '', [
            'player_id'    => $pid,
            'orig_card_id' => $origCardId,
            'chosen_id'    => $chosenId,
            'position'     => $position,
        ]);

        // Return to UpgradeMain — player continues with remaining cards (or finishes if none left)
        $this->gamestate->nextPrivateState($pid, UpgradeMain::class);
    }

    public function zombie(int $playerId): void
    {
        $pid     = (int)$playerId;
        $current = (array)($this->game->bga->globals->get("upgrade_current_{$pid}") ?? []);

        $position  = (int)($current['position'] ?? 0);
        $optionIds = array_map('intval', (array)($current['option_ids'] ?? []));

        if (!empty($optionIds)) {
            $chosenId = $optionIds[0];
            $this->game->DbQuery(
                "UPDATE bc_card
                 SET card_location = 'grid_{$pid}', card_location_arg = {$position}, card_face_up = 0
                 WHERE card_id = {$chosenId}"
            );
            $unchosen = array_slice($optionIds, 1);
            $this->returnOptionsToPile($unchosen);

            $this->game->bga->notify->all('upgradeReplacementPlaced', '', [
                'player_id' => $pid,
                'chosen_id' => $chosenId,
                'position'  => $position,
            ]);
        }

        $this->game->bga->globals->set("upgrade_current_{$pid}", null);
        $this->gamestate->nextPrivateState($pid, UpgradeMain::class);
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
