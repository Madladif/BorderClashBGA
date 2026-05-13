
-- ------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- borderclash implementation : © Merle Editions
--
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-- -----

-- bc_card: all cards (Bronze/Silver/Gold). Custom name to avoid collision with BGA reserved 'card' table.
CREATE TABLE IF NOT EXISTS `bc_card` (
  `card_id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `card_type`         TINYINT      NOT NULL COMMENT '1=Bronze 2=Silver 3=Gold',
  `card_type_arg`     SMALLINT     NOT NULL COMMENT 'design number within rank',
  `card_family`       TINYINT      NOT NULL COMMENT '1=Gambler 2=Brute 3=Pirate',
  `card_location`     VARCHAR(32)  NOT NULL COMMENT 'deck hand grid_{pid} shared_* upgrade_options',
  `card_location_arg` INT          NOT NULL DEFAULT 0 COMMENT 'player_id or grid_position 0-8',
  `card_face_up`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0=face-down 1=face-up',
  PRIMARY KEY (`card_id`),
  KEY `card_location` (`card_location`, `card_location_arg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;

-- bc_token: Gambler tokens (+/-) and Pirate gold tokens. Stored by grid position, never by card_id.
-- grid_position 255 is reserved for out-of-grid containers (e.g. Mages cauldron, future expansion).
CREATE TABLE IF NOT EXISTS `bc_token` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `player_id`     INT UNSIGNED     NOT NULL,
  `grid_position` TINYINT UNSIGNED NOT NULL COMMENT '0-8 grid cell 255 reserved',
  `token_type`    VARCHAR(20)      NOT NULL COMMENT 'gambler or pirate_gold',
  `value`         TINYINT          NOT NULL DEFAULT 0 COMMENT 'signed strength modifier gambler or 0 pirate_gold',
  PRIMARY KEY (`id`),
  KEY `player_position` (`player_id`, `grid_position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;

-- Rage marker per player. Gems are tracked via PlayerCounter (no ALTER TABLE needed for those).
ALTER TABLE `player` ADD `player_rage` TINYINT(1) NOT NULL DEFAULT 0;
