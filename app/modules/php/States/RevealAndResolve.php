<?php

declare(strict_types=1);

namespace Bga\Games\borderclash\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\borderclash\CardEffects;
use Bga\Games\borderclash\Game;

class RevealAndResolve extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct($game, id: 20, type: StateType::GAME);
    }

    public function onEnteringState()
    {
        $turn        = (int)($this->game->bga->globals->get('turn_number') ?? 1);
        $row         = $turn - 1; // row index 0–2
        $rowPos      = [$row * 3, $row * 3 + 1, $row * 3 + 2];
        [$leftPos, $centerPos, $rightPos] = $rowPos;
        $playerOrder = (array)($this->game->bga->globals->get('player_order') ?? []);
        $isSolo      = (bool)($this->game->bga->globals->get('is_solo') ?? false);

        // Idempotency guard: if cards are already face-up, skip to CheckTurn.
        // Protects against server-restart re-entry of automatic states.
        if (!empty($playerOrder)) {
            $pid0  = (int)$playerOrder[0];
            $check = $this->game->getObjectFromDB(
                "SELECT card_face_up FROM bc_card
                 WHERE card_location = 'grid_{$pid0}' AND card_location_arg = {$rowPos[0]}
                 LIMIT 1"
            );
            if (!empty($check) && (int)$check['card_face_up'] === 1) {
                return CheckTurn::class;
            }
        }

        // Step 1: Flip current row face-up, notify all
        $posStr = implode(',', $rowPos);
        foreach ($playerOrder as $rawPid) {
            $pid = (int)$rawPid;
            $this->game->DbQuery(
                "UPDATE bc_card SET card_face_up = 1
                 WHERE card_location = 'grid_{$pid}'
                   AND card_location_arg IN ({$posStr})"
            );
            $this->game->bga->notify->all('cardsRevealed',
                clienttranslate('${player_name}\'s cards are revealed'), [
                    'player_id'   => $pid,
                    'player_name' => $this->game->getPlayerNameById($pid),
                    'cards'       => $this->getRowCards($pid, $rowPos),
                ]
            );
        }

        if ($isSolo) {
            $this->revealBotRow($row);
            $this->resolveSoloRow($playerOrder, $leftPos, $centerPos, $rightPos);
        } else {
            $this->resolveMultiplayerRow($playerOrder, $leftPos, $centerPos, $rightPos);
        }

        return CheckTurn::class;
    }

    // -------------------------------------------------------------------------
    // R-5.7: strict order — every player's LEFT card, THEN every player's CENTER
    // card, THEN every player's RIGHT card. A border is fed by two cards resolved
    // in two different passes (my right card vs my right neighbor's left card),
    // so a border can only be scored once the right-pass is complete.
    // Iteration order within each pass follows player_order (R-5.10 tie-break).
    // -------------------------------------------------------------------------

    private function resolveMultiplayerRow(array $playerOrder, int $leftPos, int $centerPos, int $rightPos): void
    {
        $n = count($playerOrder);

        // Step 1: every player's LEFT card (rival = left neighbor's RIGHT card).
        // Each border's matchup is announced here, right before its first (left-side) contributor resolves.
        [$leftStrengths, $leftResults] = $this->resolveBorderPass($playerOrder, $leftPos, -1, $rightPos, announce: true);

        // Step 2: every player's CENTER card (influence)
        $this->resolveCenterForAll($playerOrder, $centerPos);

        // Step 3: every player's RIGHT card (rival = right neighbor's LEFT card)
        [$rightStrengths, $rightResults] = $this->resolveBorderPass($playerOrder, $rightPos, +1, $leftPos, announce: false);

        // Step 4: score every border now that both of its cards are resolved
        for ($i = 0; $i < $n; $i++) {
            $leftContributorPid  = (int)$playerOrder[$i];
            $rightContributorPid = (int)$playerOrder[($i + 1) % $n];
            $this->scoreBorder(
                $leftContributorPid,  $rightPos, $rightStrengths[$leftContributorPid]  ?? 0, $rightResults[$leftContributorPid]  ?? $this->emptyEffectResult(),
                $rightContributorPid, $leftPos,  $leftStrengths[$rightContributorPid]  ?? 0, $leftResults[$rightContributorPid]  ?? $this->emptyEffectResult()
            );
        }
    }

    // Resolve one border-side position (left or right column) for every player, in player_order sequence.
    // $neighborOffset: -1 for the left column (rival = left neighbor's card at $rivalPos), +1 for the right column.
    // $announce: announce the border matchup right before resolving (only done once, on the first pass touching it).
    private function resolveBorderPass(array $playerOrder, int $pos, int $neighborOffset, int $rivalPos, bool $announce): array
    {
        $strengths = [];
        $results   = [];
        foreach ($playerOrder as $rawPid) {
            $pid       = (int)$rawPid;
            $rivalPid  = $this->neighborPid($playerOrder, $pid, $neighborOffset);
            $rivalCard = $this->getCardAt($rivalPid, $rivalPos);
            $card      = $this->getCardAt($pid, $pos);

            if ($announce && $card && $rivalCard) {
                $this->notifyCombatStart(
                    $pid,      $this->game->getPlayerNameById($pid),
                    CardEffects::getName((int)$card['type'], (int)$card['type_arg']),
                    $rivalPid, $this->game->getPlayerNameById($rivalPid),
                    CardEffects::getName((int)$rivalCard['type'], (int)$rivalCard['type_arg'])
                );
            }

            [$str, $res] = $this->resolvePosition($pid, $pos, 'combat', $rivalCard, $rivalPid, $rivalPos);
            $strengths[$pid] = $str;
            $results[$pid]   = $res;
        }
        return [$strengths, $results];
    }

    private function neighborPid(array $playerOrder, int $pid, int $offset): int
    {
        $order = array_map('intval', $playerOrder);
        $idx   = array_search($pid, $order, true);
        $n     = count($order);
        if ($idx === false || $n === 0) {
            return $pid;
        }
        return $order[($idx + $offset + $n) % $n];
    }

    // Resolve a single card's combat/influence effect: apply effect, compute capped strength, notify.
    // Face-down card (R-8.5): no effect applied, power 0.
    private function resolvePosition(int $pid, int $pos, string $phase, ?array $rivalCard, ?int $rivalPid, ?int $rivalPos): array
    {
        $card = $this->getCardAt($pid, $pos);
        if (!$card || !(int)$card['face_up']) {
            return [0, $this->emptyEffectResult()];
        }

        $gemsBefore = $this->game->gemsCharged->get($pid);
        $res = CardEffects::applyEffect($card, $pid, $pos, $phase, $rivalCard, $rivalPid, $rivalPos, $this->game);
        if ($this->game->gemsCharged->get($pid) !== $gemsBefore) {
            $this->broadcastGemUpdated($pid);
        }

        // Re-read: the effect may have flipped this card face-down (R-8.5 — power then frozen at 0 for this pass)
        $card = $this->getCardAt($pid, $pos) ?? $card;
        $str  = $this->calcStrength($pid, $pos, $card, $res);

        if ($res['vp_bonus'] > 0) {
            $this->game->bga->playerScore->inc($pid, $res['vp_bonus']);
            $this->addFactionPoints((int)$card['family'], $res['vp_bonus']);
        }

        $this->notifyCombatEffect($card, $pid, $pos, $res, $str);

        return [$str, $res];
    }

    // Resolve every player's center card (influence phase) — no combat, no rival.
    private function resolveCenterForAll(array $playerOrder, int $centerPos): void
    {
        foreach ($playerOrder as $rawPid) {
            $pid        = (int)$rawPid;
            $centerCard = $this->getCardAt($pid, $centerPos);
            if (!$centerCard || !(int)$centerCard['face_up']) continue;

            $gemsBefore = $this->game->gemsCharged->get($pid);
            $res = CardEffects::applyEffect(
                $centerCard, $pid, $centerPos, 'influence',
                null, null, null,
                $this->game
            );

            $cardName = CardEffects::getName((int)$centerCard['type'], (int)$centerCard['type_arg']);
            $this->game->bga->notify->all('influenceResolved',
                clienttranslate('${player_name}\'s ${card_name} applies its influence effect'),
                [
                    'player_id'      => $pid,
                    'player_name'    => $this->game->getPlayerNameById($pid),
                    'card_id'        => (int)$centerCard['id'],
                    'card_name'      => $cardName,
                    'effect_type'    => "{$centerCard['type']}:{$centerCard['type_arg']}",
                    'dice_roll'      => $res['dice_roll'],
                    'strength_bonus' => $res['strength_bonus'],
                    'vp_bonus'       => $res['vp_bonus'],
                    'effect_desc'    => $res['effect_text'] ?? '—',
                    'rage_toggle'    => $res['rage_toggle'],
                ]
            );
            $this->recordEffectBadge([
                'badge_kind'  => 'influence',
                'player_id'   => $pid,
                'position'    => $centerPos,
                'effect_type' => "{$centerCard['type']}:{$centerCard['type_arg']}",
                'effect_desc' => $res['effect_text'] ?? '—',
                'dice_roll'   => $res['dice_roll'],
            ]);

            if ($this->game->gemsCharged->get($pid) !== $gemsBefore) {
                $this->broadcastGemUpdated($pid);
            }
            $this->broadcastTokensSync($pid);

            if ($res['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($pid, $res['vp_bonus']);
                $this->addFactionPoints((int)$centerCard['family'], $res['vp_bonus']);
            }
        }
    }

    // Score one border once both of its contributing cards are resolved (R-5.11).
    // "left"/"right" here just label the two sides of this border for the notification payload —
    // they are NOT necessarily each contributor's own left/right grid column.
    private function scoreBorder(
        int $leftPid,  int $leftPos,  int $lStr, array $lRes,
        int $rightPid, int $rightPos, int $rStr, array $rRes
    ): void {
        $diff     = abs($lStr - $rStr);
        $winnerId = null;
        $bonusVp  = 0;

        if ($lStr > $rStr) {
            $winnerId = $leftPid;
            $this->game->bga->playerScore->inc($leftPid, $diff);
            $this->game->bga->playerStats->inc('combat_wins',   1,     $leftPid);
            $this->game->bga->playerStats->inc('combat_losses', 1,     $rightPid);
            $this->game->bga->playerStats->inc('combat_points', $diff, $leftPid);
        } elseif ($rStr > $lStr) {
            $winnerId = $rightPid;
            $this->game->bga->playerScore->inc($rightPid, $diff);
            $this->game->bga->playerStats->inc('combat_wins',   1,     $rightPid);
            $this->game->bga->playerStats->inc('combat_losses', 1,     $leftPid);
            $this->game->bga->playerStats->inc('combat_points', $diff, $rightPid);
        } else {
            $this->game->bga->playerStats->inc('combat_ties', 1, $leftPid);
            $this->game->bga->playerStats->inc('combat_ties', 1, $rightPid);
        }

        // After-combat effect (Snake): winner rolls die — R-9.4: server-side BGA random
        if ($winnerId !== null && ($lRes['after_combat'] || $rRes['after_combat'])) {
            $bonusVp = bga_rand(1, 6);
            $this->game->bga->playerScore->inc($winnerId, $bonusVp);
            $this->game->bga->playerStats->inc('combat_points', $bonusVp, $winnerId);
        }

        if ($winnerId !== null) {
            $combatMsg  = clienttranslate('${player_name} wins ${combat_points} point(s) (${left_strength} vs ${right_strength})');
            $combatPid  = $winnerId;
            $combatName = $this->game->getPlayerNameById($winnerId);
        } else {
            $combatMsg  = clienttranslate('Tie (${left_strength} vs ${right_strength})');
            $combatPid  = 0;
            $combatName = '';
        }
        $payload = [
            'player_id'       => $combatPid,
            'player_name'     => $combatName,
            'left_player_id'  => $leftPid,
            'right_player_id' => $rightPid,
            'left_position'   => $leftPos,
            'right_position'  => $rightPos,
            'left_strength'   => $lStr,
            'right_strength'  => $rStr,
            'winner_id'       => $winnerId,
            'combat_points'   => $diff,
            'bonus_vp'        => $bonusVp,
            'left_vp'         => $lRes['vp_bonus'],
            'right_vp'        => $rRes['vp_bonus'],
            'left_dice'       => $lRes['dice_roll'],
            'right_dice'      => $rRes['dice_roll'],
        ];
        $this->game->bga->notify->all('combatResolved', $combatMsg, $payload);
        $this->recordGaugeDiffHistory($payload);
    }

    private function emptyEffectResult(): array
    {
        return [
            'strength_bonus'         => 0,
            'vp_bonus'               => 0,
            'after_combat'           => false,
            'dice_roll'              => null,
            'rage_toggle'            => null,
            'effect_text'            => null,
            'card_flipped_face_down' => false,
            'flipped_below'          => null,
        ];
    }

    // Base + token bonuses + effect bonus; face-down card = 0. Bounded [0;20] (R-5.8).
    private function calcStrength(int $playerId, int $gridPos, ?array $card, array $res): int
    {
        if (!$card || !(int)($card['face_up'] ?? 1)) {
            return 0;
        }
        $base   = CardEffects::getBaseForce((int)$card['type'], (int)$card['type_arg']);
        $tokens = CardEffects::getTokenStrengthBonus($playerId, $gridPos, $this->game);
        return max(0, min(20, $base + $tokens + (int)$res['strength_bonus']));
    }

    private function broadcastGemUpdated(int $pid): void
    {
        $this->game->bga->notify->all('gemUpdated', '', [
            'player_id' => $pid,
            'charged'   => $this->game->gemsCharged->get($pid),
            'uncharged' => $this->game->gemsUncharged->get($pid),
        ]);
    }

    private function broadcastTokensSync(int $pid): void
    {
        // id selected first: getCollectionFromDb() keys its result by the first column by
        // default, and grid_position alone isn't unique when a position holds 2+ tokens (the
        // whole point of the 50%-overlap display) — same collision bug as Game::getAllDatas'
        // tokens query, just for a live sync instead of a reload.
        $tokens = $this->game->getCollectionFromDb(
            "SELECT id, grid_position, token_type, value FROM bc_token WHERE player_id = {$pid}"
        );
        $this->game->bga->notify->all('tokensSyncPlayer', '', [
            'player_id' => $pid,
            'tokens'    => array_values($tokens),
        ]);
    }

    private function getCardAt(int $playerId, int $gridPos): ?array
    {
        $row = $this->game->getObjectFromDB(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family, card_face_up AS face_up
             FROM bc_card
             WHERE card_location = 'grid_{$playerId}' AND card_location_arg = {$gridPos}
             LIMIT 1"
        );
        return !empty($row) ? $row : null;
    }

    private function getRowCards(int $playerId, array $positions): array
    {
        $posStr = implode(',', $positions);
        return array_values($this->game->getCollectionFromDb(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family, card_location_arg AS position, card_face_up AS face_up
             FROM bc_card
             WHERE card_location = 'grid_{$playerId}'
               AND card_location_arg IN ({$posStr})"
        ));
    }

    // -------------------------------------------------------------------------
    // Solo mode: single player, only 2 borders (Automa flanks left and right).
    // R-10.5 order: Automa-left, player-left, player-center, player-right, Automa-right.
    // R-5.11: points are attributed only once the WHOLE row is resolved — both
    // borders' effects are computed as they occur, but scoring (and combatResolved)
    // is deferred until after the right border, mirroring the multiplayer step-4 pass.
    // -------------------------------------------------------------------------

    private function resolveSoloRow(array $playerOrder, int $leftPos, int $centerPos, int $rightPos): void
    {
        $pid = (int)$playerOrder[0];
        $row = intdiv($leftPos, 3);

        // Border 1 (left flank): Automa activates first — effects only, no scoring yet
        $border1 = null;
        $botLeft   = $this->getBotCard('right', $row); // bot_grid_right is displayed as the left flank
        $pLeftCard = $this->getCardAt($pid, $leftPos);
        if ($botLeft !== null && $pLeftCard !== null && (int)$pLeftCard['face_up']) {
            $border1 = $this->resolveSoloCombatEffects('right', $row, $botLeft, $pid, $leftPos, $pLeftCard, botFirst: true);
        }

        // Center
        $this->resolveCenterForAll($playerOrder, $centerPos);

        // Border 2 (right flank): player activates first — effects only, no scoring yet
        $border2 = null;
        $botRight   = $this->getBotCard('left', $row); // bot_grid_left is displayed as the right flank
        $pRightCard = $this->getCardAt($pid, $rightPos);
        if ($botRight !== null && $pRightCard !== null && (int)$pRightCard['face_up']) {
            $border2 = $this->resolveSoloCombatEffects('left', $row, $botRight, $pid, $rightPos, $pRightCard, botFirst: false);
        }

        // Row fully resolved — now score both borders (R-5.11)
        if ($border1 !== null) {
            [$botStr, $bRes, $pStr, $pRes] = $border1;
            $this->scoreSoloBorder($botStr, $bRes, $pid, $pStr, $pRes, CardEffects::botGridPos('right', $row), $leftPos, 'right', $row);
        }
        if ($border2 !== null) {
            [$botStr, $bRes, $pStr, $pRes] = $border2;
            $this->scoreSoloBorder($botStr, $bRes, $pid, $pStr, $pRes, CardEffects::botGridPos('left', $row), $rightPos, 'left', $row);
        }
    }

    // Apply both cards' effects for one solo border (in activation order) and notify them.
    // Direct vp_bonus from card effects is applied immediately (same as multiplayer's resolvePosition) —
    // only the win/loss combat differential is deferred to scoreSoloBorder().
    private function resolveSoloCombatEffects(
        string $side, int $row,
        array $botCard, int $pid, int $playerPos, array $playerCard,
        bool $botFirst
    ): array {
        $botGridPos = CardEffects::botGridPos($side, $row);

        if ($botFirst) {
            $bRes = CardEffects::applyBotEffect($botCard, $side, $row, $playerCard, $pid, $playerPos, $this->game);
            if ($bRes['rage_toggle'] !== null) {
                $this->game->bga->notify->all('botRageUpdated', '', ['rage' => $bRes['rage_toggle']]);
            }

            $gemsBeforeSolo = $this->game->gemsCharged->get($pid);
            $pRes = CardEffects::applyEffect($playerCard, $pid, $playerPos, 'combat', $botCard, CardEffects::BOT_PLAYER_ID, $botGridPos, $this->game);
            if ($this->game->gemsCharged->get($pid) !== $gemsBeforeSolo) {
                $this->broadcastGemUpdated($pid);
            }
        } else {
            $gemsBeforeSolo = $this->game->gemsCharged->get($pid);
            $pRes = CardEffects::applyEffect($playerCard, $pid, $playerPos, 'combat', $botCard, CardEffects::BOT_PLAYER_ID, $botGridPos, $this->game);
            if ($this->game->gemsCharged->get($pid) !== $gemsBeforeSolo) {
                $this->broadcastGemUpdated($pid);
            }

            $bRes = CardEffects::applyBotEffect($botCard, $side, $row, $playerCard, $pid, $playerPos, $this->game);
            if ($bRes['rage_toggle'] !== null) {
                $this->game->bga->notify->all('botRageUpdated', '', ['rage' => $bRes['rage_toggle']]);
            }
        }

        // Re-read player card (Cabin Boy may have flipped face-down during effect)
        $playerCard = $this->getCardAt($pid, $playerPos) ?? $playerCard;

        $botStr = $this->calcBotStrength($side, $row, $botCard, $bRes);
        $pStr   = $this->calcStrength($pid, $playerPos, $playerCard, $pRes);

        $this->notifyCombatStart(
            CardEffects::BOT_PLAYER_ID, clienttranslate('Bot'),
            CardEffects::getName((int)$botCard['type'],    (int)$botCard['type_arg']),
            $pid, $this->game->getPlayerNameById($pid),
            CardEffects::getName((int)$playerCard['type'], (int)$playerCard['type_arg'])
        );
        if ($botFirst) {
            $this->notifySoloCombatEffect($botCard,   $side, $row,       $bRes, $botStr);
            $this->notifyCombatEffect($playerCard, $pid,  $playerPos, $pRes, $pStr);
        } else {
            $this->notifyCombatEffect($playerCard, $pid,  $playerPos, $pRes, $pStr);
            $this->notifySoloCombatEffect($botCard,   $side, $row,       $bRes, $botStr);
        }

        if ($pRes['vp_bonus'] > 0) {
            $this->game->bga->playerScore->inc($pid, $pRes['vp_bonus']);
        }
        if ($bRes['vp_bonus'] > 0) {
            $botScore = (int)($this->game->bga->globals->get('bot_score') ?? 0) + $bRes['vp_bonus'];
            $this->game->bga->globals->set('bot_score', $botScore);
            $this->game->bga->notify->all('botScoreUpdated', '', ['score' => $botScore]);
        }

        return [$botStr, $bRes, $pStr, $pRes];
    }

    // Score one solo border (R-5.11) — called only once the whole row is resolved.
    private function scoreSoloBorder(
        int $botStr, array $bRes, int $pid, int $pStr, array $pRes,
        int $botGridPos, int $playerPos, string $side, int $row
    ): void {
        $diff     = abs($botStr - $pStr);
        $winnerId = null;
        $bonusVp  = 0;

        if ($botStr > $pStr) {
            $winnerId = CardEffects::BOT_PLAYER_ID;
            $botScore = (int)($this->game->bga->globals->get('bot_score') ?? 0) + $diff;
            $this->game->bga->globals->set('bot_score', $botScore);
            $this->game->bga->notify->all('botScoreUpdated', '', ['score' => $botScore]);
            $this->game->bga->playerStats->inc('combat_losses', 1, $pid);
        } elseif ($pStr > $botStr) {
            $winnerId = $pid;
            $this->game->bga->playerScore->inc($pid, $diff);
            $this->game->bga->playerStats->inc('combat_wins',   1,     $pid);
            $this->game->bga->playerStats->inc('combat_points', $diff, $pid);
        } else {
            $this->game->bga->playerStats->inc('combat_ties', 1, $pid);
        }

        // After-combat bonus (Snake) — R-9.4: server-side BGA random
        if ($winnerId !== null && ($bRes['after_combat'] || $pRes['after_combat'])) {
            $bonusVp = bga_rand(1, 6);
            if ($winnerId === CardEffects::BOT_PLAYER_ID) {
                $botScore = (int)($this->game->bga->globals->get('bot_score') ?? 0) + $bonusVp;
                $this->game->bga->globals->set('bot_score', $botScore);
                $this->game->bga->notify->all('botScoreUpdated', '', ['score' => $botScore]);
            } else {
                $this->game->bga->playerScore->inc($pid, $bonusVp);
            }
        }

        if ($winnerId === $pid) {
            $combatMsg  = clienttranslate('${player_name} wins ${combat_points} point(s) (${left_strength} vs ${right_strength})');
            $combatPid  = $pid;
            $combatName = $this->game->getPlayerNameById($pid);
        } elseif ($winnerId === CardEffects::BOT_PLAYER_ID) {
            $combatMsg  = clienttranslate('Bot wins ${combat_points} point(s) (${left_strength} vs ${right_strength})');
            $combatPid  = 0;
            $combatName = clienttranslate('Bot');
        } else {
            $combatMsg  = clienttranslate('Tie (${left_strength} vs ${right_strength})');
            $combatPid  = 0;
            $combatName = '';
        }
        $payload = [
            'player_id'       => $combatPid,
            'player_name'     => $combatName,
            'left_player_id'  => CardEffects::BOT_PLAYER_ID,
            'right_player_id' => $pid,
            'left_position'   => $botGridPos,
            'right_position'  => $playerPos,
            'left_strength'   => $botStr,
            'right_strength'  => $pStr,
            'winner_id'       => $winnerId,
            'combat_points'   => $diff,
            'bonus_vp'        => $bonusVp,
            'left_vp'         => $bRes['vp_bonus'],
            'right_vp'        => $pRes['vp_bonus'],
            'left_dice'       => $bRes['dice_roll'],
            'right_dice'      => $pRes['dice_roll'],
            'solo_combat'     => true,
            'bot_side'        => $side,
            'bot_row'         => $row,
        ];
        $this->game->bga->notify->all('combatResolved', $combatMsg, $payload);
        $this->recordGaugeDiffHistory($payload);
    }

    private function getBotCard(string $side, int $row): ?array
    {
        $loc  = "bot_grid_{$side}";
        $data = $this->game->getObjectFromDB(
            "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                    card_family AS family, card_face_up AS face_up
             FROM bc_card WHERE card_location = '{$loc}' AND card_location_arg = {$row}"
        );
        return !empty($data) ? $data : null;
    }

    private function revealBotRow(int $row): void
    {
        foreach (['left', 'right'] as $side) {
            $loc = "bot_grid_{$side}";
            $this->game->DbQuery(
                "UPDATE bc_card SET card_face_up = 1
                 WHERE card_location = '{$loc}' AND card_location_arg = {$row}"
            );
            $data = $this->game->getObjectFromDB(
                "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg,
                        card_family AS family
                 FROM bc_card
                 WHERE card_location = '{$loc}' AND card_location_arg = {$row}"
            );
            if (!empty($data)) {
                $this->game->bga->notify->all('botCardRevealed', '', [
                    'side' => $side,
                    'row'  => $row,
                    'card' => [
                        'id'       => (int)$data['id'],
                        'type'     => (int)$data['type'],
                        'type_arg' => (int)$data['type_arg'],
                        'family'   => (int)$data['family'],
                    ],
                ]);
            }
        }
    }

    // Notify a single player card's combat effect (multiplayer and player side of solo).
    private function notifyCombatEffect(array $card, int $pid, int $pos, array $res, int $finalStrength): void
    {
        $cardName = CardEffects::getName((int)$card['type'], (int)$card['type_arg']);
        $desc     = $this->effectDesc($res);
        $msg      = $desc === '—'
            ? clienttranslate('${player_name}\'s ${card_name}: ⚔ ${final_strength}')
            : clienttranslate('${player_name}\'s ${card_name}: ${effect_desc} → ⚔ ${final_strength}');

        // Dice animation(s) fire first so client shows the roll(s) before seeing tokens or
        // strength. Crazy 6 rolls once per token instead of a single die — dice_rolls (plural)
        // carries every value, and notifications are delivered to the client in order, so
        // firing one per roll here plays them one after another instead of a single animation.
        if (!empty($res['dice_rolls'])) {
            foreach ($res['dice_rolls'] as $roll) {
                $this->game->bga->notify->all('combatDiceRolled', '', [
                    'player_id' => $pid,
                    'dice_roll' => (int)$roll,
                    'position'  => $pos,
                ]);
            }
        } elseif (!empty($res['dice_roll'])) {
            $this->game->bga->notify->all('combatDiceRolled', '', [
                'player_id' => $pid,
                'dice_roll' => (int)$res['dice_roll'],
                'position'  => $pos,
            ]);
        }

        // Token sync: tokens from this effect appear after dice animation, before the badge.
        $this->broadcastTokensSync($pid);

        $this->game->bga->notify->all('combatEffectApplied', $msg, [
            'player_id'      => $pid,
            'player_name'    => $this->game->getPlayerNameById($pid),
            'card_id'        => (int)$card['id'],
            'card_name'      => $this->coloredName($cardName, $this->getPlayerColor($pid)),
            'position'       => $pos,
            'effect_type'    => "{$card['type']}:{$card['type_arg']}",
            'effect_desc'    => $desc,
            'final_strength' => $finalStrength,
            'dice_roll'      => $res['dice_roll'],
            'strength_bonus' => $res['strength_bonus'],
            'vp_bonus'       => $res['vp_bonus'],
            'after_combat'   => $res['after_combat'],
            'rage_toggle'    => $res['rage_toggle'] ?? null,
        ]);

        // Freebooter (1:4) flips itself face-down when on a border — animate the flip on the client
        if ($res['card_flipped_face_down'] ?? false) {
            $this->game->bga->notify->all('cardFlippedFaceDown', '', [
                'player_id' => $pid,
                'card_id'   => (int)$card['id'],
                'position'  => $pos,
                'family'    => (int)$card['family'],
            ]);
        }

        // Bombardier (2:13) flips a DIFFERENT card (the one below it) — same client handler,
        // but for that other position, since it was never told about this flip otherwise (only
        // silently updated server-side in the DB) and stayed visually face-up until a fresh F5.
        if (!empty($res['flipped_below'])) {
            $this->game->bga->notify->all('cardFlippedFaceDown', '', [
                'player_id' => $pid,
                'card_id'   => null,
                'position'  => (int)$res['flipped_below']['position'],
                'family'    => (int)$res['flipped_below']['family'],
            ]);
        }

        $this->trackPowerMax($pid, $finalStrength);

        $this->recordEffectBadge([
            'badge_kind'     => 'combat',
            'player_id'      => $pid,
            'position'       => $pos,
            'effect_desc'    => $desc,
            'final_strength' => $finalStrength,
            'solo_combat'    => false,
            'bot_side'       => null,
            'bot_row'        => null,
        ]);
    }

    // Notify a bot card's combat effect (solo mode only).
    private function notifySoloCombatEffect(array $botCard, string $side, int $row, array $res, int $finalStrength): void
    {
        $cardName   = CardEffects::getName((int)$botCard['type'], (int)$botCard['type_arg']);
        $botGridPos = CardEffects::botGridPos($side, $row);
        $desc       = $this->effectDesc($res);
        $msg        = $desc === '—'
            ? clienttranslate('Bot\'s ${card_name}: ⚔ ${final_strength}')
            : clienttranslate('Bot\'s ${card_name}: ${effect_desc} → ⚔ ${final_strength}');
        $this->game->bga->notify->all('combatEffectApplied', $msg, [
            'player_id'      => CardEffects::BOT_PLAYER_ID,
            'player_name'    => clienttranslate('Bot'),
            'card_id'        => (int)$botCard['id'],
            'card_name'      => $this->coloredName($cardName, $this->getPlayerColor(CardEffects::BOT_PLAYER_ID)),
            'position'       => $botGridPos,
            'effect_type'    => "{$botCard['type']}:{$botCard['type_arg']}",
            'effect_desc'    => $desc,
            'final_strength' => $finalStrength,
            'dice_roll'      => $res['dice_roll'],
            'strength_bonus' => $res['strength_bonus'],
            'vp_bonus'       => $res['vp_bonus'],
            'after_combat'   => $res['after_combat'],
            'solo_combat'    => true,
            'bot_side'       => $side,
            'bot_row'        => $row,
        ]);

        $this->recordEffectBadge([
            'badge_kind'     => 'combat',
            'player_id'      => CardEffects::BOT_PLAYER_ID,
            'position'       => $botGridPos,
            'effect_desc'    => $desc,
            'final_strength' => $finalStrength,
            'solo_combat'    => true,
            'bot_side'       => $side,
            'bot_row'        => $row,
        ]);
    }

    // Append one badge record to the round's persisted list (survives a page reload —
    // see Game::getAllDatas 'effect_badges' — cleared at Upgrade entry alongside tokens).
    private function recordEffectBadge(array $data): void
    {
        $badges   = (array)($this->game->bga->globals->get('effect_badges') ?? []);
        $badges[] = $data;
        $this->game->bga->globals->set('effect_badges', $badges);
    }

    // Append one resolved combat's payload to the round's gauge-diff history (survives a
    // page reload — see Game::getAllDatas 'gauge_diff_history' — cleared at Upgrade entry
    // alongside tokens/effect_badges). Stores the exact combatResolved notify payload so the
    // client can replay it through the same _recordGaugeDiffLine() the live handler uses.
    private function recordGaugeDiffHistory(array $payload): void
    {
        $history   = (array)($this->game->bga->globals->get('gauge_diff_history') ?? []);
        $history[] = $payload;
        $this->game->bga->globals->set('gauge_diff_history', $history);
    }

    // "power_max" (highest power reached) — only meaningful for a real seated player, so
    // only called from notifyCombatEffect (never notifySoloCombatEffect, the bot's side).
    private function trackPowerMax(int $pid, int $finalStrength): void
    {
        $current = (int)($this->game->bga->playerStats->get('power_max', $pid) ?? 0);
        if ($finalStrength > $current) {
            $this->game->bga->playerStats->set('power_max', $finalStrength, $pid);
        }
    }

    // "points per faction" table stats — scoped to direct VP-bonus card effects only (e.g.
    // Werewolf +3VP, Lady Fortune +1VP/gold card), not border-combat win margins: a combat
    // margin is a difference between two cards (possibly two different families) and isn't
    // unambiguously "earned by" either one, whereas a vp_bonus is generated by exactly one
    // named card's own effect.
    private function addFactionPoints(int $family, int $amount): void
    {
        if ($amount <= 0) {
            return;
        }
        $statName = match ($family) {
            Game::FAMILY_GAMBLER => 'points_gambler',
            Game::FAMILY_BRUTE   => 'points_brute',
            Game::FAMILY_PIRATE  => 'points_pirate',
            default              => null,
        };
        if ($statName !== null) {
            $this->game->bga->tableStats->inc($statName, $amount);
        }
    }

    private function getPlayerColor(int $pid): string
    {
        if ($pid === CardEffects::BOT_PLAYER_ID) {
            return '999999';
        }
        $row = $this->game->getObjectFromDB(
            "SELECT player_color FROM player WHERE player_id = {$pid}"
        );
        return (string)($row['player_color'] ?? 'ffffff');
    }

    private function coloredName(string $name, string $color): string
    {
        return '<b style="color:#' . $color . '">' . $name . '</b>';
    }

    private function effectDesc(array $res): string
    {
        return $res['effect_text'] ?? '—';
    }

    private function notifyCombatStart(
        int $leftPid,  string $leftName,  string $leftCardName,
        int $rightPid, string $rightName, string $rightCardName
    ): void {
        $leftColor  = $this->getPlayerColor($leftPid);
        $rightColor = $this->getPlayerColor($rightPid);
        // Message left blank on purpose: the "PlayerA's Card vs PlayerB's Card" log-panel
        // entry was noise the user asked to remove — the notify itself still fires (client
        // uses it purely for pacing, see notif_combatStarted), only the log text is gone.
        $this->game->bga->notify->all('combatStarted', '',
            [
                'left_player_id'    => $leftPid,
                'left_player_name'  => $this->coloredName($leftName,      $leftColor),
                'left_card_name'    => $this->coloredName($leftCardName,  $leftColor),
                'right_player_id'   => $rightPid,
                'right_player_name' => $this->coloredName($rightName,     $rightColor),
                'right_card_name'   => $this->coloredName($rightCardName, $rightColor),
            ]
        );
    }

    private function calcBotStrength(string $side, int $row, array $botCard, array $res): int
    {
        if (!(int)($botCard['face_up'] ?? 1)) {
            return 0;
        }
        $botGridPos = CardEffects::botGridPos($side, $row);
        $base   = CardEffects::getBotBaseForce((int)$botCard['type'], (int)$botCard['type_arg']);
        $tokens = CardEffects::getBotTokenBonus($botGridPos, $this->game);
        return max(0, min(20, $base + $tokens + (int)$res['strength_bonus']));
    }
}
