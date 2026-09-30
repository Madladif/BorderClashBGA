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
    // Card data: [rank][design] = ['name', 'force', 'traits', 'force_automa', 'eclair']
    // rank 1=Bronze (design 1-6), 2=Silver (design 1-18), 3=Gold (design 1-9)
    // Source of truth: docs/cartes.csv (id column: Bronze 1-6, Silver 7-24, Gold 25-33)
    // force_automa = printed violet value (solo mode) ; eclair = effect active in solo (R-10.6)
    // ---------------------------------------------------------------------------
    private static array $DATA = [
        1 => [ // Bronze — cartes.csv id 1-6
            1 => ['name' => 'High Roller', 'force' => 2, 'force_automa' => 2,  'eclair' => true,  'traits' => ['gambler', 'arcane']],
            2 => ['name' => 'Amateur',     'force' => 2, 'force_automa' => 3,  'eclair' => false, 'traits' => ['gambler', 'mastery']],
            3 => ['name' => 'Cabin Boy',   'force' => 2, 'force_automa' => 2,  'eclair' => true,  'traits' => ['pirate',  'arcane']],
            4 => ['name' => 'Freebooter',  'force' => 2, 'force_automa' => 3,  'eclair' => false, 'traits' => ['pirate',  'mastery']],
            5 => ['name' => 'Berserker', 'force' => 3, 'force_automa' => 4,  'eclair' => false, 'traits' => ['brute',   'mastery']],
            6 => ['name' => 'Troll',     'force' => 2, 'force_automa' => 2,  'eclair' => true,  'traits' => ['brute',   'impact']],
        ],
        2 => [ // Silver — cartes.csv id 7-24 (design = id-6)
            1  => ['name' => 'Barbarian',   'force' => 3, 'force_automa' => 7,  'eclair' => false, 'traits' => ['brute',   'impact']],
            2  => ['name' => 'Goon',        'force' => 3, 'force_automa' => 7,  'eclair' => false, 'traits' => ['brute',   'impact']],
            3  => ['name' => 'The Defender', 'force' => 3, 'force_automa' => 4,  'eclair' => true,  'traits' => ['brute',   'impact']],
            4  => ['name' => 'Werewolf',    'force' => 4, 'force_automa' => 5,  'eclair' => true,  'traits' => ['brute',   'mastery']],
            5  => ['name' => 'Mercenary',   'force' => 2, 'force_automa' => 4,  'eclair' => true,  'traits' => ['brute',   'impact']],
            6  => ['name' => 'Bouncer',     'force' => 2, 'force_automa' => 3,  'eclair' => true,  'traits' => ['brute',   'impact']],
            7  => ['name' => 'Bookie',      'force' => 3, 'force_automa' => 6,  'eclair' => false, 'traits' => ['gambler', 'arcane']],
            8  => ['name' => 'Lucky Dog',   'force' => 2, 'force_automa' => 2,  'eclair' => true,  'traits' => ['gambler', 'impact']],
            9  => ['name' => 'Accomplice',  'force' => 3, 'force_automa' => 5,  'eclair' => false, 'traits' => ['gambler', 'impact']],
            10 => ['name' => 'Dealer',      'force' => 4, 'force_automa' => 4,  'eclair' => true,  'traits' => ['gambler', 'arcane']],
            11 => ['name' => 'Benefactor',  'force' => 0, 'force_automa' => 7,  'eclair' => false, 'traits' => ['gambler', 'impact']],
            12 => ['name' => 'Cheater',     'force' => 2, 'force_automa' => 6,  'eclair' => false, 'traits' => ['gambler', 'mastery']],
            13 => ['name' => 'Bombardier',  'force' => 3, 'force_automa' => 3,  'eclair' => true,  'traits' => ['pirate',  'impact']],
            14 => ['name' => 'Navigator',   'force' => 4, 'force_automa' => 5,  'eclair' => true,  'traits' => ['pirate',  'arcane']],
            15 => ['name' => 'Raider',      'force' => 4, 'force_automa' => 6,  'eclair' => false, 'traits' => ['pirate',  'mastery']],
            16 => ['name' => 'First Mate',  'force' => 2, 'force_automa' => 4,  'eclair' => true,  'traits' => ['pirate',  'impact']],
            17 => ['name' => 'Lookout',     'force' => 4, 'force_automa' => 4,  'eclair' => true,  'traits' => ['pirate',  'impact']],
            18 => ['name' => 'Buccaneer',   'force' => 2, 'force_automa' => 4,  'eclair' => true,  'traits' => ['pirate',  'impact']],
        ],
        3 => [ // Gold — cartes.csv id 25-33 (design = id-24)
            1 => ['name' => 'Brunhilde',        'force' => 3, 'force_automa' => 9,  'eclair' => false, 'traits' => ['brute',   'impact']],
            2 => ['name' => 'Goliath',          'force' => 5, 'force_automa' => 5,  'eclair' => true,  'traits' => ['brute',   'impact']],
            3 => ['name' => 'Shock Fang',       'force' => 4, 'force_automa' => 10, 'eclair' => false, 'traits' => ['brute',   'impact']],
            4 => ['name' => 'Crazy 6',          'force' => 6, 'force_automa' => 6,  'eclair' => true,  'traits' => ['gambler', 'impact']],
            5 => ['name' => 'Mad Dice',         'force' => 6, 'force_automa' => 6,  'eclair' => true,  'traits' => ['gambler', 'arcane']],
            6 => ['name' => 'Poker Face',       'force' => 3, 'force_automa' => 9,  'eclair' => false, 'traits' => ['gambler', 'mastery']],
            7 => ['name' => 'Davy Jones',       'force' => 2, 'force_automa' => 10, 'eclair' => false, 'traits' => ['pirate',  'impact']],
            8 => ['name' => 'Flying Dutchman',  'force' => 0, 'force_automa' => 9,  'eclair' => false, 'traits' => ['pirate',  'impact']],
            9 => ['name' => 'Lady Fortune',     'force' => 3, 'force_automa' => 5,  'eclair' => true,  'traits' => ['pirate',  'mastery']],
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

    // Family for a given rank/design (used by Game::createAllCards — no formula, data-driven per R-8.1)
    public static function getFamily(int $rank, int $design): int
    {
        $trait = self::$DATA[$rank][$design]['traits'][0] ?? '';
        return match ($trait) {
            'gambler' => Game::FAMILY_GAMBLER,
            'brute'   => Game::FAMILY_BRUTE,
            'pirate'  => Game::FAMILY_PIRATE,
            default   => 0,
        };
    }

    public static function isEclair(int $rank, int $design): bool
    {
        return self::$DATA[$rank][$design]['eclair'] ?? false;
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

    // Face-up cards in a specific row (row: 0-2, i.e. turn 1-3's cards)
    public static function getRowCards(int $playerId, int $row, Game $game): array
    {
        return array_values(array_filter(
            self::getFaceUpCards($playerId, $game),
            fn($c) => intdiv((int)$c['position'], 3) === $row
        ));
    }

    // Count cards in an arbitrary already-fetched list whose EFFECTIVE rank matches $rank.
    public static function countEffectiveRankIn(array $cards, int $rank, int $playerId, Game $game): int
    {
        return count(array_filter(
            $cards,
            fn($c) => self::getEffectiveRank($playerId, (int)$c['position'], (int)$c['type'], $game) === $rank
        ));
    }

    // Total token count (any type) on a player's grid — bc_token rows are always
    // per-(player, position), and are deleted when their card flips face down, so a
    // plain count is exactly "tokens on your grid".
    public static function countAllTokens(int $playerId, Game $game): int
    {
        $row = $game->getObjectFromDB(
            "SELECT COUNT(*) AS cnt FROM bc_token WHERE player_id = {$playerId}"
        );
        return (int)($row['cnt'] ?? 0);
    }

    // A gambler token's "plus face" value — the pairs are not symmetric (e.g. -2 ↔ +4),
    // so this must be a lookup, not abs(). See docs/CARD_EFFECTS.md §1.
    public static function plusValueOf(int $value): int
    {
        return match ($value) {
            -1, 1  => 1,
            -2, 4  => 4,
            -3, 3  => 3,
            -4, 8  => 8,
            default => abs($value),
        };
    }

    // Gather all 'gambler' tokens found at $positions onto $targetPos, flipped to their
    // plus face (moved individually — NOT summed into one token; see Cheater/Poker Face).
    // Returns the number of tokens moved.
    public static function gatherAndFlipTokens(int $playerId, array $positions, int $targetPos, Game $game): int
    {
        if (empty($positions)) {
            return 0;
        }
        $posStr = implode(',', $positions);
        $tokens = $game->getCollectionFromDb(
            "SELECT id, value FROM bc_token
             WHERE player_id = {$playerId}
               AND grid_position IN ({$posStr})
               AND token_type = 'gambler'"
        );
        foreach ($tokens as $tk) {
            $newVal = self::plusValueOf((int)$tk['value']);
            $game->DbQuery(
                "UPDATE bc_token SET grid_position = {$targetPos}, value = {$newVal} WHERE id = {$tk['id']}"
            );
        }
        return count($tokens);
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
            'dice_rolls'             => null, // Crazy 6: one roll per token, animated one after another
            'rage_toggle'            => null,
            'effect_text'            => null,
            'card_flipped_face_down' => false,
            'flipped_below'          => null, // ['position' => int, 'family' => int] — Bombardier flips a DIFFERENT card than itself
        ];

        switch ("{$rank}:{$design}") {

            // --- Bronze ---

            case '1:1': // High Roller: roll die → token on THIS card (−1 / +1)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -1 : 1;
                self::addToken($playerId, $gridPosition, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '1:2': // Amateur: share trait with rival → charge 1 gem
                if ($rivalCard !== null) {
                    $mine   = self::getTraits($rank, $design);
                    $theirs = self::getTraits((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if (!empty(array_intersect($mine, $theirs))) {
                        self::chargeGems($playerId, 1, $game);
                        $out['effect_text'] = clienttranslate('shared trait → +1 gem');
                    } else {
                        $out['effect_text'] = clienttranslate('no shared trait');
                    }
                }
                break;

            case '1:3': // Cabin Boy: add pirate_gold token on this card
                self::addToken($playerId, $gridPosition, 'pirate_gold', 0, $game);
                $out['effect_text'] = clienttranslate('pirate gold token here');
                break;

            case '1:4': // Freebooter: border only → flip face-down, charge 2 gems
                if ($col !== 1) {
                    $game->DbQuery(
                        "UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$card['id']}"
                    );
                    $game->DbQuery(
                        "DELETE FROM bc_token WHERE player_id = {$playerId} AND grid_position = {$gridPosition}"
                    );
                    self::chargeGems($playerId, 2, $game);
                    $out['effect_text'] = clienttranslate('border → face-down, +2 gems');
                    $out['card_flipped_face_down'] = true;
                } else {
                    $out['effect_text'] = clienttranslate('center (no effect)');
                }
                break;

            case '1:5': // Berserker: highest printed force in column (strictly) → charge 1 gem
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
                    $out['effect_text'] = clienttranslate('highest in col → +1 gem');
                } else {
                    $out['effect_text'] = clienttranslate('not highest in col');
                }
                break;

            case '1:6': // Troll: enraged → +2 force; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $out['strength_bonus'] += 2;
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                $out['effect_text'] = $wasEnraged ? clienttranslate('enraged → +2 pwr; now calm') : clienttranslate('calm → now enraged');
                break;

            // --- Silver Brute ---

            case '2:1': // Barbarian: enraged → +1 power per Impact-trait card in grid; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $n = self::countTrait($playerId, 'impact', $game);
                    $out['strength_bonus'] += $n;
                    $out['effect_text'] = clienttranslate('enraged → +') . $n . clienttranslate(' pwr (') . $n . clienttranslate(' Impact); now calm');
                } else {
                    $out['effect_text'] = clienttranslate('calm → now enraged');
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                break;

            case '2:2': // Goon: on border → discharge 1 gem to gain +4 power
                if ($col !== 1) {
                    $discharged = self::dischargeGems($playerId, 1, $game);
                    if ($discharged > 0) {
                        $out['strength_bonus'] += 4;
                        $out['effect_text'] = clienttranslate('−1 gem → +4 pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('no charged gem');
                    }
                } else {
                    $out['effect_text'] = clienttranslate('center (no effect)');
                }
                break;

            case '2:3': // The Defender: calm → add rival's printed strength to power; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if (!$wasEnraged && $rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    $out['strength_bonus'] += $rivalForce;
                    $out['effect_text'] = clienttranslate('calm → +') . $rivalForce . clienttranslate(' pwr (rival force); now enraged');
                } else {
                    $out['effect_text'] = $wasEnraged ? clienttranslate('enraged → now calm') : clienttranslate('no rival');
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                break;

            case '2:4': // Werewolf: enraged → +3 power
                if (self::getRage($playerId, $game) === 1) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = clienttranslate('enraged → +3 pwr');
                } else {
                    $out['effect_text'] = clienttranslate('calm (no bonus)');
                }
                break;

            case '2:5': // Mercenary: enraged → +4 power; calm → toggle rage
                if (self::getRage($playerId, $game) === 1) {
                    $out['strength_bonus'] += 4;
                    $out['effect_text'] = clienttranslate('enraged → +4 pwr');
                } else {
                    $out['rage_toggle'] = self::toggleRage($playerId, $game);
                    $out['effect_text'] = clienttranslate('calm → now enraged');
                }
                break;

            case '2:6': // Bouncer: rival printed strength > 2 (strictly) → +6 power
                if ($rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if ($rivalForce > 2) {
                        $out['strength_bonus'] += 6;
                        $out['effect_text'] = clienttranslate('rival force ') . $rivalForce . clienttranslate(' → +6 pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('rival force ') . $rivalForce . clienttranslate(' (no bonus)');
                    }
                }
                break;

            // --- Silver Flambeur ---

            case '2:7': // Bookie: roll die → token on the right-border card of this row (−2 / +4)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $rightPos = intdiv($gridPosition, 3) * 3 + 2;
                $val = $d <= 2 ? -2 : 4;
                self::addToken($playerId, $rightPos, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token on right border');
                break;

            case '2:8': // Lucky Dog: roll die → add value to power
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $out['strength_bonus'] += $d;
                $out['effect_text'] = '🎲' . $d . ' → +' . $d . clienttranslate(' pwr');
                break;

            case '2:9': // Accomplice: +1 power per token on your grid
                $n = self::countAllTokens($playerId, $game);
                $out['strength_bonus'] += $n;
                $out['effect_text'] = $n > 0 ? '+' . $n . clienttranslate(' pwr (') . $n . clienttranslate(' token(s))') : clienttranslate('no tokens');
                break;

            case '2:10': // Dealer: roll die → token on THIS card (−3 / +3)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -3 : 3;
                self::addToken($playerId, $gridPosition, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '2:11': // Benefactor: charge 1 gem; +2 power per charged gem
                self::chargeGems($playerId, 1, $game);
                $charged = $game->gemsCharged->get($playerId);
                $out['strength_bonus'] += 2 * $charged;
                $out['effect_text'] = clienttranslate('+1 gem (') . $charged . clienttranslate(' charged) → +') . (2 * $charged) . clienttranslate(' pwr');
                break;

            case '2:12': // Cheater: gather all gambler tokens from this row+column onto this card, flip + face up
                $row = intdiv($gridPosition, 3);
                $positions = array_unique([$row * 3, $row * 3 + 1, $row * 3 + 2, $col, $col + 3, $col + 6]);
                $n = self::gatherAndFlipTokens($playerId, $positions, $gridPosition, $game);
                $out['effect_text'] = $n > 0 ? clienttranslate('gathered ') . $n . clienttranslate(' token(s) here (+ face)') : clienttranslate('no tokens to gather');
                break;

            // --- Silver Pirate ---

            case '2:13': // Bombardier: on border → flip card below face-down, gain +5/+3/+1 by its rank
                if ($col !== 1) {
                    $below = $gridPosition - 3;
                    // R: "flip the card below face-down" — a card already face-down has
                    // nothing left to flip, so no bonus (per rules text, confirmed by user).
                    $belowCard = $below >= 0 ? $game->getObjectFromDB(
                        "SELECT card_id, card_type AS type, card_family AS family FROM bc_card
                         WHERE card_location = 'grid_{$playerId}' AND card_location_arg = {$below}
                           AND card_face_up = 1"
                    ) : null;
                    if (!empty($belowCard)) {
                        $rank2 = self::getEffectiveRank($playerId, $below, (int)$belowCard['type'], $game);
                        $bonus = match ($rank2) { 3 => 5, 2 => 3, default => 1 };
                        $game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$belowCard['card_id']}");
                        $game->DbQuery("DELETE FROM bc_token WHERE player_id = {$playerId} AND grid_position = {$below}");
                        $out['strength_bonus'] += $bonus;
                        // The card flipped here is a DIFFERENT card than Bombardier itself (the
                        // one below it) — the client needs its own position/family to play the
                        // flip-down animation on it, distinct from card_flipped_face_down above
                        // which only ever refers to the resolving card's own flip.
                        $out['flipped_below'] = ['position' => $below, 'family' => (int)$belowCard['family']];
                        $out['effect_text'] = clienttranslate('flipped card below (rank ') . $rank2 . ') → +' . $bonus . clienttranslate(' pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('no card below');
                    }
                } else {
                    $out['effect_text'] = clienttranslate('center (no effect)');
                }
                break;

            case '2:14': // Navigator: gold token on both border cards of this row
                $row = intdiv($gridPosition, 3);
                self::addToken($playerId, $row * 3, 'pirate_gold', 0, $game);
                self::addToken($playerId, $row * 3 + 2, 'pirate_gold', 0, $game);
                $out['effect_text'] = clienttranslate('gold token on both borders this row');
                break;

            case '2:15': // Raider: any Gold card in grid → charge 2 gems
                if (count(self::getGoldCards($playerId, $game)) > 0) {
                    self::chargeGems($playerId, 2, $game);
                    $out['effect_text'] = clienttranslate('Gold in grid → +2 gems');
                } else {
                    $out['effect_text'] = clienttranslate('no Gold (no charge)');
                }
                break;

            case '2:16': // First Mate: +3 power per Gold card in this column
                $n = self::countEffectiveRankIn(self::getColumnCards($playerId, $col, $game), 3, $playerId, $game);
                $out['strength_bonus'] += 3 * $n;
                $out['effect_text'] = $n > 0 ? '+' . (3 * $n) . clienttranslate(' pwr (') . $n . clienttranslate(' Gold in col)') : clienttranslate('no Gold in col');
                break;

            case '2:17': // Lookout: rival is effectively Gold → +5 power
                if ($rivalCard !== null && $rivalPlayerId !== null && $rivalGridPos !== null) {
                    $effRank = self::getEffectiveRank($rivalPlayerId, $rivalGridPos, (int)$rivalCard['type'], $game);
                    if ($effRank === 3) {
                        $out['strength_bonus'] += 5;
                        $out['effect_text'] = clienttranslate('rival is Gold → +5 pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('rival not Gold (no bonus)');
                    }
                }
                break;

            case '2:18': // Buccaneer: no Bronze card in this column → +5 power
                $n = self::countEffectiveRankIn(self::getColumnCards($playerId, $col, $game), 1, $playerId, $game);
                if ($n === 0) {
                    $out['strength_bonus'] += 5;
                    $out['effect_text'] = clienttranslate('no Bronze in col → +5 pwr');
                } else {
                    $out['effect_text'] = clienttranslate('Bronze in col (no bonus)');
                }
                break;

            // --- Gold Brute ---

            case '3:1': // Brunhilde: add the printed strength of the OTHER face-up cards in this column
                foreach (self::getColumnCards($playerId, $col, $game) as $other) {
                    if ((int)$other['id'] === (int)$card['id']) continue;
                    $out['strength_bonus'] += self::getBaseForce((int)$other['type'], (int)$other['type_arg']);
                }
                $out['effect_text'] = $out['strength_bonus'] > 0 ? '+' . $out['strength_bonus'] . clienttranslate(' pwr (col cards)') : clienttranslate('no other cards in col');
                break;

            case '3:2': // Goliath: enraged → +8 power; always toggle rage
                $wasEnraged = self::getRage($playerId, $game) === 1;
                if ($wasEnraged) {
                    $out['strength_bonus'] += 8;
                }
                $out['rage_toggle'] = self::toggleRage($playerId, $game);
                $out['effect_text'] = $wasEnraged ? clienttranslate('enraged → +8 pwr; now calm') : clienttranslate('calm → now enraged');
                break;

            case '3:3': // Shock Fang: discharge all your gems, +4 power per gem discharged
                $n = self::dischargeGems($playerId, $game->gemsCharged->get($playerId), $game);
                $out['strength_bonus'] += 4 * $n;
                $out['effect_text'] = $n > 0 ? '−' . $n . clienttranslate(' gems → +') . (4 * $n) . clienttranslate(' pwr') : clienttranslate('no charged gems');
                break;

            // --- Gold Flambeur ---

            case '3:4': // Crazy 6: roll the die once per token on your grid; +6 power per 6 rolled
                $tokenCount = self::countAllTokens($playerId, $game);
                $sixes = 0;
                $rolls = [];
                for ($i = 0; $i < $tokenCount; $i++) {
                    $r = rand(1, 6);
                    $rolls[] = $r;
                    if ($r === 6) {
                        $sixes++;
                    }
                }
                // One roll per token — the client plays one dice animation per entry here
                // instead of the usual single roll (see notifyCombatEffect).
                $out['dice_rolls'] = $rolls;
                $out['strength_bonus'] += 6 * $sixes;
                $out['effect_text'] = $tokenCount > 0
                    ? $tokenCount . clienttranslate(' dice, ') . $sixes . clienttranslate(' six(es) → +') . (6 * $sixes) . clienttranslate(' pwr')
                    : clienttranslate('no tokens (no rolls)');
                break;

            case '3:5': // Mad Dice: roll die → token on THIS card (−4 / +8)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -4 : 8;
                self::addToken($playerId, $gridPosition, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '3:6': // Poker Face: gather all gambler tokens from your WHOLE grid onto this card, flip + face up
                $n = self::gatherAndFlipTokens($playerId, [0, 1, 2, 3, 4, 5, 6, 7, 8], $gridPosition, $game);
                $out['effect_text'] = $n > 0 ? clienttranslate('gathered ') . $n . clienttranslate(' token(s) here (+ face)') : clienttranslate('no tokens to gather');
                break;

            // --- Gold Pirate ---

            case '3:7': // Davy Jones: +4 power per OTHER effectively-Gold card in this row and this column
                $row = intdiv($gridPosition, 3);
                $seen = [(int)$card['id']];
                $n = 0;
                foreach (array_merge(self::getRowCards($playerId, $row, $game), self::getColumnCards($playerId, $col, $game)) as $other) {
                    $oid = (int)$other['id'];
                    if (in_array($oid, $seen, true)) continue;
                    $seen[] = $oid;
                    if (self::getEffectiveRank($playerId, (int)$other['position'], (int)$other['type'], $game) === 3) {
                        $n++;
                    }
                }
                $out['strength_bonus'] += 4 * $n;
                $out['effect_text'] = $n > 0 ? '+' . (4 * $n) . clienttranslate(' pwr (') . $n . clienttranslate(' other Gold in row+col)') : clienttranslate('no other Gold in row/col');
                break;

            case '3:8': // Flying Dutchman: flip OTHER face-up Gold cards in your grid face-down, +3 power each
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
                $out['strength_bonus'] += 3 * $flipped;
                $out['effect_text'] = $flipped > 0 ? clienttranslate('flipped ') . $flipped . clienttranslate(' Gold → +') . (3 * $flipped) . clienttranslate(' pwr') : clienttranslate('no Gold to flip');
                break;

            case '3:9': // Lady Fortune: +1 VP per Gold card in your grid (including this one)
                $goldCount = count(self::getGoldCards($playerId, $game));
                $out['vp_bonus'] += $goldCount;
                $out['effect_text'] = '+' . $goldCount . clienttranslate(' VP (') . $goldCount . clienttranslate(' Gold in grid)');
                break;
        }

        return $out;
    }

    // ===========================================================================
    // BOT / SOLO MODE
    // ===========================================================================

    // Force Solo (valeur violette, R-8.10) — now part of $DATA (single source of truth, R-8.1)
    public static function getBotBaseForce(int $rank, int $design): int
    {
        return self::$DATA[$rank][$design]['force_automa'] ?? 0;
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

            case '1:1': // High Roller: roll die → gambler token on this position
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -1 : 1;
                self::addToken(self::BOT_PLAYER_ID, $pos, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '1:3': // Cabin Boy: pirate_gold token on this position
                self::addToken(self::BOT_PLAYER_ID, $pos, 'pirate_gold', 0, $game);
                $out['effect_text'] = clienttranslate('pirate gold token here');
                break;

            case '1:6': // Troll: enraged → +2 force; always toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 2;
                }
                $newRage = $botRage === 0 ? 1 : 0;
                $game->bga->globals->set('bot_rage', $newRage);
                $out['rage_toggle'] = $newRage;
                $out['effect_text'] = $botRage === 1 ? clienttranslate('enraged → +2 pwr; now calm') : clienttranslate('calm → now enraged');
                break;

            case '2:3': // The Defender: calm → gain rival's printed force; always toggle rage
                $wasEnraged = $botRage === 1;
                if (!$wasEnraged && $rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    $out['strength_bonus'] += $rivalForce;
                    $out['effect_text'] = clienttranslate('calm → +') . $rivalForce . clienttranslate(' pwr (rival force); now enraged');
                } else {
                    $out['effect_text'] = $wasEnraged ? clienttranslate('enraged → now calm') : clienttranslate('no rival');
                }
                $newRage = $botRage === 0 ? 1 : 0;
                $game->bga->globals->set('bot_rage', $newRage);
                $out['rage_toggle'] = $newRage;
                break;

            case '2:4': // Werewolf: enraged → +3
                if ($botRage === 1) {
                    $out['strength_bonus'] += 3;
                    $out['effect_text'] = clienttranslate('enraged → +3 pwr');
                } else {
                    $out['effect_text'] = clienttranslate('calm (no bonus)');
                }
                break;

            case '2:5': // Mercenary: enraged → +4; calm → toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 4;
                    $out['effect_text'] = clienttranslate('enraged → +4 pwr');
                } else {
                    $game->bga->globals->set('bot_rage', 1);
                    $out['rage_toggle'] = 1;
                    $out['effect_text'] = clienttranslate('calm → now enraged');
                }
                break;

            case '2:6': // Bouncer: rival printed force > 2 (strictly) → +6
                if ($rivalCard !== null) {
                    $rivalForce = self::getBaseForce((int)$rivalCard['type'], (int)$rivalCard['type_arg']);
                    if ($rivalForce > 2) {
                        $out['strength_bonus'] += 6;
                        $out['effect_text'] = clienttranslate('rival force ') . $rivalForce . clienttranslate(' → +6 pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('rival force ') . $rivalForce . clienttranslate(' (no bonus)');
                    }
                }
                break;

            case '2:8': // Lucky Dog: roll die → add value to power
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $out['strength_bonus'] += $d;
                $out['effect_text'] = '🎲' . $d . ' → +' . $d . clienttranslate(' pwr');
                break;

            case '2:10': // Dealer: roll die → gambler token on this position (−3 / +3)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -3 : 3;
                self::addToken(self::BOT_PLAYER_ID, $pos, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '2:13': // Bombardier: flip the card below (bot has no center — every position is a border)
                if ($row > 0) {
                    $belowPos  = self::botGridPos($side, $row - 1);
                    // Same rule as the player version above: nothing to flip if already face-down.
                    $belowCard = $game->getObjectFromDB(
                        "SELECT card_id, card_type AS type, card_family AS family
                         FROM bc_card
                         WHERE card_location = 'bot_grid_{$side}' AND card_location_arg = " . ($row - 1) . "
                           AND card_face_up = 1"
                    );
                    if (!empty($belowCard)) {
                        $rank2 = self::getBotEffectiveRank($belowPos, (int)$belowCard['type'], $game);
                        $bonus = match ($rank2) { 3 => 5, 2 => 3, default => 1 };
                        $game->DbQuery("UPDATE bc_card SET card_face_up = 0 WHERE card_id = {$belowCard['card_id']}");
                        $game->DbQuery("DELETE FROM bc_token WHERE player_id = 0 AND grid_position = {$belowPos}");
                        $out['strength_bonus'] += $bonus;
                        $out['flipped_below'] = ['position' => $belowPos, 'family' => (int)$belowCard['family']];
                        $out['effect_text'] = clienttranslate('flipped card below (rank ') . $rank2 . ') → +' . $bonus . clienttranslate(' pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('no card below');
                    }
                } else {
                    $out['effect_text'] = clienttranslate('row 1 (no card below)');
                }
                break;

            case '2:14': // Navigator: gold token here (bot has no paired left/right border to mirror)
                self::addToken(self::BOT_PLAYER_ID, $pos, 'pirate_gold', 0, $game);
                $out['effect_text'] = clienttranslate('gold token here');
                break;

            case '2:16': // First Mate: +3 per Gold card in this bot column (own side, all 3 rows)
                $bonus = 0;
                for ($r = 0; $r <= 2; $r++) {
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
                $out['effect_text'] = $bonus > 0 ? '+' . $bonus . clienttranslate(' pwr (') . intdiv($bonus, 3) . clienttranslate(' Gold in col)') : clienttranslate('no Gold in col');
                break;

            case '2:17': // Lookout: rival is effectively Gold → +5
                if ($rivalCard !== null && $rivalPlayerId !== null && $rivalGridPos !== null) {
                    if (self::getEffectiveRank($rivalPlayerId, $rivalGridPos, (int)$rivalCard['type'], $game) === 3) {
                        $out['strength_bonus'] += 5;
                        $out['effect_text'] = clienttranslate('rival is Gold → +5 pwr');
                    } else {
                        $out['effect_text'] = clienttranslate('rival not Gold (no bonus)');
                    }
                }
                break;

            case '2:18': // Buccaneer: no Bronze card in this bot column (own side, all 3 rows) → +5
                if (self::countBotBronzeCards($game) === 0) {
                    $out['strength_bonus'] += 5;
                    $out['effect_text'] = clienttranslate('no Bronze → +5 pwr');
                } else {
                    $out['effect_text'] = clienttranslate('Bronze in play (no bonus)');
                }
                break;

            case '3:2': // Goliath: enraged → +8; always toggle rage
                if ($botRage === 1) {
                    $out['strength_bonus'] += 8;
                }
                $newRage = $botRage === 0 ? 1 : 0;
                $game->bga->globals->set('bot_rage', $newRage);
                $out['rage_toggle'] = $newRage;
                $out['effect_text'] = $botRage === 1 ? clienttranslate('enraged → +8 pwr; now calm') : clienttranslate('calm → now enraged');
                break;

            case '3:4': // Crazy 6: roll the die once per token on the bot's whole grid; +6 per 6 rolled
                $tokenRow = $game->getObjectFromDB(
                    "SELECT COUNT(*) AS cnt FROM bc_token WHERE player_id = 0"
                );
                $tokenCount = (int)($tokenRow['cnt'] ?? 0);
                $sixes = 0;
                for ($i = 0; $i < $tokenCount; $i++) {
                    if (rand(1, 6) === 6) $sixes++;
                }
                $out['strength_bonus'] += 6 * $sixes;
                $out['effect_text'] = $tokenCount > 0
                    ? $tokenCount . clienttranslate(' dice, ') . $sixes . clienttranslate(' six(es) → +') . (6 * $sixes) . clienttranslate(' pwr')
                    : clienttranslate('no tokens (no rolls)');
                break;

            case '3:5': // Mad Dice: roll die → gambler token on this position (−4 / +8)
                $d = rand(1, 6);
                $out['dice_roll'] = $d;
                $val = $d <= 2 ? -4 : 8;
                self::addToken(self::BOT_PLAYER_ID, $pos, 'gambler', $val, $game);
                $out['effect_text'] = '🎲' . $d . ' → ' . ($val > 0 ? '+' . $val : $val) . clienttranslate(' token here');
                break;

            case '3:9': // Lady Fortune: +1 VP per Gold card in the bot's whole grid
                $goldCount = self::countBotGoldCards($game);
                $out['vp_bonus'] += $goldCount;
                $out['effect_text'] = '+' . $goldCount . clienttranslate(' VP (') . $goldCount . clienttranslate(' Gold in grid)');
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
