<?php
/**
 * BGA Framework Stubs — IDE uniquement, JAMAIS déployé sur BGA Studio.
 * Déclare les classes/fonctions du framework BGA pour que l'IDE (Intelephense)
 * ne signale pas de fausses erreurs dans Game.php.
 */

declare(strict_types=1);

// ─── Constantes globales BGA ────────────────────────────────────────────────

define('APP_GAMEMODULE_PATH', '/');

// ─── Fonctions globales BGA ──────────────────────────────────────────────────

function clienttranslate(string $s): string { return $s; }
function _($s): string { return $s; }

// ─── Exceptions BGA ─────────────────────────────────────────────────────────

class BgaUserException extends \RuntimeException {}
class BgaSystemException extends \RuntimeException {}
class feException extends \RuntimeException {}

// ─── GameState ───────────────────────────────────────────────────────────────

class GameState
{
    public function nextState(string $transition = ''): void {}
    public function changeActivePlayer(int $playerId): void {}
    public function setAllPlayersMultiactive(): void {}
    public function setPlayersMultiactive(array $playerIds, string $next): void {}
    public function setPlayerNonMultiactive(int $playerId, string $next): void {}
}

// ─── Deck ────────────────────────────────────────────────────────────────────

class Deck
{
    public function init(string $table): void {}
    public function createCards(array $cards, string $location = 'deck', int $location_arg = 0): void {}
    public function shuffle(string $location): void {}
    public function pickCard(string $location, int $playerId): array { return []; }
    public function pickCardForLocation(string $fromLocation, string $toLocation, int $location_arg = 0): array { return []; }
    public function moveCard(int $cardId, string $location, int $location_arg = 0): void {}
    public function moveCards(array $cards, string $location, int $location_arg = 0): void {}
    public function moveAllCardsInLocation(string $from, string $to, ?int $from_arg = null, ?int $to_arg = null): void {}
    public function getCard(int $cardId): array { return []; }
    public function getCards(array $cardIds): array { return []; }
    public function getCardsInLocation(string $location, ?int $location_arg = null, string $orderBy = ''): array { return []; }
    public function countCardInLocation(string $location, ?int $location_arg = null): int { return 0; }
    public function getCardsOnTop(int $count, string $location): array { return []; }
    public function getCardOnTop(string $location): ?array { return null; }
}

// ─── Table (classe de base de tout jeu BGA) ──────────────────────────────────

class Table
{
    /** @var GameState */
    protected $gamestate;

    /** @var array<string, array<string, mixed>> */
    protected array $notifTypes = [];

    // --- Factory ---

    public static function getNew(string $module): object { return new stdClass(); }

    // --- DB helpers ---

    public static function DbQuery(string $sql): void {}
    /** @return array<string|int, array<string, mixed>> */
    public static function getCollectionFromDb(string $sql, bool $singleColumn = false): array { return []; }
    /** @return array<string, mixed>|null */
    public static function getObjectFromDb(string $sql): ?array { return null; }
    public static function getUniqueValueFromDb(string $sql): ?string { return null; }

    // --- Game state labels ---

    public static function initGameStateLabels(array $labels): void {}
    public function getGameStateValue(string $key): mixed { return 0; }
    public function setGameStateValue(string $key, mixed $value): void {}
    public function setGameStateInitialValue(string $key, mixed $value): void {}

    // --- Player helpers ---

    public static function getCurrentPlayerId(): int { return 0; }
    public function getActivePlayerId(): int { return 0; }
    public function getActivePlayerName(): string { return ''; }
    public function activeNextPlayer(): int { return 0; }
    public function giveExtraTime(int $playerId): void {}
    public function reloadPlayersBasicInfos(): void {}
    /** @return array<int, array<string, mixed>> */
    public function loadPlayersBasicInfos(): array { return []; }
    public function getPlayerNameById($player_id): string { return ''; }

    // --- Action validation ---

    public static function checkAction(string $actionName): void {}

    // --- Translation ---

    public static function _(string $s): string { return $s; }

    // --- Notifications ---

    public function notifyPlayer(int $playerId, string $type, string $message, array $args = []): void {}
    public function notifyAllPlayers(string $type, string $message, array $args = []): void {}
    public function notifyWithDelay(int $delay, int $playerId, string $type, string $message, array $args = []): void {}

    // --- Other ---

    public function setupNotifications(): void {}
}
