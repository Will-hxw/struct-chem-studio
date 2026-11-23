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