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
        $playerOrder = (array)($this->game->bga->globals->get('player_order') ?? []);

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

        // Step 2: Influence phase — center column card (position = row*3 + 1)
        $centerPos = $row * 3 + 1;
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

            // Announce the effect FIRST so the player reads it before state changes appear
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

            // State changes arrive AFTER the effect badge (client processes queue in order)
            if ($this->game->gemsCharged->get($pid) !== $gemsBefore) {
                $this->broadcastGemUpdated($pid);
            }
            $this->broadcastTokensSync($pid);

            if ($res['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($pid, $res['vp_bonus']);
            }
        }

        // Step 2b (solo): reveal current row of bot columns
        $isSolo = (bool)($this->game->bga->globals->get('is_solo') ?? false);
        if ($isSolo) {
            $this->revealBotRow($row);
        }

        // Step 3: Combat phase
        if ($isSolo) {
            $this->resolveSoloCombats($playerOrder, $row);
        } else {
            $this->resolveCombats($playerOrder, $row);
        }

        return CheckTurn::class;
    }

    // -------------------------------------------------------------------------

    private function resolveCombats(array $playerOrder, int $row): void
    {
        $n = count($playerOrder);
        for ($i = 0; $i < $n; $i++) {
            $leftPid  = (int)$playerOrder[$i];
            $rightPid = (int)$playerOrder[($i + 1) % $n];

            // Left player's right-border card vs right player's left-border card
            $leftPos  = $row * 3 + 2; // col 3
            $rightPos = $row * 3 + 0; // col 1

            $leftCard  = $this->getCardAt($leftPid, $leftPos);
            $rightCard = $this->getCardAt($rightPid, $rightPos);

            if (!$leftCard || !$rightCard) continue;
            if (!(int)$leftCard['face_up'] || !(int)$rightCard['face_up']) continue;

            // Apply effects: left player first (per rules), then right player
            $gemsBeforeLeft = $this->game->gemsCharged->get($leftPid);
            $lRes = CardEffects::applyEffect(
                $leftCard, $leftPid, $leftPos, 'combat',
                $rightCard, $rightPid, $rightPos,
                $this->game
            );
            if ($this->game->gemsCharged->get($leftPid) !== $gemsBeforeLeft) {
                $this->broadcastGemUpdated($leftPid);
            }

            $gemsBeforeRight = $this->game->gemsCharged->get($rightPid);
            $rRes = CardEffects::applyEffect(
                $rightCard, $rightPid, $rightPos, 'combat',
                $leftCard, $leftPid, $leftPos,
                $this->game
            );
            if ($this->game->gemsCharged->get($rightPid) !== $gemsBeforeRight) {
                $this->broadcastGemUpdated($rightPid);
            }

            // Re-read cards (Cabin Boy may have flipped face-down during effect)
            $leftCard  = $this->getCardAt($leftPid,  $leftPos)  ?? $leftCard;
            $rightCard = $this->getCardAt($rightPid, $rightPos) ?? $rightCard;

            $lStr = $this->calcStrength($leftPid,  $leftPos,  $leftCard,  $lRes);
            $rStr = $this->calcStrength($rightPid, $rightPos, $rightCard, $rRes);

            // Announce combat sequence: start → effects → result
            $this->notifyCombatStart(
                $leftPid,  $this->game->getPlayerNameById($leftPid),
                CardEffects::getName((int)$leftCard['type'],  (int)$leftCard['type_arg']),
                $rightPid, $this->game->getPlayerNameById($rightPid),
                CardEffects::getName((int)$rightCard['type'], (int)$rightCard['type_arg'])
            );
            $this->notifyCombatEffect($leftCard,  $leftPid,  $leftPos,  $lRes, $lStr);
            $this->notifyCombatEffect($rightCard, $rightPid, $rightPos, $rRes, $rStr);

            // Award differential points
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

            // After-combat effect (Snake): winner rolls die
            if ($winnerId !== null) {
                $hasAfter = $lRes['after_combat'] || $rRes['after_combat'];
                if ($hasAfter) {
                    $bonusVp = rand(1, 6);
                    $this->game->bga->playerScore->inc($winnerId, $bonusVp);
                    $this->game->bga->playerStats->inc('combat_points', $bonusVp, $winnerId);
                }
            }

            // Direct VP bonuses (Werewolf, Lady Fortune)
            if ($lRes['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($leftPid, $lRes['vp_bonus']);
            }
            if ($rRes['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($rightPid, $rRes['vp_bonus']);
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
            $this->game->bga->notify->all('combatResolved', $combatMsg, [
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
            ]);
        }
    }

    // Base + token bonuses + effect bonus; face-down card = 0
    private function calcStrength(int $playerId, int $gridPos, ?array $card, array $res): int
    {
        if (!$card || !(int)($card['face_up'] ?? 1)) {
            return 0;
        }
        $base   = CardEffects::getBaseForce((int)$card['type'], (int)$card['type_arg']);
        $tokens = CardEffects::getTokenStrengthBonus($playerId, $gridPos, $this->game);
        return max(0, $base + $tokens + (int)$res['strength_bonus']);
    }

    private function broadcastRageToggle(int $pid, array $res): void
    {
        if ($res['rage_toggle'] !== null) {
            $this->game->bga->notify->all('rageUpdated', '', [
                'player_id' => $pid,
                'rage'      => $res['rage_toggle'],
            ]);
        }
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
        $tokens = $this->game->getCollectionFromDb(
            "SELECT grid_position, token_type, value FROM bc_token WHERE player_id = {$pid}"
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
    // Solo mode helpers
    // -------------------------------------------------------------------------

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

    private function resolveSoloCombats(array $playerOrder, int $row): void
    {
        $pid = (int)$playerOrder[0];

        // Activation order: flank-left(=bot_grid_right) → col1 → col3 → flank-right(=bot_grid_left)
        // JS inverts side for display: bot_grid_right → bc-flank-left, bot_grid_left → bc-flank-right
        // Combat 1: bot_grid_right (shown left) vs col1 — bot activates first
        $pLeftPos  = $row * 3 + 0;
        $botLeft   = $this->getBotCard('right', $row);
        $pLeftCard = $this->getCardAt($pid, $pLeftPos);
        if ($botLeft !== null && $pLeftCard !== null && (int)$pLeftCard['face_up']) {
            $this->resolveSoloCombat('right', $row, $botLeft, $pid, $pLeftPos, $pLeftCard, botFirst: true);
        }

        // Combat 2: col3 vs bot_grid_left (shown right) — player activates first
        $pRightPos  = $row * 3 + 2;
        $botRight   = $this->getBotCard('left', $row);
        $pRightCard = $this->getCardAt($pid, $pRightPos);
        if ($botRight !== null && $pRightCard !== null && (int)$pRightCard['face_up']) {
            $this->resolveSoloCombat('left', $row, $botRight, $pid, $pRightPos, $pRightCard, botFirst: false);
        }
    }

    private function resolveSoloCombat(
        string $side, int $row,
        array $botCard, int $pid, int $playerPos, array $playerCard,
        bool $botFirst = true
    ): void {
        $botGridPos = CardEffects::botGridPos($side, $row);

        if ($botFirst) {
            // Bot activates first (left combat)
            $bRes = CardEffects::applyBotEffect(
                $botCard, $side, $row,
                $playerCard, $pid, $playerPos,
                $this->game
            );
            if ($bRes['rage_toggle'] !== null) {
                $this->game->bga->notify->all('botRageUpdated', '', ['rage' => $bRes['rage_toggle']]);
            }

            $gemsBeforeSolo = $this->game->gemsCharged->get($pid);
            $pRes = CardEffects::applyEffect(
                $playerCard, $pid, $playerPos, 'combat',
                $botCard, CardEffects::BOT_PLAYER_ID, $botGridPos,
                $this->game
            );
            if ($this->game->gemsCharged->get($pid) !== $gemsBeforeSolo) {
                $this->broadcastGemUpdated($pid);
            }
        } else {
            // Player activates first (right combat)
            $gemsBeforeSolo = $this->game->gemsCharged->get($pid);
            $pRes = CardEffects::applyEffect(
                $playerCard, $pid, $playerPos, 'combat',
                $botCard, CardEffects::BOT_PLAYER_ID, $botGridPos,
                $this->game
            );
            if ($this->game->gemsCharged->get($pid) !== $gemsBeforeSolo) {
                $this->broadcastGemUpdated($pid);
            }

            $bRes = CardEffects::applyBotEffect(
                $botCard, $side, $row,
                $playerCard, $pid, $playerPos,
                $this->game
            );
            if ($bRes['rage_toggle'] !== null) {
                $this->game->bga->notify->all('botRageUpdated', '', ['rage' => $bRes['rage_toggle']]);
            }
        }

        // Re-read player card (Cabin Boy may have flipped face-down during effect)
        $playerCard = $this->getCardAt($pid, $playerPos) ?? $playerCard;

        $botStr = $this->calcBotStrength($side, $row, $botCard, $bRes);
        $pStr   = $this->calcStrength($pid, $playerPos, $playerCard, $pRes);

        // Announce combat sequence: start → effects (in activation order) → result
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

        // After-combat bonus (Snake)
        if ($winnerId !== null && ($bRes['after_combat'] || $pRes['after_combat'])) {
            $bonusVp = rand(1, 6);
            if ($winnerId === CardEffects::BOT_PLAYER_ID) {
                $botScore = (int)($this->game->bga->globals->get('bot_score') ?? 0) + $bonusVp;
                $this->game->bga->globals->set('bot_score', $botScore);
                $this->game->bga->notify->all('botScoreUpdated', '', ['score' => $botScore]);
            } else {
                $this->game->bga->playerScore->inc($pid, $bonusVp);
            }
        }

        // Direct VP bonuses
        if ($pRes['vp_bonus'] > 0) {
            $this->game->bga->playerScore->inc($pid, $pRes['vp_bonus']);
        }
        if ($bRes['vp_bonus'] > 0) {
            $botScore = (int)($this->game->bga->globals->get('bot_score') ?? 0) + $bRes['vp_bonus'];
            $this->game->bga->globals->set('bot_score', $botScore);
            $this->game->bga->notify->all('botScoreUpdated', '', ['score' => $botScore]);
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
        $this->game->bga->notify->all('combatResolved', $combatMsg, [
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
        ]);
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

    // Notify a single player card's combat effect (multiplayer and player side of solo).
    private function notifyCombatEffect(array $card, int $pid, int $pos, array $res, int $finalStrength): void
    {
        $cardName = CardEffects::getName((int)$card['type'], (int)$card['type_arg']);
        $desc     = $this->effectDesc($res);
        $msg      = $desc === '—'
            ? clienttranslate('${player_name}\'s ${card_name}: ⚔ ${final_strength}')
            : clienttranslate('${player_name}\'s ${card_name}: ${effect_desc} → ⚔ ${final_strength}');

        // Dice animation fires first so client shows the roll before seeing tokens or strength.
        if (!empty($res['dice_roll'])) {
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

        // Cabin Boy (1:5) flips face-down when on a border — animate the flip on the client
        if ($res['card_flipped_face_down'] ?? false) {
            $this->game->bga->notify->all('cardFlippedFaceDown', '', [
                'player_id' => $pid,
                'card_id'   => (int)$card['id'],
                'position'  => $pos,
                'family'    => (int)$card['family'],
            ]);
        }
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
        $this->game->bga->notify->all('combatStarted',
            clienttranslate('${left_player_name}\'s ${left_card_name} vs ${right_player_name}\'s ${right_card_name}'),
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
        return max(0, $base + $tokens + (int)$res['strength_bonus']);
    }
}
