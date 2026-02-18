CREATE TABLE `app_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('info','warn','error','debug') NOT NULL DEFAULT 'info',
	`source` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`details` json,
	`projectId` int,
	`panelIndex` int,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `final_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`videoUrl` text,
	`totalDuration` varchar(16),
	`clipCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','merging','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `final_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_clips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`panelId` int NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`panelIndex` int NOT NULL,
	`model` varchar(64) NOT NULL DEFAULT 'seedance-1.5-pro',
	`taskId` varchar(256),
	`prompt` text,
	`keyframeUrl` text,
	`clipUrl` text,
	`rawDuration` varchar(16),
	`targetDuration` varchar(16),
	`trimmedClipUrl` text,
	`status` enum('pending','generating','upsampling','completed','trimmed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_clips_id` PRIMARY KEY(`id`)
);
