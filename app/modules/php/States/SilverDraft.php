<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\borderclash\Game;

class SilverDraft extends \Bga\GameFramework\States\GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 5, type: StateType::MULTIPLE_ACTIVE_PLAYER);
    }

    // Cards are pre-placed in 'draft' (arg = player_id) by setupNewGame (round 1)
    // or by SilverDraftNext when re-entering for round 2.
    public function onEnteringState(): void
    {
        $this->gamestate->setAllPlayersMultiactive();
    }

    // Private args: current player's draft hand + which pass round (1 or 2).
    public function getArgs(?int $currentPlayerId = null): array
    {
        $draftRound = (int)($this->game->bga->globals->get('draft_round') ?? 1);
        if ($currentPlayerId === null) {
            return ['draft_round' => $draftRound];
        }
        return [
            'draft_cards' => array_values($this->game->getCollectionFromDb(
                "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
                 FROM bc_card WHERE card_location = 'draft' AND card_location_arg = {$currentPlayerId}"
            )),
            'draft_round' => $draftRound,
        ];
    }

    // Keep 1 card, pass the rest left.
    #[PossibleAction]
    public function actPickSilver(int $keptCardId): string
    {
        $pid = (int)$this->game->getCurrentPlayerId();

        $draftRows    = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'draft' AND card_location_arg = {$pid}"
        );
        $draftCardIds = array_map('intval', array_keys($draftRows));

        if (!in_array($keptCardId, $draftCardIds, true)) {
            throw new UserException("This card is not in your draft");
        }

        // Keep: move to personal deck
        $this->game->DbQuery(
            "UPDATE bc_card SET card_location = 'deck', card_location_arg = {$pid}
             WHERE card_id = {$keptCardId}"
        );

        // Pass remaining cards left (still in 'draft' location; only arg changes)
        $remaining = array_values(array_diff($draftCardIds, [$keptCardId]));
        if (!empty($remaining)) {
            $leftId       = $this->getLeftNeighborId($pid);
            $remainingStr = implode(',', $remaining);
            $this->game->DbQuery(
                "UPDATE bc_card SET card_location_arg = {$leftId}
                 WHERE card_id IN ({$remainingStr})"
            );
        }

        $draftRound = (int)($this->game->bga->globals->get('draft_round') ?? 1);
        $this->game->bga->notify->all('silverDraftPicked',
            clienttranslate('${player_name} picks a Silver card (pass ${draft_round}/2)'),
            [
                'player_id'   => $pid,
                'player_name' => $this->game->getPlayerNameById($pid),
                'draft_round' => $draftRound,
            ]
        );

        return SilverDraftNext::class;
    }

    // Auto-pick first available card for a disconnected player.
    public function zombie(int $playerId): string
    {
        $pid          = (int)$playerId;
        $draftRows    = $this->game->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'draft' AND card_location_arg = {$pid}"
        );
        $draftCardIds = array_map('intval', array_keys($draftRows));

        if (empty($draftCardIds)) {
            return SilverDraftNext::class;
        }

        $keptCardId = $draftCardIds[0];
        $this->game->DbQuery(
            "UPDATE bc_card SET card_location = 'deck', card_location_arg = {$pid}
             WHERE card_id = {$keptCardId}"
        );

        $remaining = array_values(array_diff($draftCardIds, [$keptCardId]));
        if (!empty($remaining)) {
            $leftId       = $this->getLeftNeighborId($pid);
            $remainingStr = implode(',', $remaining);
            $this->game->DbQuery(
                "UPDATE bc_card SET card_location_arg = {$leftId}
                 WHERE card_id IN ({$remainingStr})"
            );
        }

        $draftRound = (int)($this->game->bga->globals->get('draft_round') ?? 1);
        $this->game->bga->notify->all('silverDraftPicked',
            clienttranslate('${player_name} picks a Silver card (pass ${draft_round}/2)'),
            [
                'player_id'   => $pid,
                'player_name' => $this->game->getPlayerNameById($pid),
                'draft_round' => $draftRound,
            ]
        );

        return SilverDraftNext::class;
    }

    // "Left" = next player in the anticlockwise player_order array.
    private function getLeftNeighborId(int $pid): int
    {
        $playerOrder = array_map('intval', (array)($this->game->bga->globals->get('player_order') ?? []));
        $idx         = array_search($pid, $playerOrder, true);
        if ($idx === false || count($playerOrder) < 2) {
            return $pid;
        }
        return $playerOrder[($idx + 1) % count($playerOrder)];
    }
}
