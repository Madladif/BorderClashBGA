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

            $res = CardEffects::applyEffect(
                $centerCard, $pid, $centerPos, 'influence',
                null, null, null,
                $this->game
            );

            $this->broadcastRageToggle($pid, $res);
            $this->broadcastGemUpdated($pid);

            $this->game->bga->notify->all('influenceResolved', '', [
                'player_id'   => $pid,
                'card_id'     => (int)$centerCard['id'],
                'effect_type' => "{$centerCard['type']}:{$centerCard['type_arg']}",
                'dice_roll'   => $res['dice_roll'],
            ]);

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
            $lRes = CardEffects::applyEffect(
                $leftCard, $leftPid, $leftPos, 'combat',
                $rightCard, $rightPid, $rightPos,
                $this->game
            );
            $this->broadcastRageToggle($leftPid, $lRes);
            $this->broadcastGemUpdated($leftPid);

            $rRes = CardEffects::applyEffect(
                $rightCard, $rightPid, $rightPos, 'combat',
                $leftCard, $leftPid, $leftPos,
                $this->game
            );
            $this->broadcastRageToggle($rightPid, $rRes);
            $this->broadcastGemUpdated($rightPid);

            // Re-read cards (Mousse may have flipped face-down)
            $leftCard  = $this->getCardAt($leftPid, $leftPos);
            $rightCard = $this->getCardAt($rightPid, $rightPos);

            $lStr = $this->calcStrength($leftPid,  $leftPos,  $leftCard,  $lRes);
            $rStr = $this->calcStrength($rightPid, $rightPos, $rightCard, $rRes);

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

            // After-combat effect (Double 6): winner rolls die
            if ($winnerId !== null) {
                $hasAfter = $lRes['after_combat'] || $rRes['after_combat'];
                if ($hasAfter) {
                    $bonusVp = rand(1, 6);
                    $this->game->bga->playerScore->inc($winnerId, $bonusVp);
                    $this->game->bga->playerStats->inc('combat_points', $bonusVp, $winnerId);
                }
            }

            // Direct VP bonuses (Loup-Garou, Lady Fortune)
            if ($lRes['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($leftPid, $lRes['vp_bonus']);
            }
            if ($rRes['vp_bonus'] > 0) {
                $this->game->bga->playerScore->inc($rightPid, $rRes['vp_bonus']);
            }

            $this->game->bga->notify->all('combatResolved', '', [
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

        // Combat 1: bot_left vs player col1 (left border)
        $pLeftPos  = $row * 3 + 0;
        $botLeft   = $this->getBotCard('left',  $row);
        $pLeftCard = $this->getCardAt($pid, $pLeftPos);
        if ($botLeft !== null && $pLeftCard !== null && (int)$pLeftCard['face_up']) {
            $this->resolveSoloCombat('left', $row, $botLeft, $pid, $pLeftPos, $pLeftCard);
        }

        // Combat 2: bot_right vs player col3 (right border)
        $pRightPos  = $row * 3 + 2;
        $botRight   = $this->getBotCard('right', $row);
        $pRightCard = $this->getCardAt($pid, $pRightPos);
        if ($botRight !== null && $pRightCard !== null && (int)$pRightCard['face_up']) {
            $this->resolveSoloCombat('right', $row, $botRight, $pid, $pRightPos, $pRightCard);
        }
    }

    private function resolveSoloCombat(
        string $side, int $row,
        array $botCard, int $pid, int $playerPos, array $playerCard
    ): void {
        $botGridPos = CardEffects::botGridPos($side, $row);

        // Bot effect resolved first (solo rule)
        $bRes = CardEffects::applyBotEffect(
            $botCard, $side, $row,
            $playerCard, $pid, $playerPos,
            $this->game
        );
        if ($bRes['rage_toggle'] !== null) {
            $this->game->bga->notify->all('botRageUpdated', '', ['rage' => $bRes['rage_toggle']]);
        }

        // Player effect
        $pRes = CardEffects::applyEffect(
            $playerCard, $pid, $playerPos, 'combat',
            $botCard, CardEffects::BOT_PLAYER_ID, $botGridPos,
            $this->game
        );
        $this->broadcastRageToggle($pid, $pRes);
        $this->broadcastGemUpdated($pid);

        // Re-read player card (Mousse may have flipped face-down)
        $playerCard = $this->getCardAt($pid, $playerPos);

        $botStr = $this->calcBotStrength($side, $row, $botCard, $bRes);
        $pStr   = $this->calcStrength($pid, $playerPos, $playerCard, $pRes);

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

        // After-combat bonus (Double 6)
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

        $this->game->bga->notify->all('combatResolved', '', [
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
