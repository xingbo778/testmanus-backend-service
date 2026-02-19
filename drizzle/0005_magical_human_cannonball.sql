ALTER TABLE `projects` MODIFY COLUMN `duration` enum('15','30','45','60','90','120') NOT NULL DEFAULT '15';--> statement-breakpoint
ALTER TABLE `grids` ADD `pageIndex` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `grids` ADD `pageLabel` varchar(64);--> statement-breakpoint
ALTER TABLE `grids` ADD `startFrame` int;--> statement-breakpoint
ALTER TABLE `grids` ADD `endFrame` int;