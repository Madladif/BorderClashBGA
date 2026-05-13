<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\Games\borderclash\Game;

const ST_END_GAME = 99;

class EndScore extends \Bga\GameFramework\States\GameState
{

    function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 98,
            type: StateType::GAME,
        );
    }

    // Scores are accumulated live during play. Here we store the gem tiebreaker
    // in player_score_aux so BGA's end-game screen can surface it.
    // Rules: tied combat scores are broken by gems_charged (more = wins).
    public function onEnteringState()
    {
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        foreach (array_keys($players) as $rawPid) {
            $pid  = (int)$rawPid;
            $gems = $this->game->gemsCharged->get($pid);
            $this->game->DbQuery(
                "UPDATE player SET player_score_aux = {$gems} WHERE player_id = {$pid}"
            );
            $this->game->bga->playerStats->set('gems_charged_at_end', $gems, $pid);
        }

        return ST_END_GAME;
    }
}
