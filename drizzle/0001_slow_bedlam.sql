CREATE TABLE `anchors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`anchorType` enum('character','scene','prop') NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`prompt` text,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anchors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories_l1` (
	`id` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameEn` varchar(128),
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_l1_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories_l2` (
	`id` varchar(64) NOT NULL,
	`l1Id` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameEn` varchar(128),
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_l2_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories_l3` (
	`id` varchar(96) NOT NULL,
	`l1Id` varchar(32) NOT NULL,
	`l2Id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameEn` varchar(128),
	`description` text,
	`templateRef` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_l3_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experience_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`categoryId` varchar(96),
	`actionType` enum('panel_fix','grid_regenerate','script_edit','prompt_edit') NOT NULL,
	`panelIndex` int,
	`originalContent` json,
	`issueDescription` text,
	`fixDescription` text,
	`ruleCategory` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `experience_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `export_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exportType` enum('full','incremental','by_category','rules') NOT NULL,
	`filterCriteria` json,
	`filePath` text,
	`recordCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `export_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`rows` int NOT NULL,
	`cols` int NOT NULL,
	`totalPanels` int NOT NULL,
	`gridImageUrl` text,
	`annotatedImageUrl` text,
	`generationPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `grids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `panels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gridId` int NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`panelIndex` int NOT NULL,
	`shotType` varchar(32),
	`duration` varchar(16),
	`description` text,
	`cameraMovement` varchar(64),
	`status` enum('ok','flagged','fixing','fixed') NOT NULL DEFAULT 'ok',
	`issueDescription` text,
	`fixHistory` json,
	`panelImageUrl` text,
	`referenceImageUrls` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `panels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`l1Id` varchar(32) NOT NULL,
	`l2Id` varchar(64) NOT NULL,
	`l3Id` varchar(96) NOT NULL,
	`duration` enum('15','30') NOT NULL DEFAULT '15',
	`status` enum('draft','scripted','grid_generated','reviewing','confirmed') NOT NULL DEFAULT 'draft',
	`currentVersion` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`panelId` int NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`promptText` text NOT NULL,
	`negativePrompt` text,
	`model` varchar(64),
	`controlStrategy` enum('first_frame','last_frame','first_last_frame','reference_frame') NOT NULL DEFAULT 'first_frame',
	`firstFrameUrl` text,
	`lastFrameUrl` text,
	`referenceImageUrls` json,
	`shotType` varchar(32),
	`cameraAngle` varchar(64),
	`subject` text,
	`action` text,
	`cameraMovement` varchar(64),
	`lighting` varchar(128),
	`texture` varchar(128),
	`effects` varchar(256),
	`transition` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `references_table` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`source` enum('google_search','video_frame','user_upload','template_library') NOT NULL,
	`query` varchar(512),
	`imageUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `references_table_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rule_chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chapterNumber` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`category` enum('universal','scene_specific','technical','ai_prompt') NOT NULL,
	`applicableL2Ids` json,
	`rules` json NOT NULL,
	`ruleCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rule_chapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`frames` json NOT NULL,
	`characters` json,
	`scenes` json,
	`props` json,
	`validationResult` json,
	`validationPassed` boolean,
	`rulesUsed` json,
	`generationPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleType` enum('do','dont') NOT NULL,
	`ruleText` text NOT NULL,
	`applicableL2Ids` json,
	`severity` enum('critical','warning','info') NOT NULL DEFAULT 'warning',
	`evidenceCount` int NOT NULL DEFAULT 0,
	`evidenceIds` json,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	CONSTRAINT `user_rules_id` PRIMARY KEY(`id`)
);
