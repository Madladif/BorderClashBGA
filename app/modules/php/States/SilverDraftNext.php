<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

// Orchestrates round transitions between the two Silver-draft passes.
// Entered automatically when all active players have called setPlayerNonMultiactive.
class SilverDraftNext extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 6, type: StateType::GAME);
    }

    public function onEnteringState()
    {
        $round     = (int)($this->game->bga->globals->get('draft_round') ?? 1);
        $nextRound = $round + 1;
        $this->game->bga->globals->set('draft_round', $nextRound);

        if ($nextRound <= 2) {
            // All players have picked their card — pass remaining draft cards to the left.
            $this->passRemainingCards();
            return SilverDraft::class;
        }

        // Pass 2 done — each player has 1 remaining draft card.
        // Move it directly to the left neighbor's deck and notify them privately.
        $draftRows = $this->game->getCollectionFromDb(
            "SELECT card_id, card_type, card_type_arg, card_family, card_location_arg
             FROM bc_card WHERE card_location = 'draft'"
        );
        foreach ($draftRows as $cardId => $card) {
            $currentHolder = (int)$card['card_location_arg'];
            $recipientPid  = $this->getLeftNeighborId($currentHolder);

            $this->game->DbQuery(
                "UPDATE bc_card SET card_location = 'deck', card_location_arg = {$recipientPid}
                 WHERE card_id = {$cardId}"
            );

            $this->game->bga->notify->player($recipientPid, 'silverLastCardReceived', '', [
                'card' => [
                    'id'       => (int)$cardId,
                    'type'     => (int)$card['card_type'],
                    'type_arg' => (int)$card['card_type_arg'],
                    'family'   => (int)$card['card_family'],
                ],
            ]);
        }

        $this->game->bga->notify->all('silverDraftComplete',
            clienttranslate('Silver card draft complete — the game starts!'), []
        );

        return Deploy::class;
    }

    // Pass each player's remaining draft cards to their left neighbor.
    // Sends a private silverCardsReceived notification to each recipient.
    private function passRemainingCards(): void
    {
        $draftRows = $this->game->getCollectionFromDb(
            "SELECT card_id, card_type, card_type_arg, card_family, card_location_arg
             FROM bc_card WHERE card_location = 'draft'"
        );

        $byHolder = [];
        foreach ($draftRows as $cardId => $card) {
            $holder              = (int)$card['card_location_arg'];
            $byHolder[$holder][] = [
                'id'       => (int)$cardId,
                'type'     => (int)$card['card_type'],
                'type_arg' => (int)$card['card_type_arg'],
                'family'   => (int)$card['card_family'],
            ];
        }

        foreach ($byHolder as $holderId => $cards) {
            $leftId  = $this->getLeftNeighborId($holderId);
            $idsStr  = implode(',', array_column($cards, 'id'));

            $this->game->DbQuery(
                "UPDATE bc_card SET card_location_arg = {$leftId}
                 WHERE card_id IN ({$idsStr})"
            );

            $this->game->bga->notify->player($leftId, 'silverCardsReceived', '', [
                'cards' => $cards,
            ]);
        }
    }

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
