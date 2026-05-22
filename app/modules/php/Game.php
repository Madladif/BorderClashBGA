<?php

declare(strict_types=1);

/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * borderclash implementation : © Merle Editions
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 */

namespace Bga\Games\borderclash;

use Bga\Games\borderclash\States\Deploy;
use Bga\Games\borderclash\States\PlayerTurn;
use Bga\Games\borderclash\States\SilverDraft;
use Bga\Games\borderclash\States\SilverDraftNext;
use Bga\GameFramework\Components\Counters\PlayerCounter;

class Game extends \Bga\GameFramework\Table
{
    public PlayerCounter $gemsCharged;
    public PlayerCounter $gemsUncharged;

    // Card rank constants (card_type)
    public const RANK_BRONZE = 1;
    public const RANK_SILVER = 2;
    public const RANK_GOLD   = 3;

    // Card family constants (card_family)
    public const FAMILY_GAMBLER = 1;
    public const FAMILY_BRUTE   = 2;
    public const FAMILY_PIRATE  = 3;

    public function __construct()
    {
        parent::__construct();

        $this->gemsCharged   = $this->bga->counterFactory->createPlayerCounter('gems_charged');
        $this->gemsUncharged = $this->bga->counterFactory->createPlayerCounter('gems_uncharged');
    }

    // -------------------------------------------------------------------------
    // Game progression
    // -------------------------------------------------------------------------

    public function getGameProgression(): int
    {
        $round = (int)($this->bga->globals->get('round_number') ?? 1);
        $turn  = (int)($this->bga->globals->get('turn_number')  ?? 1);
        return ($round - 1) * 25 + ($turn - 1) * 8;
    }

    // -------------------------------------------------------------------------
    // getAllDatas — called on page load and F5
    // -------------------------------------------------------------------------

    protected function getAllDatas(int $currentPlayerId): array
    {
        $result = [];
        $pid    = (int)$currentPlayerId;

        // Base player info + rage marker
        $result['players'] = $this->getCollectionFromDb(
            "SELECT player_id AS id, player_score AS score, player_rage AS rage FROM player"
        );

        // Gem counters — fillResult merges 'gems_charged'/'gems_uncharged' into player data
        $this->gemsCharged->fillResult($result);
        $this->gemsUncharged->fillResult($result);

        // Player families — one card from each player's owned locations (hand/deck/grid)
        $allPids = array_keys($result['players']);
        if (!empty($allPids)) {
            $pidList = implode(',', array_map('intval', $allPids));
            $famRows = $this->getCollectionFromDb(
                "SELECT card_location_arg AS pid, MIN(card_family) AS family
                 FROM bc_card
                 WHERE card_location_arg IN ({$pidList})
                   AND card_family > 0
                 GROUP BY card_location_arg"
            );
            foreach ($famRows as $row) {
                $p = (string)$row['pid'];
                if (isset($result['players'][$p])) {
                    $result['players'][$p]['family'] = (int)$row['family'];
                }
            }
        }

        // Current player's hand (private — full card data, face visible)
        $result['hand'] = array_values($this->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
             FROM bc_card
             WHERE card_location = 'hand' AND card_location_arg = {$pid}"
        ));

        // Current player's personal deck (for Silver draft fan; private)
        $result['deck_cards'] = array_values($this->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
             FROM bc_card
             WHERE card_location = 'deck' AND card_location_arg = {$pid}
             ORDER BY card_type ASC, card_type_arg ASC"
        ));

        // Silver draft hand (private — only populated during the initial draft state)
        $result['draft_cards'] = array_values($this->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_family AS family
             FROM bc_card
             WHERE card_location = 'draft' AND card_location_arg = {$pid}"
        ));
        $result['draft_round'] = (int)($this->bga->globals->get('draft_round') ?? 0);

        // Solo mode extras
        $isSolo = (bool)($this->bga->globals->get('is_solo') ?? false);
        $result['is_solo'] = $isSolo;
        if ($isSolo) {
            $result['bot_score']      = (int)($this->bga->globals->get('bot_score')      ?? 0);
            $result['bot_difficulty'] = (int)($this->bga->globals->get('bot_difficulty') ?? 0);

            $botGridCards = [];
            foreach (['bot_grid_left', 'bot_grid_right'] as $loc) {
                $rows = $this->getCollectionFromDb(
                    "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                            card_family AS family, card_location_arg AS `row`, card_face_up AS face_up
                     FROM bc_card WHERE card_location = '{$loc}'"
                );
                foreach ($rows as $card) {
                    $entry = [
                        'id'      => (int)$card['id'],
                        'side'    => $loc === 'bot_grid_left' ? 'left' : 'right',
                        'row'     => (int)$card['row'],
                        'face_up' => (int)$card['face_up'],
                        'type'    => null, 'type_arg' => null,
                        'family'  => (int)$card['family'], // always visible: back shows faction
                    ];
                    if ((int)$card['face_up']) {
                        $entry['type']     = (int)$card['type'];
                        $entry['type_arg'] = (int)$card['type_arg'];
                    }
                    $botGridCards[] = $entry;
                }
            }
            $result['bot_grid_cards'] = $botGridCards;
        }

        // All deployed grid cards (public — type hidden when face-down; critical visibility rule)
        $gridCards = $this->getCollectionFromDb(
            "SELECT card_id AS id, card_location, card_location_arg AS position,
                    card_face_up AS face_up, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family
             FROM bc_card
             WHERE card_location LIKE 'grid_%'"
        );
        foreach ($gridCards as &$card) {
            if (!(int)$card['face_up']) {
                $card['type']     = null;
                $card['type_arg'] = null;
                // family kept: card back visually identifies the deck/faction
            }
        }
        unset($card);
        $result['grid_cards'] = array_values($gridCards);

        // If upgrade_options exist for this player in globals, we are in the Upgrade state.
        // Include private upgrade data so JS can restore the UI on F5 (notify->player is not replayed).
        $allUpgradeOptions = (array)($this->bga->globals->get('upgrade_options') ?? []);
        if (isset($allUpgradeOptions[$pid]) || isset($allUpgradeOptions[(string)$pid])) {
            $myOptionsMap = (array)($allUpgradeOptions[$pid] ?? $allUpgradeOptions[(string)$pid] ?? []);
            $centerCards = array_values($this->getCollectionFromDb(
                "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                        card_family AS family, card_location_arg AS position
                 FROM bc_card
                 WHERE card_location = 'grid_{$pid}'
                   AND card_location_arg IN (1, 4, 7)
                   AND card_face_up = 1"
            ));

            $upgradeOptions = [];
            foreach ($myOptionsMap as $origCardId => $optionIds) {
                $details = [];
                foreach ($optionIds as $oid) {
                    $row = $this->getObjectFromDB(
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
            $result['upgrade_center_cards'] = $centerCards;
            $result['upgrade_options']      = $upgradeOptions;

            $allChoices = (array)($this->bga->globals->get('upgrade_choices') ?? []);
            $result['upgrade_saved_choices'] = (array)($allChoices[$pid] ?? $allChoices[(string)$pid] ?? []);
        }

        // Shared pile sizes (Bronze / Silver / Gold)
        $sharedRows = $this->getCollectionFromDb(
            "SELECT card_location, COUNT(*) AS cnt FROM bc_card
             WHERE card_location IN ('shared_bronze', 'shared_silver', 'shared_gold')
             GROUP BY card_location"
        );
        $result['deck_sizes'] = [
            'bronze' => (int)($sharedRows['shared_bronze']['cnt'] ?? 0),
            'silver' => (int)($sharedRows['shared_silver']['cnt'] ?? 0),
            'gold'   => (int)($sharedRows['shared_gold']['cnt']   ?? 0),
        ];

        // Personal deck sizes — all players (UI shows deck stack depth)
        $result['personal_deck_sizes'] = [];
        foreach (array_keys($result['players']) as $playerId) {
            $result['personal_deck_sizes'][(int)$playerId] = 0;
        }
        $personalRows = $this->getCollectionFromDb(
            "SELECT card_location_arg AS player_id, COUNT(*) AS cnt FROM bc_card
             WHERE card_location = 'deck'
             GROUP BY card_location_arg"
        );
        foreach ($personalRows as $key => $row) {
            $result['personal_deck_sizes'][(int)$key] = (int)$row['cnt'];
        }

        // Active player tokens (gambler + pirate_gold) — always visible to all
        $result['tokens'] = array_values($this->getCollectionFromDb(
            "SELECT player_id, grid_position, token_type, value FROM bc_token WHERE player_id != 0"
        ));

        // Round / turn / turn-order globals
        $result['round_number']        = (int)($this->bga->globals->get('round_number')        ?? 1);
        $result['turn_number']         = (int)($this->bga->globals->get('turn_number')         ?? 1);
        $result['turn_order_start_id'] = (int)($this->bga->globals->get('turn_order_start_id') ?? 0);
        $result['player_order']        = $this->bga->globals->get('player_order') ?? [];
        $result['current_player_id']   = $pid;

        return $result;
    }

    // -------------------------------------------------------------------------
    // setupNewGame — called once when a new game is launched
    // -------------------------------------------------------------------------

    protected function setupNewGame($players, $options = [])
    {
        
        try {
        // Gem counters: 1 charged + 2 uncharged = 3 gems per player
        $this->gemsCharged->initDb(array_keys($players), 1);
        $this->gemsUncharged->initDb(array_keys($players), 2);

        // Insert players with assigned colors
        $gameinfos     = $this->getGameinfos();
        $defaultColors = $gameinfos['player_colors'];
        $queryValues   = [];
        foreach ($players as $playerId => $player) {
            $queryValues[] = vsprintf("(%s, '%s', '%s')", [
                $playerId,
                array_shift($defaultColors),
                addslashes($player['player_name']),
            ]);
        }
        
        static::DbQuery(sprintf(
            "INSERT INTO `player` (`player_id`, `player_color`, `player_name`) VALUES %s",
            implode(',', $queryValues)
        ));
        $this->reattributeColorsBasedOnPreferences($players, $gameinfos['player_colors']);
        $this->reloadPlayersBasicInfos();

        // Create all 78 cards in their shared piles
        $this->createAllCards();

        // Give each player 1 copy of every Bronze design (6 cards each)
        $this->distributeBronzeCards($players);

        // Solo vs multiplayer Silver setup
        $isSolo     = count($players) === 1;
        $difficulty = $isSolo ? (int)($options['100'] ?? 0) : 0;

        if ($isSolo) {
            $pid = (int)array_key_first($players);
            // Solo: draw 5 Silver into draft; player picks 3 over 3 passes (SilverDraft handles it)
            $this->setupSoloPlayerSilver($pid);
            $this->setupBot($difficulty);
        } else {
            // Multiplayer: deal 3 Silver to each player's draft hand; draft state handles picking
            $this->dealInitialDraftCards($players);
        }

        // Pick first player randomly and build anticlockwise play order
        $playerIds    = array_keys($players);
        $firstId      = (int)$playerIds[array_rand($playerIds)];

        // getCollectionFromDb keyed by player_id, but ORDER BY player_no preserved in PHP array
        $playersInfo  = $this->getCollectionFromDb(
            "SELECT player_id, player_no FROM player ORDER BY player_no ASC"
        );
        $orderedPids  = array_map('intval', array_keys($playersInfo));
        $firstIdx     = array_search($firstId, $orderedPids, true);
        if ($firstIdx === false) {
            $firstIdx = 0;
        }
        $count        = count($orderedPids);
        $playerOrder  = [];
        for ($i = 0; $i < $count; $i++) {
            $playerOrder[] = $orderedPids[($firstIdx + $i) % $count];
        }

        $this->bga->globals->set('round_number',        1);
        $this->bga->globals->set('turn_number',         1);
        $this->bga->globals->set('turn_order_start_id', $firstId);
        $this->bga->globals->set('player_order',        $playerOrder);
        $this->bga->globals->set('current_combat_idx',  0);
        $this->bga->globals->set('is_solo',             $isSolo ? 1 : 0);
        $this->bga->globals->set('draft_round', 0);
        if ($isSolo) {
            $this->bga->globals->set('bot_score',      0);
            $this->bga->globals->set('bot_difficulty', $difficulty);
            $this->bga->globals->set('bot_rage',       0);
        }

        // Both solo and multiplayer start with SilverDraftNext → SilverDraft
        return SilverDraftNext::class;
        } catch (\Throwable $t) {
            throw new \Exception(
                'Setup failed: ' . $t->getMessage()
                . ' in ' . $t->getFile() . ':' . $t->getLine(),
                0, $t
            );
        }
    }

    // -------------------------------------------------------------------------
    // DB migration (used post-publication only)
    // -------------------------------------------------------------------------

    public function upgradeTableDb($from_version)
    {
    }

    // -------------------------------------------------------------------------
    // Private helpers — card setup
    // -------------------------------------------------------------------------

    private function createAllCards(): void
    {
        $values = [];

        // Bronze: 6 designs × 4 copies. Family: designs 1-2=Gambler, 3-4=Brute, 5-6=Pirate
        for ($design = 1; $design <= 6; $design++) {
            $family = (int)ceil($design / 2);
            for ($copy = 0; $copy < 4; $copy++) {
                $values[] = "(1, {$design}, {$family}, 'shared_bronze', 0, 0)";
            }
        }

        // Silver: 18 designs × 2 copies. Family: designs 1-6=Gambler, 7-12=Brute, 13-18=Pirate
        for ($design = 1; $design <= 18; $design++) {
            $family = (int)ceil($design / 6);
            for ($copy = 0; $copy < 2; $copy++) {
                $values[] = "(2, {$design}, {$family}, 'shared_silver', 0, 0)";
            }
        }

        // Gold: 9 designs × 2 copies. Family: designs 1-3=Gambler, 4-6=Brute, 7-9=Pirate
        for ($design = 1; $design <= 9; $design++) {
            $family = (int)ceil($design / 3);
            for ($copy = 0; $copy < 2; $copy++) {
                $values[] = "(3, {$design}, {$family}, 'shared_gold', 0, 0)";
            }
        }

        static::DbQuery(
            "INSERT INTO bc_card (card_type, card_type_arg, card_family, card_location, card_location_arg, card_face_up) VALUES "
            . implode(',', $values)
        );
    }

    private function distributeBronzeCards(array $players): void
    {
        foreach (array_keys($players) as $playerId) {
            $pid = (int)$playerId;
            for ($design = 1; $design <= 6; $design++) {
                $rows = $this->getCollectionFromDb(
                    "SELECT card_id FROM bc_card
                     WHERE card_type = 1 AND card_type_arg = {$design}
                       AND card_location = 'shared_bronze'
                     LIMIT 1"
                );
                if (empty($rows)) {
                    throw new \RuntimeException("Not enough Bronze cards for design {$design}");
                }
                $cardId = (int)array_key_first($rows);
                static::DbQuery(
                    "UPDATE bc_card
                     SET card_location = 'deck', card_location_arg = {$pid}
                     WHERE card_id = {$cardId}"
                );
            }
        }
    }

    private function setupSoloPlayerSilver(int $playerId): void
    {
        // Draw 5 Silver into draft; player picks 3 over 3 passes in SilverDraft
        $drawn = $this->getCollectionFromDb(
            "SELECT card_id FROM bc_card
             WHERE card_location = 'shared_silver'
             ORDER BY RAND() LIMIT 5"
        );
        if (count($drawn) < 5) {
            throw new \RuntimeException("Not enough Silver cards for solo player draft");
        }
        $ids = implode(',', array_map('intval', array_keys($drawn)));
        static::DbQuery(
            "UPDATE bc_card SET card_location = 'draft', card_location_arg = {$playerId}
             WHERE card_id IN ({$ids})"
        );
    }

    private function setupBot(int $difficulty): void
    {
        // difficulty 0=6B, 1=4B+2S, 2=2B+4S, 3=6S
        $silverCount = $difficulty * 2;
        $bronzeCount = 6 - $silverCount;

        // Give bot one copy of each Bronze design, shuffled, taking $bronzeCount
        $bronzeDesigns = range(1, 6);
        shuffle($bronzeDesigns);
        foreach (array_slice($bronzeDesigns, 0, $bronzeCount) as $design) {
            $row = $this->getObjectFromDB(
                "SELECT card_id FROM bc_card
                 WHERE card_type = 1 AND card_type_arg = {$design}
                   AND card_location = 'shared_bronze'
                 LIMIT 1"
            );
            if (empty($row)) {
                throw new \RuntimeException("Not enough Bronze cards for bot (design {$design})");
            }
            $cid = (int)$row['card_id'];
            static::DbQuery(
                "UPDATE bc_card
                 SET card_location = 'bot_deck', card_location_arg = 0
                 WHERE card_id = {$cid}"
            );
        }

        if ($silverCount > 0) {
            $rows = $this->getCollectionFromDb(
                "SELECT card_id FROM bc_card
                 WHERE card_location = 'shared_silver'
                 ORDER BY RAND() LIMIT {$silverCount}"
            );
            if (count($rows) < $silverCount) {
                throw new \RuntimeException("Not enough Silver cards for bot");
            }
            $ids = implode(',', array_map('intval', array_keys($rows)));
            static::DbQuery(
                "UPDATE bc_card SET card_location = 'bot_deck', card_location_arg = 0
                 WHERE card_id IN ({$ids})"
            );
        }
    }

    // Deal 3 Silver cards per player to the 'draft' location for the initial Silver draft.
    private function dealInitialDraftCards(array $players): void
    {
        foreach (array_keys($players) as $playerId) {
            $pid  = (int)$playerId;
            $rows = $this->getCollectionFromDb(
                "SELECT card_id FROM bc_card
                 WHERE card_location = 'shared_silver'
                 ORDER BY RAND() LIMIT 3"
            );
            if (count($rows) < 3) {
                throw new \RuntimeException("Not enough Silver cards for draft (player {$pid})");
            }
            $cardIds = implode(',', array_map('intval', array_keys($rows)));
            static::DbQuery(
                "UPDATE bc_card
                 SET card_location = 'draft', card_location_arg = {$pid}
                 WHERE card_id IN ({$cardIds})"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Debug helpers (remove before release)
    // -------------------------------------------------------------------------

    public function debug_goToState(int $state = 10): void
    {
        $this->gamestate->jumpToState($state);
    }

    public function debug_playOneMove(): void
    {
        $this->bga->debug->playUntil(fn(int $count) => $count == 1);
    }
}
