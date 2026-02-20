CREATE INDEX `idx_anchorlib_type` ON `anchor_library` (`anchorType`);--> statement-breakpoint
CREATE INDEX `idx_anchorlib_style` ON `anchor_library` (`style`);--> statement-breakpoint
CREATE INDEX `idx_anchors_project_version` ON `anchors` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_grids_project_version` ON `grids` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_panels_project_version` ON `panels` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_panels_grid` ON `panels` (`gridId`);--> statement-breakpoint
CREATE INDEX `idx_prompts_project_version` ON `prompts` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_prompts_panel` ON `prompts` (`panelId`);--> statement-breakpoint
CREATE INDEX `idx_scripts_project_version` ON `scripts` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_videoclips_project` ON `video_clips` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_videoclips_status` ON `video_clips` (`status`);