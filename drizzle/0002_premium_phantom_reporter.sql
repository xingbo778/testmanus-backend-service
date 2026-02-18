CREATE TABLE `system_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`category` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`contentZh` text,
	`isDefault` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_prompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_prompts_key_unique` UNIQUE(`key`)
);
