DROP TABLE chem_sessions;
--> statement-breakpoint
DROP TABLE chem_accounts;
--> statement-breakpoint
DROP TABLE chem_limits;
--> statement-breakpoint
DROP TABLE study_drafts;
--> statement-breakpoint
DROP TABLE study_events;
--> statement-breakpoint
DROP TABLE tutor_requests;
--> statement-breakpoint
CREATE TABLE `study_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`event_id` text NOT NULL,
	`event` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_owner_event` ON `study_events` (`owner`,`event_id`);--> statement-breakpoint
CREATE INDEX `study_owner_seq` ON `study_events` (`owner`,`seq`);
--> statement-breakpoint
CREATE TABLE `tutor_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tutor_request_time` ON `tutor_requests` (`at`);--> statement-breakpoint
CREATE INDEX `tutor_owner_time` ON `tutor_requests` (`owner`,`at`);
--> statement-breakpoint
CREATE TABLE `study_drafts` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`owner`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `chem_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`salt` text NOT NULL,
	`pw` text NOT NULL,
	`recovery` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chem_accounts_name_unique` ON `chem_accounts` (`name`);--> statement-breakpoint
CREATE TABLE `chem_limits` (
	`bucket` text NOT NULL,
	`window` integer NOT NULL,
	`n` integer NOT NULL,
	PRIMARY KEY(`bucket`, `window`)
);
--> statement-breakpoint
CREATE TABLE `chem_sessions` (
	`digest` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`expiry` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chem_sessions_uid` ON `chem_sessions` (`uid`);--> statement-breakpoint
CREATE INDEX `chem_sessions_expiry` ON `chem_sessions` (`expiry`);
--> statement-breakpoint
CREATE TABLE `email_codes` (
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`digest` text NOT NULL,
	`sent` integer NOT NULL,
	`tries` integer NOT NULL,
	PRIMARY KEY(`email`, `purpose`)
);
