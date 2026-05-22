<?php

declare(strict_types=1);

namespace Bga\Games\borderclash;

/**
 * Static card-data registry and effect engine for Border Clash.
 *
 * All methods are static; pass $game for DB access.
 * Token type 'gambler' = Flambeur signed-strength token.
 * Token type 'pirate_gold' = treats card as Gold rank (value always 0).
 */
class CardEffects
{
    // Bot sentinel player_id (player_id = 0 is never assigned to a real player by BGA)
    public const BOT_PLAYER_ID = 0;

    // ---------------------------------------------------------------------------
    // Card data: [rank][design] = ['name', 'force', 'traits']
    // rank 1=Bronze, 2=Silver, 3=Gold
    // ---------------------------------------------------------------------------
    private static array $DATA = [
        1 => [
            1 => ['name' => 'Amateur',         'force' => 2, 'traits' => ['flambeur', 'arcane']],
            2 => ['name' => 'Parieur',          'force' => 2, 'traits' => ['flambeur', 'maitrise']],
            3 => ['name' => 'Troll',            'force' => 1, 'traits' => ['brute',    'impact']],
            4 => ['name' => 'Gros-bras',        'force' => 3, 'traits' => ['brute',    'maitrise']],
            5 => ['name' => 'Mousse',           'force' => 2, 'traits' => ['pirate',   'energie']],
            6 => ['name' => 'Quartier-Maitre',  'force' => 1, 'traits' => ['pirate',   'arcane']],
        ],
        2 => [
            1  => ['name' => 'Bookmaker',  'force' => 3, 'traits' => ['flambeur', 'arcane']],
            2  => ['name' => 'Croupier',   'force' => 2, 'traits' => ['flambeur', 'impact']],
            3  => ['name' => 'Piece',      'force' => 3, 'traits' => ['flambeur', 'arcane']],
            4  => ['name' => 'Tricheur',   'force' => 0, 'traits' => ['flambeur', 'impact']],
            5  => ['name' => 'Mecene',     'force' => 3, 'traits' => ['flambeur', 'maitrise']],
            6  => ['name' => 'Complice',   'force' => 1, 'traits' => ['flambeur', 'impact']],
            7  => ['name' => 'Mercenaire', 'force' => 2, 'traits' => ['brute',    'impact']],
            8  => ['name' => 'Grizzly',    'force' => 3, 'traits' => ['brute',    'impact']],
            9  => ['name' => 'Videur',     'force' => 2, 'traits' => ['brute',    'impact']],
            10 => ['name' => 'Berserker',  'force' => 3, 'traits' => ['brute',    'impact']],
            11 => ['name' => 'Loup-Garou', 'force' => 3, 'traits' => ['brute',    'maitrise']],
            12 => ['name' => 'Barbare',    'force' => 3, 'traits' => ['brute',    'impact']],
            13 => ['name' => 'Pillard',    'force' => 4, 'traits' => ['pirate',   'maitrise']],
            14 => ['name' => 'Second',     'force' => 2, 'traits' => ['pirate',   'impact']],
            15 => ['name' => 'Boucanier',  'force' => 3, 'traits' => ['pirate',   'impact']],
            16 => ['name' => 'Artificier', 'force' => 3, 'traits' => ['pirate',   'maitrise']],
            17 => ['name' => 'Vigie',      'force' => 4, 'traits' => ['pirate',   'impact']],
            18 => ['name' => 'Navigateur', 'force' => 4, 'traits' => ['pirate',   'arcane']],
        ],
        3 => [
            1 => ['name' => 'Jack Jackpot',      'force' => 4, 'traits' => ['flambeur', 'arcane']],
            2 => ['name' => 'Poker Face',        'force' => 2, 'traits' => ['flambeur', 'maitrise']],
            3 => ['name' => 'Double 6',          'force' => 6, 'traits' => ['flambeur', 'impact']],
            4 => ['name' => 'Brunhilde',         'force' => 4, 'traits' => ['brute',    'maitrise']],
            5 => ['name' => 'Goliath',           'force' => 5, 'traits' => ['brute',    'impact']],
            6 => ['name' => 'Shockfang',         'force' => 2, 'traits' => ['brute',    'impact']],
            7 => ['name' => 'Hollandais Volant', 'force' => 0, 'traits' => ['pirate',   'impact']],
            8 => ['name' => 'Lady Fortune',      'force' => 0, 'traits' => ['pirate',   'maitrise']],
            9 => ['name' => 'Davy Jones',        'force' => 2, 'traits' => ['pirate',   'impact']],
        ],
    ];

    // ---------------------------------------------------------------------------
    // Data accessors
    // ---------------------------------------------------------------------------

    public static function getBaseForce(int $rank, int $design): int
    {
        return self::$DATA[$rank][$design]['force'] ?? 0;
    }

    public static function getTraits(int $rank, int $design): array
    {
        return self::$DATA[$rank][$design]['traits'] ?? [];
    }

    public static function getName(int $rank, int $design): string
    {
        return self::$DATA[$rank][$design]['name'] ?? '?';
    }

    // ---------------------------------------------------------------------------
    // DB helpers
    // ---------------------------------------------------------------------------

    // Effective rank: base rank, or 3 (Gold) if pirate_gold token present
    public static function getEffectiveRank(int $playerId, int $gridPosition, int $baseRank, Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT id FROM bc_token
             WHERE player_id = {$playerId} AND grid_position = {$gridPosition}
               AND token_type = 'pirate_gold'
             LIMIT 1"
        );
        return !empty($row) ? 3 : $baseRank;
    }

    // Sum of gambler token values on a position (used in strength calculation)
    public static function getTokenStrengthBonus(int $playerId, int $gridPosition, Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT COALESCE(SUM(value), 0) AS total FROM bc_token
             WHERE player_id = {$playerId} AND grid_position = {$gridPosition}
               AND token_type = 'gambler'"
        );
        return (int)($row['total'] ?? 0);
    }

    // Player rage state: 0=calm, 1=enraged
    public static function getRage(int $playerId, Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT player_rage FROM player WHERE player_id = {$playerId}"
        );
        return (int)($row['player_rage'] ?? 0);
    }

    // Toggle rage, return new value
    public static function toggleRage(int $playerId, Game $game): int
    {
        $new = self::getRage($playerId, $game) === 0 ? 1 : 0;
        $game->DbQuery("UPDATE player SET player_rage = {$new} WHERE player_id = {$playerId}");
        return $new;
    }

    // Insert a token at a grid position
    public static function addToken(int $playerId, int $gridPosition, string $type, int $value, Game $game): void
    {
        $game->DbQuery(
            "INSERT INTO bc_token (player_id, grid_position, token_type, value)
             VALUES ({$playerId}, {$gridPosition}, '{$type}', {$value})"
        );
    }

    // Move uncharged→charged gems (up to $amount), return count actually charged
    public static function chargeGems(int $playerId, int $amount, Game $game): int
    {
        $avail = $game->gemsUncharged->get($playerId);
        $n     = min($amount, $avail);
        if ($n > 0) {
            $game->gemsCharged->inc($playerId, $n);
            $game->gemsUncharged->inc($playerId, -$n);
        }
        return $n;
    }

    // Move charged→uncharged gems (up to $amount), return count actually discharged
    public static function dischargeGems(int $playerId, int $amount, Game $game): int
    {
        $avail = $game->gemsCharged->get($playerId);
        $n     = min($amount, $avail);
        if ($n > 0) {
            $game->gemsCharged->inc($playerId, -$n);
            $game->gemsUncharged->inc($playerId, $n);
        }
        return $n;
    }

    // All face-up cards in a player's grid
    public static function getFaceUpCards(int $playerId, Game $game): array
    {
        return array_values($game->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family, card_location_arg AS position, card_face_up AS face_up
             FROM bc_card
             WHERE card_location = 'grid_{$playerId}' AND card_face_up = 1"
        ));
    }

    // Face-up cards in a specific column (col: 0=left, 1=center, 2=right)
    public static function getColumnCards(int $playerId, int $col, Game $game): array
    {
        return array_values(array_filter(
            self::getFaceUpCards($playerId, $game),
            fn($c) => ((int)$c['position'] % 3) === $col
        ));
    }

    // Count face-up cards carrying a specific trait
    public static function countTrait(int $playerId, string $trait, Game $game): int
    {
        return count(array_filter(
            self::getFaceUpCards($playerId, $game),
            fn($c) => in_array($trait, self::getTraits((int)$c['type'], (int)$c['type_arg']), true)
        ));
    }

    // Face-up cards that are effectively Gold rank (base or via pirate_gold token)
    public static function getGoldCards(int $playerId, Game $game): array
    {
        return array_values(array_filter(
            self::getFaceUpCards($playerId, $game),
            fn($c) => self::getEffectiveRank($playerId, (int)$c['position'], (int)$c['type'], $game) === 3
        ));
    }

    // Count face-up Bronze rank cards (pirate_gold upgrades them to Gold, so excluded)
    public static function countBronzeCards(int $playerId, Game $game): int
    {
        return count(array_filter(
            self::getFaceUpCards($playerId, $game),
            fn($c) => self::getEffectiveRank($playerId, (int)$c['position'], (int)$c['type'], $game) === 1
        ));
    }

    // ---------------------------------------------------------------------------
    // Effect engine
    // ---------------------------------------------------------------------------

    /**
     * Apply a card's effect and return the result.
     *
     * Side effects (DB writes) happen immediately: tokens, gems, rage, face-down flips.
     *
     * @param array   $card             {id, type, type_arg, family}
     * @param int     $playerId         Owner
     * @param int     $gridPosition     0–8
     * @param string  $phase            'influence' | 'combat'
     * @param ?array  $rivalCard        Rival card data (combat only)
     * @param ?int    $rivalPlayerId    Rival player id (combat only)
     * @param ?int    $rivalGridPos     Rival grid position (for gold-token check)
     *
     * @return array {strength_bonus, vp_bonus, after_combat, dice_roll, rage_toggle}
     */
    public static function applyEffect(
        array $card,
        int $playerId,
        int $gridPosition,
        string $phase,
        ?array $rivalCard,
        ?int $rivalPlayerId,
        ?int $rivalGridPos,
        Game $game
    ): array {
        $rank   = (int)$card['type'];
        $design = (int)$card['type_arg'];
        $col    = $gridPosition % 3; // 0=left-border, 1=center, 2=right-border

        $out = [
            'strength_bonus'         => 0,
            'vp_bonus'               => 0,
            'after_combat'           => false,
            'dice_roll'              => null,
            'rage_toggle'            => null,
            'effect_text'            => null,
            'card_flipped_face_down' => false,
        ];

        switch ("{$rank}:{$design}") {

            // --- Bronze ---

            case '1:1': // Amateur: roll die → token on next position (−1 / +1)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $next = $gridPosition + 3;
                if ($next <= 8) {
                    $val = $d <= 2 ? -1 : 1;
                    self::addToken($playerId, $next, 'gambler', $val, $game);
                    $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token on next pos';
                } else {
                    $out['effect_text'] = '🎲' . $d . ' (no next pos)';
                }
                break;

            case '1:2': // Parieur: share trait with rival → charge 1 gem
                if ($rivalCard !== null) {
                    $mine   = self::getTraits($rank, $design);
                    $theirs = self::getTraits((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if (!empty(array_intersect($mine, $theirs))) {
                        self::chargeGems($playerId, 1, $game);
                        $out['effect_text'] = 'shared trait → +1 gem';
                    } else {
                        $out['effect_text'] = 'no shared trait';
                    }
                }
                break;

            case '1:3': // Troll: enraged → +2 force; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $out['strength_bonus'] += 2;
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                $out['effect_text'] = $wasEnraged ? 'enraged → +2 str; now calm' : 'calm → now enraged';
                break;

            case '1:4': // Gros-bras: highest printed force in column → charge 1 gem
                $myF = self::getBaseForce($rank, $design);
                $top = true;
                foreach (self::getColumnCards($playerId, $col, $game) as $other) {
                    if ((int)$other['id'] === (int)$card['id']) continue;
                    if (self::getBaseForce((int)$other['type'], (int)$other['type_arg']) >= $myF) {
                        $top = false;
                        break;
                    }
                }
                if ($top) {
                    self::chargeGems($playerId, 1, $game);
                    $out['effect_text'] = 'highest in col → +1 gem';
                } else {
                    $out['effect_text'] = 'not highest in col';
                }
                break;

            case '1:5': // Mousse: border only → flip face-down, charge 2 gems
                if ($col !== 1) {
                    $game->DbQuery(
                        "UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$card['id']}"
                    );
                    $game->DbQuery(
                        "DELETE FROM bc_token WHERE player_id = {$playerId} AND grid_position = {$gridPosition}"
                    );
                    self::chargeGems($playerId, 2, $game);
                    $out['effect_text'] = 'border → face-down, +2 gems';
                    $out['card_flipped_face_down'] = true;
                } else {
                    $out['effect_text'] = 'center (no effect)';
                }
                break;

            case '1:6': // Quartier-Maître: add pirate_gold token on this card
                self::addToken($playerId, $gridPosition, 'pirate_gold', 0, $game);
                $out['effect_text'] = 'pirate gold token here';
                break;

            // --- Silver Flambeur ---

            case '2:1': // Bookmaker: roll die → token on next position (−2 / +4)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $next = $gridPosition + 3;
                if ($next <= 8) {
                    $val = $d <= 2 ? -2 : 4;
                    self::addToken($playerId, $next, 'gambler', $val, $game);
                    $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token on next pos';
                } else {
                    $out['effect_text'] = '🎲' . $d . ' (no next pos)';
                }
                break;

            case '2:2': // Croupier: +1 force per Impact card
                $n = self::countTrait($playerId, 'impact', $game);
                $out['strength_bonus'] += $n;
                $out['effect_text'] = $n > 0 ? '+' . $n . ' str (' . $n . ' Impact card(s))' : 'no Impact cards';
                break;

            case '2:3': // Pièce: roll die → token on THIS card (−3 / +3)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -3 : 3;
                self::addToken($playerId, $gridPosition, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token here';
                break;

            case '2:4': // Tricheur: charge 1 gem; +2 force per charged gem (after charge)
                self::chargeGems($playerId, 1, $game);
                $charged = $game->gemsCharged->get($playerId);
                $out['strength_bonus'] += 2 * $charged;
                $out['effect_text'] = '+1 gem (' . $charged . ' charged) → +' . (2 * $charged) . ' str';
                break;

            case '2:5': // Mécène: collect all gambler tokens from this column → flip to +
                $colPositions = [$col, $col + 3, $col + 6]; // all 3 positions in this column
                $posStr       = implode(',', $colPositions);
                $tokens       = $game->getCollectionFromDb(
                    "SELECT id, value FROM bc_token
                     WHERE player_id = {$playerId}
                       AND grid_position IN ({$posStr})
                       AND token_type = 'gambler'"
                );
                $total = 0;
                foreach ($tokens as $tk) {
                    $total += abs((int)$tk['value']);
                    $game->DbQuery("DELETE FROM bc_token WHERE id = {$tk['id']}");
                }
                if ($total > 0) {
                    self::addToken($playerId, $gridPosition, 'gambler', $total, $game);
                    $out['effect_text'] = 'collected ' . $total . ' → +' . $total . ' token here';
                } else {
                    $out['effect_text'] = 'no tokens to collect';
                }
                break;

            case '2:6': // Complice: roll die, gain that value as force
                $d = rand(1, 6);
                $out['dice_roll']      = $d;
                $out['strength_bonus'] += $d;
                $out['effect_text'] = '🎲' . $d . ' → +' . $d . ' str';
                break;

            // --- Silver Brute ---

            case '2:7': // Mercenaire: enraged → +3 force; calm → toggle rage
                if (self::getRage($playerId, $game) === 1) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = 'enraged → +3 str';
                } else {
                    $out['rage_toggle'] = self::toggleRage($playerId, $game);
                    $out['effect_text'] = 'calm → now enraged';
                }
                break;

            case '2:8': // Grizzly: border → discharge 1 gem (mandatory) → +5 force; always toggle rage
                if ($col !== 1) {
                    $discharged = self::dischargeGems($playerId, 1, $game);
                    if ($discharged > 0) {
                        $out['strength_bonus'] += 5;
                        $out['effect_text'] = '−1 gem → +5 str; rage toggled';
                    } else {
                        $out['effect_text'] = 'no charged gem; rage toggled';
                    }
                } else {
                    $out['effect_text'] = 'center → rage toggled';
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                break;

            case '2:9': // Videur: +4 force if rival printed force > 2; calm → toggle rage
                $parts = [];
                if ($rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if ($rivalForce > 2) {
                        $out['strength_bonus'] += 4;
                        $parts[] = 'rival force ' . $rivalForce . ' → +4 str';
                    } else {
                        $parts[] = 'rival force ' . $rivalForce . ' (no bonus)';
                    }
                }
                if (self::getRage($playerId, $game) === 0) {
                    $out['rage_toggle'] = self::toggleRage($playerId, $game);
                    $parts[] = 'calm → enraged';
                }
                $out['effect_text'] = !empty($parts) ? implode('; ', $parts) : null;
                break;

            case '2:10': // Berserker: calm → gain rival's printed force as bonus
                if (self::getRage($playerId, $game) === 0 && $rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    $out['strength_bonus'] += $rivalForce;
                    $out['effect_text'] = 'calm → +' . $rivalForce . ' str (rival force)';
                } else {
                    $out['effect_text'] = 'enraged (no bonus)';
                }
                break;

            case '2:11': // Loup-Garou: enraged → 2 VP; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $out['vp_bonus'] += 2;
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                $out['effect_text'] = $wasEnraged ? 'enraged → +2 VP; now calm' : 'calm → now enraged';
                break;

            case '2:12': // Barbare: enraged → +1 force per Impact card
                if (self::getRage($playerId, $game) === 1) {
                    $n = self::countTrait($playerId, 'impact', $game);
                    $out['strength_bonus'] += $n;
                    $out['effect_text'] = 'enraged → +' . $n . ' str (' . $n . ' Impact)';
                } else {
                    $out['effect_text'] = 'calm (no bonus)';
                }
                break;

            // --- Silver Pirate ---

            case '2:13': // Pillard: any Gold card in play → charge 2 gems
                if (count(self::getGoldCards($playerId, $game)) > 0) {
                    self::chargeGems($playerId, 2, $game);
                    $out['effect_text'] = 'Gold in play → +2 gems';
                } else {
                    $out['effect_text'] = 'no Gold (no charge)';
                }
                break;

            case '2:14': // Second: +3 force per Gold card in this column
                $bonus = 0;
                foreach (self::getColumnCards($playerId, $col, $game) as $other) {
                    if (self::getEffectiveRank($playerId, (int)$other['position'], (int)$other['type'], $game) === 3) {
                        $bonus += 3;
                    }
                }
                $out['strength_bonus'] += $bonus;
                $out['effect_text'] = $bonus > 0 ? '+' . $bonus . ' str (' . intdiv($bonus, 3) . ' Gold in col)' : 'no Gold in col';
                break;

            case '2:15': // Boucanier: +3 force if no Bronze card in play
                if (self::countBronzeCards($playerId, $game) === 0) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = 'no Bronze → +3 str';
                } else {
                    $out['effect_text'] = 'Bronze in play (no bonus)';
                }
                break;

            case '2:16': // Artificier: previous position is Gold → gain its printed force
                $prev = $gridPosition - 3;
                if ($prev >= 0) {
                    $prevCard = $game->getObjectFromDB(
                        "SELECT card_type AS type, card_type_arg AS type_arg, card_face_up AS face_up
                         FROM bc_card
                         WHERE card_location = 'grid_{$playerId}' AND card_location_arg = {$prev}
                         LIMIT 1"
                    );
                    if (!empty($prevCard) && (int)$prevCard['face_up'] === 1) {
                        $effRank = self::getEffectiveRank($playerId, $prev, (int)$prevCard['type'], $game);
                        if ($effRank === 3) {
                            $force = self::getBaseForce((int)$prevCard['type'], (int)$prevCard['type_arg']);
                            $out['strength_bonus'] += $force;
                            $out['effect_text'] = 'prev pos Gold → +' . $force . ' str';
                        } else {
                            $out['effect_text'] = 'prev pos not Gold';
                        }
                    } else {
                        $out['effect_text'] = 'no face-up card on prev pos';
                    }
                } else {
                    $out['effect_text'] = 'row 1 (no prev pos)';
                }
                break;

            case '2:17': // Vigie: +4 force if rival is effectively Gold
                if ($rivalCard !== null && $rivalPlayerId !== null && $rivalGridPos !== null) {
                    $effRank = self::getEffectiveRank($rivalPlayerId, $rivalGridPos, (int)$rivalCard['type'], $game);
                    if ($effRank === 3) {
                        $out['strength_bonus'] += 4;
                        $out['effect_text'] = 'rival is Gold → +4 str';
                    } else {
                        $out['effect_text'] = 'rival not Gold (no bonus)';
                    }
                }
                break;

            case '2:18': // Navigateur: pirate_gold token on this card AND next position
                self::addToken($playerId, $gridPosition, 'pirate_gold', 0, $game);
                $next = $gridPosition + 3;
                if ($next <= 8) {
                    self::addToken($playerId, $next, 'pirate_gold', 0, $game);
                    $out['effect_text'] = 'pirate gold here + next pos';
                } else {
                    $out['effect_text'] = 'pirate gold here (row 3, no next)';
                }
                break;

            // --- Gold Flambeur ---

            case '3:1': // Jack Jackpot: roll die: 1–2 → −4 token; 3–4 → charge all; 5–6 → +8 token
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                if ($d <= 2) {
                    self::addToken($playerId, $gridPosition, 'gambler', -4, $game);
                    $out['effect_text'] = '🎲' . $d . ' → −4 token here';
                } elseif ($d <= 4) {
                    self::chargeGems($playerId, 3, $game);
                    $out['effect_text'] = '🎲' . $d . ' → charge all gems';
                } else {
                    self::addToken($playerId, $gridPosition, 'gambler', 8, $game);
                    $out['effect_text'] = '🎲' . $d . ' → +8 token here';
                }
                break;

            case '3:2': // Poker Face: collect ALL gambler tokens in play → flip to +
                $tokens = $game->getCollectionFromDb(
                    "SELECT id, value FROM bc_token
                     WHERE player_id = {$playerId} AND token_type = 'gambler'"
                );
                $total = 0;
                foreach ($tokens as $tk) {
                    $total += abs((int)$tk['value']);
                    $game->DbQuery("DELETE FROM bc_token WHERE id = {$tk['id']}");
                }
                if ($total > 0) {
                    self::addToken($playerId, $gridPosition, 'gambler', $total, $game);
                    $out['effect_text'] = 'collected ' . $total . ' → +' . $total . ' token here';
                } else {
                    $out['effect_text'] = 'no tokens in play';
                }
                break;

            case '3:3': // Double 6: after combat, winner rolls die and adds to VP
                $out['after_combat'] = true;
                $out['effect_text'] = 'winner rolls 🎲 for bonus VP';
                break;

            // --- Gold Brute ---

            case '3:4': // Brunhilde: enraged → add printed force of other face-up column cards; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    foreach (self::getColumnCards($playerId, $col, $game) as $other) {
                        if ((int)$other['id'] === (int)$card['id']) continue;
                        $out['strength_bonus'] += self::getBaseForce((int)$other['type'], (int)$other['type_arg']);
                    }
                    $out['effect_text'] = 'enraged → +' . $out['strength_bonus'] . ' str (col cards); now calm';
                } else {
                    $out['effect_text'] = 'calm → now enraged';
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                break;

            case '3:5': // Goliath: enraged → discharge all gems, +3 force per gem discharged
                if (self::getRage($playerId, $game) === 1) {
                    $n = self::dischargeGems($playerId, $game->gemsCharged->get($playerId), $game);
                    $out['strength_bonus'] += 3 * $n;
                    $out['effect_text'] = $n > 0 ? 'enraged → −' . $n . ' gems → +' . (3 * $n) . ' str' : 'enraged but no gems';
                } else {
                    $out['effect_text'] = 'calm (no bonus)';
                }
                break;

            case '3:6': // Shockfang: enraged → +8 force; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $out['strength_bonus'] += 8;
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                $out['effect_text'] = $wasEnraged ? 'enraged → +8 str; now calm' : 'calm → now enraged';
                break;

            // --- Gold Pirate ---

            case '3:7': // Hollandais Volant: flip OTHER face-up Gold cards face-down, +4 force each
                $flipped = 0;
                foreach (self::getFaceUpCards($playerId, $game) as $other) {
                    if ((int)$other['id'] === (int)$card['id']) continue;
                    if (self::getEffectiveRank($playerId, (int)$other['position'], (int)$other['type'], $game) === 3) {
                        $game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$other['id']}");
                        $game->DbQuery(
                            "DELETE FROM bc_token WHERE player_id = {$playerId} AND grid_position = " . (int)$other['position']
                        );
                        $flipped++;
                    }
                }
                $out['strength_bonus'] += 4 * $flipped;
                $out['effect_text'] = $flipped > 0 ? 'flipped ' . $flipped . ' Gold → +' . (4 * $flipped) . ' str' : 'no Gold to flip';
                break;

            case '3:8': // Lady Fortune: 2 VP per Gold card in play (including this one)
                $goldCount = count(self::getGoldCards($playerId, $game));
                $out['vp_bonus'] += 2 * $goldCount;
                $out['effect_text'] = '+2 VP × ' . $goldCount . ' Gold = +' . (2 * $goldCount) . ' VP';
                break;

            case '3:9': // Davy Jones: +2 force per Gold card, −1 force per Bronze card
                $goldCount   = count(self::getGoldCards($playerId, $game));
                $bronzeCount = self::countBronzeCards($playerId, $game);
                $bonus       = 2 * $goldCount - $bronzeCount;
                $out['strength_bonus'] += $bonus;
                $textParts = [];
                if ($goldCount > 0)   $textParts[] = '+' . (2 * $goldCount) . ' (' . $goldCount . ' Gold)';
                if ($bronzeCount > 0) $textParts[] = '−' . $bronzeCount . ' (' . $bronzeCount . ' Bronze)';
                $out['effect_text'] = !empty($textParts)
                    ? implode(' ', $textParts) . ' = ' . ($bonus >= 0 ? '+' . $bonus : $bonus) . ' str'
                    : 'no Gold or Bronze';
                break;
        }

        return $out;
    }

    // ===========================================================================
    // BOT / SOLO MODE
    // ===========================================================================

    // Force Solo values per (rank, design) — printed on the card's bottom-right.
    // Cards without a "+ effect" suffix have flat values; others are the base value
    // (the applyBotEffect() call adds the additional bonus on top).
    private static array $BOT_FORCE = [
        1 => [1 => 2, 2 => 3, 3 => 2, 4 => 4, 5 => 3, 6 => 3],
        2 => [
             1 => 4,  2 => 5,  3 => 4,  4 => 6,  5 => 7,  6 => 3,
             7 => 3,  8 => 6,  9 => 3, 10 => 4, 11 => 7, 12 => 7,
            13 => 6, 14 => 4, 15 => 4, 16 => 5, 17 => 4, 18 => 5,
        ],
        3 => [1 => 8, 2 => 8, 3 => 7, 4 => 9, 5 => 9, 6 => 4, 7 => 9, 8 => 4, 9 => 9],
    ];

    public static function getBotBaseForce(int $rank, int $design): int
    {
        return self::$BOT_FORCE[$rank][$design] ?? 0;
    }

    // Bot grid position: left column = row (0-2), right column = row + 3 (3-5).
    // Used as grid_position in bc_token rows where player_id = BOT_PLAYER_ID.
    public static function botGridPos(string $side, int $row): int
    {
        return $side === 'left' ? $row : $row + 3;
    }

    // Sum of gambler token values on a bot grid position.
    public static function getBotTokenBonus(int $botGridPos, Game $game): int
    {
        return self::getTokenStrengthBonus(self::BOT_PLAYER_ID, $botGridPos, $game);
    }

    /**
     * Apply a bot card's effect (solo mode only).
     *
     * Only cards marked with a lightning-bolt icon in the rules apply an effect;
     * all others are captured entirely by getBotBaseForce().
     *
     * @param array  $card        {id, type, type_arg, family}
     * @param string $side        'left' | 'right'
     * @param int    $row         0-2 (current turn row)
     * @param ?array $rivalCard   Rival (player) card data
     * @param ?int   $rivalPlayerId
     * @param ?int   $rivalGridPos  0-8 in the player's grid
     *
     * @return array {strength_bonus, vp_bonus, after_combat, dice_roll, rage_toggle}
     */
    public static function applyBotEffect(
        array $card,
        string $side,
        int $row,
        ?array $rivalCard,
        ?int $rivalPlayerId,
        ?int $rivalGridPos,
        Game $game
    ): array {
        $rank    = (int)$card['type'];
        $design  = (int)$card['type_arg'];
        $pos     = self::botGridPos($side, $row);
        $nextPos = $pos + 1; // next row in same column (left: 0→1→2, right: 3→4→5)
        $botRage = (int)($game->bga->globals->get('bot_rage') ?? 0);

        $out = [
            'strength_bonus' => 0,
            'vp_bonus'       => 0,
            'after_combat'   => false,
            'dice_roll'      => null,
            'rage_toggle'    => null,
            'effect_text'    => null,
        ];

        switch ("{$rank}:{$design}") {

            case '1:1': // Amateur: roll die → gambler token on next row
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                if ($row < 2) {
                    $val = $d <= 2 ? -1 : 1;
                    self::addToken(self::BOT_PLAYER_ID, $nextPos, 'gambler', $val, $game);
                    $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token on next row';
                } else {
                    $out['effect_text'] = '🎲' . $d . ' (no next row)';
                }
                break;

            case '1:3': // Troll: enraged → +2 force; always toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 2;
                }
                $newRage = $botRage === 0 ? 1 : 0;
                $game->bga->globals->set('bot_rage', $newRage);
                $out['rage_toggle'] = $newRage;
                $out['effect_text'] = $botRage === 1 ? 'enraged → +2 str; now calm' : 'calm → now enraged';
                break;

            case '1:6': // Quartier-Maître: pirate_gold token on this position
                self::addToken(self::BOT_PLAYER_ID, $pos, 'pirate_gold', 0, $game);
                $out['effect_text'] = 'pirate gold token here';
                break;

            case '2:1': // Bookmaker: roll die → gambler token on next row
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                if ($row < 2) {
                    $val = $d <= 2 ? -2 : 4;
                    self::addToken(self::BOT_PLAYER_ID, $nextPos, 'gambler', $val, $game);
                    $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token on next row';
                } else {
                    $out['effect_text'] = '🎲' . $d . ' (no next row)';
                }
                break;

            case '2:3': // Pièce: roll die → gambler token on this position
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -3 : 3;
                self::addToken(self::BOT_PLAYER_ID, $pos, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . ' token here';
                break;

            case '2:6': // Complice: roll die, add result to force
                $d = rand(1, 6);
                $out['dice_roll']      = $d;
                $out['strength_bonus'] += $d;
                $out['effect_text'] = '🎲' . $d . ' → +' . $d . ' str';
                break;

            case '2:7': // Mercenaire: enraged → +3; calm → toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = 'enraged → +3 str';
                } else {
                    $game->bga->globals->set('bot_rage', 1);
                    $out['rage_toggle'] = 1;
                    $out['effect_text'] = 'calm → now enraged';
                }
                break;

            case '2:9': // Videur: +4 if rival printed force > 2; calm → toggle rage
                $parts = [];
                if ($rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if ($rivalForce > 2) {
                        $out['strength_bonus'] += 4;
                        $parts[] = 'rival force ' . $rivalForce . ' → +4 str';
                    } else {
                        $parts[] = 'rival force ' . $rivalForce . ' (no bonus)';
                    }
                }
                if ($botRage === 0) {
                    $game->bga->globals->set('bot_rage', 1);
                    $out['rage_toggle'] = 1;
                    $parts[] = 'calm → enraged';
                }
                $out['effect_text'] = !empty($parts) ? implode('; ', $parts) : null;
                break;

            case '2:10': // Berserker: calm → gain rival's printed force
                if ($botRage === 0 && $rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    $out['strength_bonus'] += $rivalForce;
                    $out['effect_text'] = 'calm → +' . $rivalForce . ' str (rival force)';
                } else {
                    $out['effect_text'] = 'enraged (no bonus)';
                }
                break;

            case '2:14': // Second: +3 per Gold card in this bot column
                $bonus = 0;
                for ($r = 0; $r <= $row; $r++) {
                    $p    = self::botGridPos($side, $r);
                    $row2 = $game->getObjectFromDB(
                        "SELECT card_type AS type FROM bc_card
                         WHERE card_location = 'bot_grid_{$side}' AND card_location_arg = {$r}
                           AND card_face_up = 1"
                    );
                    if (!empty($row2) && self::getBotEffectiveRank($p, (int)$row2['type'], $game) === 3) {
                        $bonus += 3;
                    }
                }
                $out['strength_bonus'] += $bonus;
                $out['effect_text'] = $bonus > 0 ? '+' . $bonus . ' str (' . intdiv($bonus, 3) . ' Gold in col)' : 'no Gold in col';
                break;

            case '2:15': // Boucanier: +3 if bot has no face-up Bronze cards
                if (self::countBotBronzeCards($game) === 0) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = 'no Bronze → +3 str';
                } else {
                    $out['effect_text'] = 'Bronze in play (no bonus)';
                }
                break;

            case '2:16': // Artificier: previous row is Gold → add its printed force
                if ($row > 0) {
                    $prevPos  = self::botGridPos($side, $row - 1);
                    $prevCard = $game->getObjectFromDB(
                        "SELECT card_type AS type, card_type_arg AS type_arg
                         FROM bc_card
                         WHERE card_location = 'bot_grid_{$side}'
                           AND card_location_arg = " . ($row - 1)
                    );
                    if (!empty($prevCard)
                        && self::getBotEffectiveRank($prevPos, (int)$prevCard['type'], $game) === 3) {
                        $force = self::getBaseForce((int)$prevCard['type'], (int)$prevCard['type_arg']);
                        $out['strength_bonus'] += $force;
                        $out['effect_text'] = 'prev row Gold → +' . $force . ' str';
                    } else {
                        $out['effect_text'] = 'prev row not Gold';
                    }
                } else {
                    $out['effect_text'] = 'row 1 (no prev row)';
                }
                break;

            case '2:17': // Vigie: +4 if rival is effectively Gold
                if ($rivalCard !== null && $rivalPlayerId !== null && $rivalGridPos !== null) {
                    if (self::getEffectiveRank($rivalPlayerId, $rivalGridPos, (int)$rivalCard['type'], $game) === 3) {
                        $out['strength_bonus'] += 4;
                        $out['effect_text'] = 'rival is Gold → +4 str';
                    } else {
                        $out['effect_text'] = 'rival not Gold (no bonus)';
                    }
                }
                break;

            case '2:18': // Navigateur: pirate_gold on this position and next row
                self::addToken(self::BOT_PLAYER_ID, $pos, 'pirate_gold', 0, $game);
                if ($row < 2) {
                    self::addToken(self::BOT_PLAYER_ID, $nextPos, 'pirate_gold', 0, $game);
                    $out['effect_text'] = 'pirate gold here + next row';
                } else {
                    $out['effect_text'] = 'pirate gold here (row 3, no next)';
                }
                break;

            case '3:3': // Double 6: after combat, winner rolls die
                $out['after_combat'] = true;
                $out['effect_text'] = 'winner rolls 🎲 for bonus VP';
                break;

            case '3:6': // Shockfang: enraged → +8; always toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 8;
                }
                $newRage = $botRage === 0 ? 1 : 0;
                $game->bga->globals->set('bot_rage', $newRage);
                $out['rage_toggle'] = $newRage;
                $out['effect_text'] = $botRage === 1 ? 'enraged → +8 str; now calm' : 'calm → now enraged';
                break;

            case '3:8': // Lady Fortune: 2 VP per bot Gold card in play
                $goldCount = self::countBotGoldCards($game);
                $out['vp_bonus'] += 2 * $goldCount;
                $out['effect_text'] = '+2 VP × ' . $goldCount . ' Gold = +' . (2 * $goldCount) . ' VP';
                break;
        }

        return $out;
    }

    // Effective rank for a bot card at a given bot grid position.
    private static function getBotEffectiveRank(int $botGridPos, int $baseRank, Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT id FROM bc_token
             WHERE player_id = 0 AND grid_position = {$botGridPos}
               AND token_type = 'pirate_gold'
             LIMIT 1"
        );
        return !empty($row) ? 3 : $baseRank;
    }

    // Count bot face-up Gold cards (base rank 3 or upgraded via pirate_gold token).
    private static function countBotGoldCards(Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT COUNT(*) AS cnt FROM bc_card
             WHERE card_location IN ('bot_grid_left', 'bot_grid_right')
               AND card_type = 3 AND card_face_up = 1"
        );
        $count = (int)($row['cnt'] ?? 0);

        // Add non-Gold cards that carry a pirate_gold token
        $tokens = $game->getCollectionFromDb(
            "SELECT grid_position FROM bc_token
             WHERE player_id = 0 AND token_type = 'pirate_gold'"
        );
        foreach ($tokens as $tk) {
            $gp   = (int)$tk['grid_position'];
            $sloc = $gp < 3 ? 'bot_grid_left' : 'bot_grid_right';
            $r    = $gp < 3 ? $gp : $gp - 3;
            $c    = $game->getObjectFromDB(
                "SELECT card_type FROM bc_card
                 WHERE card_location = '{$sloc}' AND card_location_arg = {$r}
                   AND card_face_up = 1 AND card_type != 3"
            );
            if (!empty($c)) {
                $count++;
            }
        }
        return $count;
    }

    // Count bot face-up Bronze cards not upgraded to Gold by a pirate_gold token.
    private static function countBotBronzeCards(Game $game): int
    {
        $bronzeRows = $game->getCollectionFromDb(
            "SELECT card_location, card_location_arg AS lrow FROM bc_card
             WHERE card_location IN ('bot_grid_left', 'bot_grid_right')
               AND card_type = 1 AND card_face_up = 1"
        );
        $upgradedKeys = [];
        $tokens = $game->getCollectionFromDb(
            "SELECT grid_position FROM bc_token WHERE player_id = 0 AND token_type = 'pirate_gold'"
        );
        foreach ($tokens as $tk) {
            $gp  = (int)$tk['grid_position'];
            $loc = $gp < 3 ? 'bot_grid_left' : 'bot_grid_right';
            $r   = $gp < 3 ? $gp : $gp - 3;
            $upgradedKeys[] = "{$loc}:{$r}";
        }
        $count = 0;
        foreach ($bronzeRows as $c) {
            $key = "{$c['card_location']}:{$c['lrow']}";
            if (!in_array($key, $upgradedKeys, true)) {
                $count++;
            }
        }
        return $count;
    }
}
