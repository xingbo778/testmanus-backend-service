CREATE TABLE `anchor_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`anchorType` enum('character','scene','prop') NOT NULL,
	`description` text,
	`prompt` text,
	`imageUrl` text,
	`style` varchar(128),
	`tags` json,
	`metadata` json,
	`sourceProjectId` int,
	`sourceAnchorId` int,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anchor_library_id` PRIMARY KEY(`id`)
);
