CREATE TABLE `screenplay_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`nameEn` varchar(256),
	`category` varchar(64) NOT NULL,
	`subcategory` varchar(64),
	`description` text,
	`targetDuration` varchar(16),
	`sceneCount` int NOT NULL DEFAULT 3,
	`narrativeArchetype` varchar(128),
	`emotionCurve` text,
	`hookStrategy` text,
	`scenes` json NOT NULL,
	`slots` json,
	`shuangdian` json,
	`tags` json,
	`usageCount` int NOT NULL DEFAULT 0,
	`isBuiltin` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `screenplay_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `screenplays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`idea` text NOT NULL,
	`templateId` int,
	`templateName` varchar(256),
	`totalDuration` int NOT NULL DEFAULT 60,
	`sceneCount` int NOT NULL DEFAULT 0,
	`status` enum('draft','generated','editing','finalized','archived') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`narrativeArchetype` varchar(128),
	`emotionCurve` text,
	`generationPrompt` text,
	`scenes` json,
	`characters` json,
	`settings` json,
	`slotValues` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `screenplays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shuangdian_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`category` varchar(64) NOT NULL,
	`level` enum('micro','mid','major') NOT NULL DEFAULT 'mid',
	`description` text,
	`example` text,
	`applicableTemplates` json,
	`emotionTarget` varchar(64),
	`tags` json,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shuangdian_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sptpl_category` ON `screenplay_templates` (`category`);--> statement-breakpoint
CREATE INDEX `idx_sptpl_archetype` ON `screenplay_templates` (`narrativeArchetype`);--> statement-breakpoint
CREATE INDEX `idx_sp_status` ON `screenplays` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sp_template` ON `screenplays` (`templateId`);--> statement-breakpoint
CREATE INDEX `idx_sp_created` ON `screenplays` (`createdBy`);--> statement-breakpoint
CREATE INDEX `idx_sdlib_category` ON `shuangdian_library` (`category`);--> statement-breakpoint
CREATE INDEX `idx_sdlib_level` ON `shuangdian_library` (`level`);