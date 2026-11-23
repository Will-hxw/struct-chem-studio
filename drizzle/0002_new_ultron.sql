CREATE TABLE `study_drafts` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`owner`, `kind`)
);
