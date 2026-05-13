<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

class CheckTurn extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 30, type: StateType::GAME);
    }

    public function onEnteringState()
    {
        $round = (int)($this->game->bga->globals->get('round_number') ?? 1);
        $turn  = (int)($this->game->bga->globals->get('turn_number') ?? 1);

        $this->game->bga->tableStats->inc('total_turns', 1);

        if ($turn < 3) {
            $this->game->bga->globals->set('turn_number', $turn + 1);
            $this->game->bga->notify->all('turnUpdated', '', [
                'turn_number' => $turn + 1,
            ]);
            return Deploy::class;
        }

        // Turn 3 complete: go to Upgrade (rounds 1–3) or score (round 4)
        if ($round < 4) {
            return Upgrade::class;
        }

        return EndScore::class;
    }
}
