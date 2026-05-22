<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\Game;

// Superseded by UpgradeMain (41) and UpgradePickReplacement (42).
// Delete this file via BGA Studio file manager once synced.
class UpgradeCards extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 43, type: StateType::GAME);
    }
}
