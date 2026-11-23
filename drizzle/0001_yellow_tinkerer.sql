CREATE TABLE `tutor_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tutor_request_time` ON `tutor_requests` (`at`);--> statement-breakpoint
CREATE INDEX `tutor_owner_time` ON `tutor_requests` (`owner`,`at`);