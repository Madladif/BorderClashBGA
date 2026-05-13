<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

// Orchestrates round transitions between the two Silver-draft passes.
// Called automatically when all active players have submitted actPickSilver.
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
            // Players received cards passed from their right neighbor; pick again.
            return SilverDraft::class;
        }

        // Pass 2 done — each player has exactly 1 'draft' card left (the final pass).
        // Auto-keep it: just change location from 'draft' to 'deck'; arg = player_id stays.
        $this->game->DbQuery(
            "UPDATE bc_card SET card_location = 'deck' WHERE card_location = 'draft'"
        );

        $this->game->bga->notify->all('silverDraftComplete',
            clienttranslate('Silver card draft complete — the game starts!'), []
        );

        return Deploy::class;
    }
}
