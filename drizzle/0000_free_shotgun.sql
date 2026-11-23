CREATE TABLE `study_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`event_id` text NOT NULL,
	`event` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_owner_event` ON `study_events` (`owner`,`event_id`);--> statement-breakpoint
CREATE INDEX `study_owner_seq` ON `study_events` (`owner`,`seq`);