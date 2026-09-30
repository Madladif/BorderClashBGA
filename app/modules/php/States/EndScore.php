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
    //
    // The game ends right after round 4's turn 3 combat (CheckTurn skips Upgrade/NextRound
    // for the final round — see CheckTurn::onEnteringState), so cards are still sitting on
    // each player's grid_{pid} here: that final grid IS the "deck composition" these stats
    // describe, no separate snapshot step needed.
    public function onEnteringState()
    {
        $players    = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        $totalGold   = 0;
        $totalSilver = 0;
        $totalBronze = 0;
        $scores      = [];

        foreach (array_keys($players) as $rawPid) {
            $pid  = (int)$rawPid;
            $gems = $this->game->gemsCharged->get($pid);
            $this->game->DbQuery(
                "UPDATE player SET player_score_aux = {$gems} WHERE player_id = {$pid}"
            );
            $this->game->bga->playerStats->set('gems_charged_at_end', $gems, $pid);

            // "rank" is a reserved word since MySQL 8.0 (window functions) — using it bare as
            // a column alias broke this query with a syntax error on the live server.
            $rankRows = $this->game->getCollectionFromDb(
                "SELECT card_type AS card_rank, COUNT(*) AS cnt FROM bc_card
                 WHERE card_location = 'grid_{$pid}' GROUP BY card_type"
            );
            $rankCounts = [Game::RANK_BRONZE => 0, Game::RANK_SILVER => 0, Game::RANK_GOLD => 0];
            foreach ($rankRows as $row) {
                $rankCounts[(int)$row['card_rank']] = (int)$row['cnt'];
            }
            $this->game->bga->playerStats->set('cards_bronze', $rankCounts[Game::RANK_BRONZE], $pid);
            $this->game->bga->playerStats->set('cards_silver', $rankCounts[Game::RANK_SILVER], $pid);
            $this->game->bga->playerStats->set('cards_gold',   $rankCounts[Game::RANK_GOLD],   $pid);
            $totalBronze += $rankCounts[Game::RANK_BRONZE];
            $totalSilver += $rankCounts[Game::RANK_SILVER];
            $totalGold   += $rankCounts[Game::RANK_GOLD];

            $familyRows = $this->game->getCollectionFromDb(
                "SELECT card_family AS family, COUNT(*) AS cnt FROM bc_card
                 WHERE card_location = 'grid_{$pid}' GROUP BY card_family"
            );
            $familyCounts = [
                Game::FAMILY_GAMBLER => 0,
                Game::FAMILY_BRUTE   => 0,
                Game::FAMILY_PIRATE  => 0,
            ];
            foreach ($familyRows as $row) {
                $familyCounts[(int)$row['family']] = (int)$row['cnt'];
            }
            $this->game->bga->playerStats->set('faction_gambler_cards', $familyCounts[Game::FAMILY_GAMBLER], $pid);
            $this->game->bga->playerStats->set('faction_brute_cards',   $familyCounts[Game::FAMILY_BRUTE],   $pid);
            $this->game->bga->playerStats->set('faction_pirate_cards',  $familyCounts[Game::FAMILY_PIRATE],  $pid);

            $scoreRow = $this->game->getObjectFromDB(
                "SELECT player_score AS score FROM player WHERE player_id = {$pid}"
            );
            $scores[$pid] = (int)($scoreRow['score'] ?? 0);
        }

        $this->game->bga->tableStats->set('cards_gold_total',   $totalGold);
        $this->game->bga->tableStats->set('cards_silver_total', $totalSilver);
        $this->game->bga->tableStats->set('cards_bronze_total', $totalBronze);

        if (!empty($scores)) {
            $this->game->bga->tableStats->set('score_max', max($scores));
            $this->game->bga->tableStats->set('score_min', min($scores));
        }

        return ST_END_GAME;
    }
}
